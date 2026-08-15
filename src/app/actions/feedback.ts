"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";
import type { FeedbackRecoveryStatus } from "@/types/database";

export async function submitOrderFeedback(input: {
  orderId: string;
  customerId: string;
  tableId: string;
  waiterId?: string | null;
  rating: number;
  comment?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));

  const { error } = await supabase.from("order_feedback").upsert(
    {
      order_id: input.orderId,
      customer_id: input.customerId,
      table_id: input.tableId,
      waiter_id: input.waiterId ?? null,
      rating,
      comment: input.comment?.trim() || null,
    },
    { onConflict: "order_id" }
  );

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/analytics");
  return { success: true };
}

export async function resolveFeedback(input: {
  feedbackId: string;
  status: FeedbackRecoveryStatus;
  notes?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("order_feedback")
    .update({
      recovery_status: input.status,
      recovery_notes: input.notes?.trim() || null,
      resolved_at: input.status === "resolved" ? new Date().toISOString() : null,
      resolved_by: input.status === "resolved" ? user?.id ?? null : null,
    })
    .eq("id", input.feedbackId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/analytics");
  return { success: true };
}
