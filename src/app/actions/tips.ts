"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./tables";
import type { TipCashoutStatus } from "@/types/database";

const CARD_METHODS = ["speedpoint", "online_portal"] as const;

export interface WaiterTipSummary {
  cashTotal: number;
  cardTotal: number;
  availableForCashout: number;
  pendingCashoutAmount: number;
}

/** Cash tips are assumed taken directly by the waiter — only card/online tips ever need cashing out. */
export async function getWaiterTipSummary(waiterId: string): Promise<WaiterTipSummary> {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("payment_method, tip_amount, tip_cashout_request_id")
    .eq("waiter_id", waiterId)
    .eq("payment_status", "paid")
    .gt("tip_amount", 0);

  let cashTotal = 0;
  let cardTotal = 0;
  let availableForCashout = 0;

  for (const o of orders ?? []) {
    if (o.payment_method === "cash") {
      cashTotal += o.tip_amount;
    } else if (o.payment_method && (CARD_METHODS as readonly string[]).includes(o.payment_method)) {
      cardTotal += o.tip_amount;
      if (!o.tip_cashout_request_id) availableForCashout += o.tip_amount;
    }
  }

  const { data: pending } = await supabase
    .from("tip_cashout_requests")
    .select("amount")
    .eq("waiter_id", waiterId)
    .in("status", ["pending", "scheduled"]);

  const pendingCashoutAmount = (pending ?? []).reduce((sum, r) => sum + r.amount, 0);

  return { cashTotal, cardTotal, availableForCashout, pendingCashoutAmount };
}

/** Waiter requests a cash-out of every currently-unclaimed card/online tip they've earned. */
export async function requestTipCashout(waiterId: string): Promise<ActionResult<{ amount: number }>> {
  const supabase = await createClient();

  const { data: eligibleOrders, error: fetchError } = await supabase
    .from("orders")
    .select("id, tip_amount")
    .eq("waiter_id", waiterId)
    .eq("payment_status", "paid")
    .is("tip_cashout_request_id", null)
    .gt("tip_amount", 0)
    .in("payment_method", CARD_METHODS as unknown as string[]);

  if (fetchError) return { success: false, error: fetchError.message };
  if (!eligibleOrders || eligibleOrders.length === 0) {
    return { success: false, error: "No card tips available to cash out." };
  }

  const amount = eligibleOrders.reduce((sum, o) => sum + o.tip_amount, 0);

  const { data: request, error: insertError } = await supabase
    .from("tip_cashout_requests")
    .insert({ waiter_id: waiterId, amount })
    .select("id")
    .single();

  if (insertError || !request) return { success: false, error: insertError?.message };

  const { error: linkError } = await supabase
    .from("orders")
    .update({ tip_cashout_request_id: request.id })
    .in(
      "id",
      eligibleOrders.map((o) => o.id)
    );

  if (linkError) return { success: false, error: linkError.message };

  revalidatePath("/staff/tips");
  revalidatePath("/admin/tips");
  return { success: true, data: { amount } };
}

/** A waiter's own cash-out request history. */
export async function listMyCashoutRequests(waiterId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tip_cashout_requests")
    .select("*")
    .eq("waiter_id", waiterId)
    .order("requested_at", { ascending: false });

  if (error) return [];
  return data;
}

/** Manager/admin: full cash-out request history across every waiter. */
export async function listAllCashoutRequests() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role === "waiter") return [];

  const admin = createAdminClient();
  const [{ data: requests, error }, { data: staff }] = await Promise.all([
    admin
    .from("tip_cashout_requests")
      .select("*")
      .order("requested_at", { ascending: false }),
    admin.from("staff_profiles").select("id, full_name"),
  ]);

  if (error) return [];
  const names = new Map((staff ?? []).map((member) => [member.id, member.full_name]));
  return (requests ?? []).map((request) => ({
    ...request,
    staff_profiles: { full_name: names.get(request.waiter_id) ?? "Staff member" },
  }));
}

/** Manager/admin approves (immediately or scheduled) or rejects a cash-out request. */
export async function resolveCashoutRequest(
  requestId: string,
  input: { status: TipCashoutStatus; scheduledFor?: string; notes?: string }
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("tip_cashout_requests")
    .update({
      status: input.status,
      scheduled_for: input.scheduledFor ?? null,
      notes: input.notes ?? null,
      resolved_at: input.status === "pending" ? null : new Date().toISOString(),
      resolved_by: user?.id ?? null,
    })
    .eq("id", requestId);

  if (error) return { success: false, error: error.message };

  // Rejected — free the linked orders back up so they're eligible again.
  if (input.status === "rejected") {
    const { error: unlinkError } = await supabase
      .from("orders")
      .update({ tip_cashout_request_id: null })
      .eq("tip_cashout_request_id", requestId);
    if (unlinkError) return { success: false, error: unlinkError.message };
  }

  revalidatePath("/staff/tips");
  revalidatePath("/admin/tips");
  return { success: true };
}
