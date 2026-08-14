"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getFunctionErrorMessage } from "@/lib/supabase/function-error";
import type { ActionResult } from "./tables";

/** Creates a menu_scan_jobs row and triggers the `extract-menu-items` Edge Function. */
export async function createScanJob(
  imageUrls: string[]
): Promise<ActionResult<{ jobId: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job, error } = await supabase
    .from("menu_scan_jobs")
    .insert({
      uploaded_by: user?.id ?? null,
      image_urls: imageUrls,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !job) return { success: false, error: error?.message };

  const { error: fnError } = await supabase.functions.invoke("extract-menu-items", {
    body: { scanJobId: job.id },
  });

  if (fnError) {
    const message = await getFunctionErrorMessage(
      fnError,
      "Could not reach the extract-menu-items Edge Function. Is it deployed? (supabase functions deploy extract-menu-items)"
    );
    await supabase
      .from("menu_scan_jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", job.id);
    return { success: false, error: message };
  }

  revalidatePath("/admin/menu-scan");
  return { success: true, data: { jobId: job.id } };
}

export interface SpreadsheetRow {
  group?: string;
  category?: string;
  name: string;
  description?: string;
  price: number;
}

/** Creates a scan job + draft items directly from parsed spreadsheet rows (no AI involved). */
export async function importMenuRowsFromSpreadsheet(
  rows: SpreadsheetRow[],
  sourceFileUrl: string
): Promise<ActionResult<{ jobId: string }>> {
  if (rows.length === 0) return { success: false, error: "No rows to import" };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job, error: jobError } = await supabase
    .from("menu_scan_jobs")
    .insert({
      uploaded_by: user?.id ?? null,
      image_urls: [sourceFileUrl],
      status: "review",
    })
    .select("id")
    .single();

  if (jobError || !job) return { success: false, error: jobError?.message };

  const [{ data: existingGroups }, { data: existingCategories }] = await Promise.all([
    supabase.from("menu_category_groups").select("*"),
    supabase.from("menu_categories").select("*"),
  ]);

  const groupIdByName = new Map(
    (existingGroups ?? []).map((g) => [g.name.trim().toLowerCase(), g.id])
  );
  const categoryIdByName = new Map(
    (existingCategories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id])
  );

  async function resolveGroupId(name?: string): Promise<string | null> {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (groupIdByName.has(key)) return groupIdByName.get(key)!;
    const { data, error } = await supabase
      .from("menu_category_groups")
      .insert({ name: name.trim() })
      .select("id")
      .single();
    if (error || !data) return null;
    groupIdByName.set(key, data.id);
    return data.id;
  }

  async function resolveCategoryId(name: string | undefined, groupId: string | null): Promise<string | null> {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (categoryIdByName.has(key)) return categoryIdByName.get(key)!;
    const { data, error } = await supabase
      .from("menu_categories")
      .insert({ name: name.trim(), group_id: groupId })
      .select("id")
      .single();
    if (error || !data) return null;
    categoryIdByName.set(key, data.id);
    return data.id;
  }

  for (const row of rows) {
    const groupId = await resolveGroupId(row.group);
    const categoryId = await resolveCategoryId(row.category, groupId);
    const { error: itemError } = await supabase.from("menu_items").insert({
      scan_job_id: job.id,
      category_id: categoryId,
      name: row.name,
      description: row.description ?? null,
      price: row.price,
      status: "draft",
      source: "scanned",
      scan_confidence: 1,
    });
    if (itemError) return { success: false, error: itemError.message };
  }

  revalidatePath("/admin/menu-scan");
  return { success: true, data: { jobId: job.id } };
}

export async function updateDraftItem(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    price: number;
    category_id: string | null;
    image_url: string | null;
  }>
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu-scan");
  return { success: true };
}

export async function deleteDraftItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu-scan");
  return { success: true };
}

/** Manual "add missed item" entry attached to the same scan batch. */
export async function addManualItemToJob(input: {
  scanJobId: string;
  categoryId: string | null;
  name: string;
  description?: string;
  price: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").insert({
    scan_job_id: input.scanJobId,
    category_id: input.categoryId,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    status: "draft",
    source: "manual",
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu-scan");
  return { success: true };
}

/** Bulk-publishes every draft item from a scan job in one transition, and closes the job. */
export async function publishScanJob(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: itemsError } = await supabase
    .from("menu_items")
    .update({ status: "live" })
    .eq("scan_job_id", jobId)
    .eq("status", "draft");

  if (itemsError) return { success: false, error: itemsError.message };

  const { error: jobError } = await supabase
    .from("menu_scan_jobs")
    .update({ status: "published" })
    .eq("id", jobId);

  if (jobError) return { success: false, error: jobError.message };

  revalidatePath("/admin/menu-scan");
  revalidatePath("/admin/menu");
  return { success: true };
}
