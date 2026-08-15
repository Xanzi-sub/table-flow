"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod, TableStatus } from "@/types/database";

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** Binds a QR sticker to a table number, auto-assigning a waiter round-robin if none given. */
export async function assignTable(input: {
  qrIdentifier: string;
  tableNumber: number;
  section?: string;
  waiterId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("assign_table", {
    p_qr_identifier: input.qrIdentifier,
    p_table_number: input.tableNumber,
    p_section: input.section ?? null,
    p_waiter_id: input.waiterId ?? null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/dashboard");
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Lists all tables, ordered by table number, for the admin QR-code/table manager. */
export async function listTables() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("*")
    .order("table_number", { ascending: true, nullsFirst: false });
  return data ?? [];
}

/** Creates a fresh table + QR sticker identifier directly (no physical sticker to scan yet). */
export async function createTable(input: {
  tableNumber: number;
  section?: string;
}): Promise<ActionResult<{ id: string; qrIdentifier: string }>> {
  const supabase = await createClient();
  const qrIdentifier = crypto.randomUUID();

  const { data, error } = await supabase
    .from("tables")
    .insert({
      qr_identifier: qrIdentifier,
      table_number: input.tableNumber,
      section: input.section ?? null,
      status: "vacant",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/tables");
  return { success: true, data: { id: data.id, qrIdentifier } };
}

export async function updateTable(
  id: string,
  updates: { tableNumber?: number; section?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({
      ...(updates.tableNumber !== undefined ? { table_number: updates.tableNumber } : {}),
      ...(updates.section !== undefined ? { section: updates.section } : {}),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/tables");
  revalidatePath("/staff/dashboard");
  return { success: true };
}

export async function deleteTable(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/tables");
  revalidatePath("/staff/dashboard");
  return { success: true };
}

export async function listCheckedInWaiters() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, full_name, is_checked_in")
    .eq("role", "waiter")
    .eq("is_checked_in", true)
    .order("full_name");

  if (error) return [];
  return data;
}

export async function setTableStatus(
  tableId: string,
  status: TableStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", tableId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/dashboard");
  return { success: true };
}

/** Manager/admin override — reassigns a table's waiter and syncs its still-open orders to match. */
export async function reassignTableWaiter(
  tableId: string,
  waiterId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: tableError } = await supabase
    .from("tables")
    .update({ current_waiter_id: waiterId })
    .eq("id", tableId);
  if (tableError) return { success: false, error: tableError.message };

  const { error: ordersError } = await supabase
    .from("orders")
    .update({ waiter_id: waiterId })
    .eq("table_id", tableId)
    .in("status", ["pending", "preparing", "served"]);
  if (ordersError) return { success: false, error: ordersError.message };

  revalidatePath("/staff/dashboard");
  revalidatePath("/admin/tables");
  return { success: true };
}

/**
 * Marks the active order(s) for a table as paid — payment is independent of
 * kitchen/order status. The order stays open (and the table stays "dining")
 * until staff explicitly advances it to "completed" via updateOrderStatus,
 * which is what actually frees up the table.
 *
 * tipAmount is the ACTUAL amount staff received (cash handed over, or the
 * card tip confirmed on the Speedpoint slip) — not the suggested percentage
 * shown on the receipt. It's what funds the waiter's tips cash-out ledger,
 * so it's stamped onto a single order (never split/duplicated across the
 * table's other open orders).
 */
export async function markTablePaid(
  tableId: string,
  method: PaymentMethod,
  tipAmount: number = 0
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: openOrders, error: fetchError } = await supabase
    .from("orders")
    .select("id")
    .eq("table_id", tableId)
    .in("status", ["pending", "preparing", "served"])
    .order("created_at", { ascending: true });

  if (fetchError) return { success: false, error: fetchError.message };
  if (!openOrders || openOrders.length === 0) {
    return { success: false, error: "No open orders to mark as paid." };
  }

  const { error: ordersError } = await supabase
    .from("orders")
    .update({ payment_status: "paid", payment_method: method })
    .in(
      "id",
      openOrders.map((o) => o.id)
    );

  if (ordersError) return { success: false, error: ordersError.message };

  if (tipAmount > 0) {
    const { error: tipError } = await supabase
      .from("orders")
      .update({ tip_amount: tipAmount })
      .eq("id", openOrders[0].id);
    if (tipError) return { success: false, error: tipError.message };
  }

  revalidatePath("/staff/dashboard");
  return { success: true };
}

/** Clears the "customer needs help" alert — waiters resolve their own table's request, managers/admins can resolve any. */
export async function resolveServiceRequest(tableId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ service_requested_at: null })
    .eq("id", tableId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/dashboard");
  return { success: true };
}

export async function toggleCheckIn(
  staffId: string,
  isCheckedIn: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_profiles")
    .update({ is_checked_in: isCheckedIn })
    .eq("id", staffId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/dashboard");
  return { success: true };
}
