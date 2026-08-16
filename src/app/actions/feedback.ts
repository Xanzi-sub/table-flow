"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, RateLimitError } from "@/lib/security";
import type { ActionResult } from "./tables";
import type { FeedbackRecoveryStatus } from "@/types/database";

export async function submitOrderFeedback(input: {
  orderId: string;
  rating: number;
  comment?: string;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.rating) || (input.comment?.length ?? 0) > 2000) {
    return { success: false, error: "Invalid feedback" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Your ordering session has expired." };
  try {
    await enforceRateLimit({
      scope: "order-feedback",
      identifier: `${user.id}:${input.orderId}`,
      limit: 5,
      windowSeconds: 60 * 60,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof RateLimitError ? error.message : "Feedback is temporarily unavailable",
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, table_id, waiter_id")
    .eq("id", input.orderId)
    .eq("customer_session_id", user.id)
    .single();
  if (orderError || !order) return { success: false, error: "This order does not belong to your session." };

  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));

  const { error } = await supabase.from("order_feedback").upsert(
    {
      order_id: input.orderId,
      customer_id: order.customer_id ?? user.id,
      table_id: order.table_id,
      waiter_id: order.waiter_id,
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
  if (!user || (input.notes?.length ?? 0) > 2000) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "waiter") return { success: false, error: "Unauthorized" };

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
