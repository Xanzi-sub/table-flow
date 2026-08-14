"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";
import type { OrderStatus } from "@/types/database";

export interface CartLine {
  menuItemId: string;
  quantity: number;
  notes?: string;
  unitPrice: number;
}

/** Creates an order + its line items for the customer's own (RLS-verified) session. */
export async function submitOrder(input: {
  tableId: string;
  customerSessionId: string;
  customerId?: string;
  items: CartLine[];
}): Promise<ActionResult<{ orderId: string }>> {
  if (input.items.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  const supabase = await createClient();
  const totalAmount = input.items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_id: input.tableId,
      customer_session_id: input.customerSessionId,
      customer_id: input.customerId ?? null,
      total_amount: totalAmount,
      status: "pending",
      payment_status: "unpaid",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { success: false, error: orderError?.message ?? "Could not create order" };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    input.items.map((line) => ({
      order_id: order.id,
      menu_item_id: line.menuItemId,
      quantity: line.quantity,
      notes: line.notes ?? null,
      unit_price: line.unitPrice,
    }))
  );

  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  // Table flips vacant -> dining via a SECURITY DEFINER DB trigger on orders
  // insert (see migration 0008) — a client-side update here would silently
  // no-op under RLS, since customers aren't staff.

  // Fire-and-forget: a receipt delivery failure should never break checkout.
  supabase.functions
    .invoke("send-order-receipt", { body: { orderId: order.id } })
    .catch(() => {});

  revalidatePath("/staff/dashboard");
  return { success: true, data: { orderId: order.id } };
}

/** Customer flags they want to pay at the table (cash/Speedpoint) — alerts the waiter. */
export async function requestTableService(
  tableId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  // Direct table UPDATE is staff-only under RLS — this RPC is SECURITY
  // DEFINER so an anonymous customer session can still flag their own table.
  const { error } = await supabase.rpc("request_table_service", { p_table_id: tableId });

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/dashboard");
  return { success: true };
}

/** Staff-only: advances an order through the kitchen workflow (pending -> preparing -> served -> completed). */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("table_id")
    .single();

  if (error) return { success: false, error: error.message };

  // Completing an order frees up the table, but only once every other
  // active order for it is also completed/cancelled — not on payment alone.
  if (status === "completed" && order) {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", order.table_id)
      .in("status", ["pending", "preparing", "served"]);

    if (!count) {
      await supabase
        .from("tables")
        .update({ status: "vacant", current_waiter_id: null })
        .eq("id", order.table_id);
    }
  }

  revalidatePath("/staff/dashboard");
  return { success: true };
}

/** Secure order lookup — routes through the get_order_status RPC instead of a broad SELECT policy. */
export async function getOrderStatus(orderId: string, sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_status", {
    p_order_id: orderId,
    p_session_id: sessionId,
  });

  if (error) return null;
  return data;
}

/** Staff-only order history with optional filters — powers /admin/orders. */
export async function listOrderHistory(filters: {
  waiterId?: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  tableId?: string;
  customerId?: string;
} = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "*, tables(table_number, section), staff_profiles(full_name), customer_profiles(full_name), order_items(id, quantity)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.waiterId) query = query.eq("waiter_id", filters.waiterId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.tableId) query = query.eq("table_id", filters.tableId);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", filters.endDate);

  const { data, error } = await query;
  if (error) return [];
  return data;
}
