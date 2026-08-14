"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getFunctionErrorMessage } from "@/lib/supabase/function-error";
import type { ActionResult } from "./tables";

/** Drafts a WhatsApp campaign and triggers the throttled Zendio batch-send Edge Function. */
export async function createCampaign(input: {
  title: string;
  messageBody: string;
  daysSinceLastVisit?: number;
  customerIds?: string[];
}): Promise<ActionResult<{ campaignId: string }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let recipientCountQuery = supabase
    .from("customer_profiles")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_opt_in", true);
  if (input.customerIds?.length) {
    recipientCountQuery = recipientCountQuery.in("id", input.customerIds);
  }
  const { count } = await recipientCountQuery;

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      title: input.title,
      message_body: input.messageBody,
      total_recipients: count ?? 0,
      status: "pending",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !campaign) return { success: false, error: error?.message };

  const { error: fnError } = await supabase.functions.invoke(
    "send-marketing-campaign",
    {
      body: {
        campaignId: campaign.id,
        daysSinceLastVisit: input.daysSinceLastVisit ?? null,
        customerIds: input.customerIds?.length ? input.customerIds : null,
      },
    }
  );

  if (fnError) {
    const message = await getFunctionErrorMessage(
      fnError,
      "Could not reach the send-marketing-campaign Edge Function. Is it deployed? (supabase functions deploy send-marketing-campaign)"
    );
    await supabase
      .from("marketing_campaigns")
      .update({ status: "failed" })
      .eq("id", campaign.id);
    return { success: false, error: message };
  }

  revalidatePath("/staff/marketing");
  return { success: true, data: { campaignId: campaign.id } };
}

export async function listCampaigns() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}
