// Supabase Edge Function: extract-menu-items
// Accepts a scan job id, sends its photo(s) to Gemini (vision-capable) with a
// strict JSON-schema prompt, and inserts the resulting items as draft/scanned
// menu_items rows. Deploy with: supabase functions deploy extract-menu-items

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_VISION_MODEL = Deno.env.get("GEMINI_VISION_MODEL") ?? "gemini-3.6-flash";

interface ExtractedItem {
  name: string;
  group: string;
  category: string;
  description: string;
  price: number;
  confidence: number;
  image_index: number;
  crop: { x: number; y: number; width: number; height: number };
}

// Gemini's `responseSchema` uses an OpenAPI-style subset (not raw JSON Schema).
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          group: { type: "STRING" },
          category: { type: "STRING" },
          description: { type: "STRING" },
          price: { type: "NUMBER" },
          confidence: { type: "NUMBER" },
          image_index: { type: "INTEGER" },
          crop: {
            type: "OBJECT",
            properties: {
              x: { type: "NUMBER" },
              y: { type: "NUMBER" },
              width: { type: "NUMBER" },
              height: { type: "NUMBER" },
            },
            required: ["x", "y", "width", "height"],
          },
        },
        required: [
          "name",
          "group",
          "category",
          "description",
          "price",
          "confidence",
          "image_index",
          "crop",
        ],
      },
    },
  },
  required: ["items"],
};

const PROMPT =
  "You are a menu digitization assistant. Extract every dish/drink from the supplied restaurant menu page(s), " +
  "which may be photographs or PDF pages. " +
  "For each item return its top-level group (e.g. Food or Drinks), its category, name, description (empty string " +
  "if none printed), price as a plain number (no currency symbol), a confidence score between 0 and 1 reflecting " +
  "OCR/price certainty, the zero-based index of the source page/image it came from, and an approximate relative " +
  "bounding box (x, y, width, height as 0-1 fractions of that page) tightly cropping just that menu entry's text " +
  "block (use zeros if the source is a text-based PDF page with no meaningful crop). " +
  "Group items using the section headings actually printed on the menu (e.g. Starters, Mains, Sides, Desserts, " +
  "Drinks) as the category — reuse the exact same category string for every item under the same printed heading, " +
  "including across separate pages, so items group together correctly instead of each getting a slightly different " +
  "category label. For the top-level group, classify each category as either 'Food' or 'Drinks' (or another clear " +
  "top-level grouping if the menu has one, e.g. 'Specials'), reusing the exact same group string consistently.";

// Gemini needs raw image bytes (inlineData), not remote URLs — fetch + base64 encode each photo.
// Chunked conversion: a naive byte-by-byte string concatenation loop is far
// too slow/CPU-heavy for realistic multi-MB phone photos and can crash the
// edge function outright (an ungraceful worker crash, not a catchable JS
// error) — that produced the generic, non-JSON 500s seen in testing.
async function imageUrlToInlinePart(url: string) {
  const parsed = new URL(url);
  const storageOrigin = new URL(SUPABASE_URL).origin;
  if (parsed.protocol !== "https:" || parsed.origin !== storageOrigin || !parsed.pathname.startsWith("/storage/v1/object/")) {
    throw new Error("Menu photo URL is not from this project's storage");
  }

  const response = await fetch(parsed, { redirect: "error" });
  if (!response.ok) throw new Error("Could not fetch menu photo");
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    throw new Error("Unsupported menu file type");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 10 * 1024 * 1024) throw new Error("Menu file exceeds 10 MB");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Menu file exceeds 10 MB");

  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return { inlineData: { mimeType, data: btoa(chunks.join("")) } };
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Captured once so the catch block never needs to re-read the request body
  // — req.clone().json() after req.json() throws "Body is unusable" in Deno.
  let scanJobId: string | undefined;

  try {
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json") {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), { status: 415 });
    }
    const authorization = req.headers.get("authorization");
    if (!authorization) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const { data: staff } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
    if (!staff || staff.role === "waiter") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const body = await req.json();
    scanJobId = body.scanJobId;
    if (!scanJobId || !/^[0-9a-f-]{36}$/i.test(scanJobId)) {
      return new Response(JSON.stringify({ error: "scanJobId is required" }), {
        status: 400,
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("menu_scan_jobs")
      .select("*")
      .eq("id", scanJobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Scan job not found" }), {
        status: 404,
      });
    }

    await supabase
      .from("menu_scan_jobs")
      .update({ status: "processing" })
      .eq("id", scanJobId);

    const imageParts = await Promise.all(
      (job.image_urls as string[]).map(imageUrlToInlinePart)
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${PROMPT}\n\nExtract all menu items from these photos.` },
                ...imageParts,
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini request failed: ${text}`);
    }

    const completion = await response.json();
    const rawText = completion.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini returned no content");
    const parsed = JSON.parse(rawText) as { items: ExtractedItem[] };

    await supabase
      .from("menu_scan_jobs")
      .update({ raw_ai_output: parsed })
      .eq("id", scanJobId);

    if (parsed.items.length > 0) {
      const [{ data: categories }, { data: groups }] = await Promise.all([
        supabase.from("menu_categories").select("id, name, group_id"),
        supabase.from("menu_category_groups").select("id, name"),
      ]);

      const categoryIdByName = new Map(
        (categories ?? []).map((c: { id: string; name: string }) => [
          c.name.trim().toLowerCase(),
          c.id,
        ])
      );
      const groupIdByName = new Map(
        (groups ?? []).map((g: { id: string; name: string }) => [
          g.name.trim().toLowerCase(),
          g.id,
        ])
      );

      async function resolveGroupId(name: string): Promise<string | null> {
        const key = name.trim().toLowerCase();
        if (!key) return null;
        const existing = groupIdByName.get(key);
        if (existing) return existing;
        const { data: newGroup } = await supabase
          .from("menu_category_groups")
          .insert({ name: name.trim() })
          .select("id")
          .single();
        if (newGroup?.id) groupIdByName.set(key, newGroup.id);
        return newGroup?.id ?? null;
      }

      const rowsToInsert = [];
      for (const item of parsed.items) {
        let categoryId = categoryIdByName.get(item.category.trim().toLowerCase());

        if (!categoryId) {
          const groupId = item.group ? await resolveGroupId(item.group) : null;
          const { data: newCategory } = await supabase
            .from("menu_categories")
            .insert({ name: item.category, group_id: groupId })
            .select("id")
            .single();
          categoryId = newCategory?.id;
          if (categoryId) {
            categoryIdByName.set(item.category.trim().toLowerCase(), categoryId);
          }
        }

        rowsToInsert.push({
          category_id: categoryId ?? null,
          name: item.name,
          description: item.description || null,
          price: item.price,
          status: "draft",
          source: "scanned",
          scan_confidence: item.confidence,
          scan_job_id: scanJobId,
        });
      }

      const { error: insertError } = await supabase
        .from("menu_items")
        .insert(rowsToInsert);

      if (insertError) throw new Error(insertError.message);
    }

    await supabase
      .from("menu_scan_jobs")
      .update({ status: "needs_review" })
      .eq("id", scanJobId);

    return new Response(JSON.stringify({ success: true, itemCount: parsed.items.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (scanJobId) {
      await supabase
        .from("menu_scan_jobs")
        .update({ status: "failed", error_message: message })
        .eq("id", scanJobId);
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
