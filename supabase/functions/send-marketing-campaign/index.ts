// Supabase Edge Function: send-marketing-campaign
// Queries opted-in customers (optionally filtered by days since last order),
// then sends the campaign message via the Zernio (Zendio) WhatsApp broadcast
// API in throttled batches to respect rate limits. Deploy with:
//   supabase functions deploy send-marketing-campaign

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// https://docs.zernio.com/broadcasts/create-broadcast — Bearer auth via API key.
const ZENDIO_API_URL = Deno.env.get("ZENDIO_API_URL") ?? "https://zernio.com/api/v1";
const ZENDIO_API_KEY = Deno.env.get("ZENDIO_API_KEY")!;

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function zendioFetch(path: string, body: unknown) {
  const response = await fetch(`${ZENDIO_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ZENDIO_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Zendio request to ${path} failed: ${await response.text()}`);
  }
  return response.json();
}

async function createBroadcast(accountId: string, message: string) {
  const { broadcast } = await zendioFetch("/broadcasts", {
    accountId,
    name: `TableFlow campaign ${new Date().toISOString()}`,
    message: { type: "text", text: message },
  });
  return broadcast.id as string;
}

async function addRecipients(broadcastId: string, phoneNumbers: string[]) {
  await zendioFetch(`/broadcasts/${broadcastId}/recipients`, {
    recipients: phoneNumbers.map((phone) => ({ phone })),
  });
}

async function sendBroadcast(broadcastId: string) {
  await zendioFetch(`/broadcasts/${broadcastId}/send`, {});
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Captured once so the catch block never needs to re-read the request body
  // — req.clone().json() after req.json() throws "Body is unusable" in Deno.
  let campaignId: string | undefined;

  try {
    const body = await req.json();
    campaignId = body.campaignId;
    const daysSinceLastVisit = body.daysSinceLastVisit;
    const customerIds: string[] | null = Array.isArray(body.customerIds) ? body.customerIds : null;
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), {
        status: 400,
      });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
      });
    }

    const { data: venue } = await supabase
      .from("venue_settings")
      .select("zendio_account_id")
      .maybeSingle();

    if (!venue?.zendio_account_id) {
      return new Response(
        JSON.stringify({
          error:
            "No WhatsApp account connected yet — detect one from /staff/marketing first.",
        }),
        { status: 400 }
      );
    }

    await supabase
      .from("marketing_campaigns")
      .update({ status: "processing" })
      .eq("id", campaignId);

    const { data: optedIn } = await supabase
      .from("customer_profiles")
      .select("id, phone_number")
      .eq("whatsapp_opt_in", true);

    let recipients = optedIn ?? [];

    // CRM-selected targeting still respects opt-in consent — it only narrows the opted-in pool.
    if (customerIds && customerIds.length > 0) {
      const idSet = new Set(customerIds);
      recipients = recipients.filter((c) => idSet.has(c.id));
    }

    if (typeof daysSinceLastVisit === "number") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysSinceLastVisit);

      const { data: recentOrders } = await supabase
        .from("orders")
        .select("customer_id, created_at")
        .not("customer_id", "is", null)
        .gte("created_at", cutoff.toISOString());

      const recentCustomerIds = new Set(
        (recentOrders ?? []).map((o: { customer_id: string }) => o.customer_id)
      );

      recipients = recipients.filter((c) => !recentCustomerIds.has(c.id));
    }

    let sent = 0;
    let failed = 0;

    if (recipients.length > 0) {
      try {
        const broadcastId = await createBroadcast(venue.zendio_account_id, campaign.message_body);

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          await addRecipients(
            broadcastId,
            batch.map((c) => c.phone_number)
          );
          sent += batch.length;

          if (i + BATCH_SIZE < recipients.length) {
            await sleep(BATCH_DELAY_MS);
          }
        }

        await sendBroadcast(broadcastId);
      } catch (sendError) {
        failed = recipients.length;
        sent = 0;
        throw sendError;
      }
    }

    await supabase
      .from("marketing_campaigns")
      .update({
        status: failed === recipients.length && recipients.length > 0 ? "failed" : "completed",
        total_recipients: recipients.length,
      })
      .eq("id", campaignId);

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (campaignId) {
      await supabase
        .from("marketing_campaigns")
        .update({ status: "failed" })
        .eq("id", campaignId);
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
