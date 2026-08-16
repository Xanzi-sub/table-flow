"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";
import type { MenuItem, MenuSpecial, OrderStatus } from "@/types/database";

export interface CartLine {
  kind: "item" | "combo";
  menuItemId?: string;
  specialId?: string;
  quantity: number;
  notes?: string;
}

interface PricedOrderLine {
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  unit_price: number;
  bundle_id: string | null;
  special_id: string | null;
  special_name: string | null;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function specialAuditLabel(special: MenuSpecial) {
  if (special.discount_type === "quantity_deal") {
    return `${special.name} · Buy ${special.buy_quantity}, pay for ${special.pay_quantity}`;
  }
  if (special.discount_type === "fixed_price") {
    return `${special.name} · ${special.applicable_quantity} for R${special.discount_value.toFixed(2)}`;
  }
  return `${special.name} · ${special.discount_value}% off from quantity ${special.applicable_quantity}`;
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
  const { data: activeSpecialRows, error: specialsError } = await supabase
    .from("menu_specials")
    .select("*")
    .eq("status", "live");
  if (specialsError) return { success: false, error: specialsError.message };

  const activeSpecials = (activeSpecialRows ?? []) as MenuSpecial[];
  const requestedSpecialIds = new Set(input.items.map((line) => line.specialId).filter(Boolean));
  const requestedMenuItemIds = new Set(input.items.map((line) => line.menuItemId).filter(Boolean));
  for (const special of activeSpecials) {
    if (requestedSpecialIds.has(special.id) || special.kind === "item_discount") {
      for (const itemId of special.item_ids) requestedMenuItemIds.add(itemId);
    }
  }

  const { data: menuItemRows, error: menuItemsError } = await supabase
    .from("menu_items")
    .select("*")
    .in("id", [...requestedMenuItemIds])
    .eq("status", "live");
  if (menuItemsError) return { success: false, error: menuItemsError.message };
  const menuItemMap = new Map(((menuItemRows ?? []) as MenuItem[]).map((item) => [item.id, item]));
  const specialMap = new Map(activeSpecials.map((special) => [special.id, special]));
  const pricedLines: PricedOrderLine[] = [];

  for (const inputLine of input.items) {
    const quantity = Math.max(1, Math.min(99, Math.floor(inputLine.quantity)));

    if (inputLine.kind === "combo") {
      const special = inputLine.specialId ? specialMap.get(inputLine.specialId) : null;
      if (!special || special.kind !== "combo") {
        return { success: false, error: "A combo in your cart is no longer available. Please refresh the menu." };
      }
      const comboItems = special.item_ids.map((id) => menuItemMap.get(id));
      if (comboItems.some((item) => !item)) {
        return { success: false, error: `${special.name} contains an unavailable menu item.` };
      }

      const items = comboItems as MenuItem[];
      const originalTotal = items.reduce((sum, item) => sum + item.price, 0);
      const bundleId = crypto.randomUUID();
      let allocated = 0;

      items.forEach((item, index) => {
        const unitPrice =
          index === items.length - 1
            ? roundMoney(special.discount_value - allocated)
            : roundMoney(special.discount_value * (item.price / originalTotal));
        allocated = roundMoney(allocated + unitPrice);
        pricedLines.push({
          menu_item_id: item.id,
          quantity,
          notes: inputLine.notes ?? null,
          unit_price: Math.max(0, unitPrice),
          bundle_id: bundleId,
          special_id: special.id,
          special_name: special.name,
        });
      });
      continue;
    }

    if (!inputLine.menuItemId) return { success: false, error: "A cart item is missing its menu item." };
    const item = menuItemMap.get(inputLine.menuItemId);
    if (!item) return { success: false, error: "A menu item in your cart is no longer available." };
    const offers = activeSpecials
      .filter((special) => special.kind === "item_discount" && special.item_ids.includes(item.id))
      .map((special) => {
        const chargedUnits =
          special.discount_type === "quantity_deal"
            ? Math.floor(quantity / special.buy_quantity) * special.pay_quantity + (quantity % special.buy_quantity)
            : quantity;
        const total =
          special.discount_type === "percentage"
            ? roundMoney(
                (quantity >= special.applicable_quantity
                  ? item.price * (1 - special.discount_value / 100)
                  : item.price) * quantity
              )
            : special.discount_type === "fixed_price"
              ? roundMoney(
                  Math.floor(quantity / special.applicable_quantity) * special.discount_value +
                    (quantity % special.applicable_quantity) * item.price
                )
              : roundMoney(item.price * chargedUnits);
        return { special, total };
      })
      .sort((first, second) => first.total - second.total);
    const best = offers[0];
    pricedLines.push({
      menu_item_id: item.id,
      quantity,
      notes: inputLine.notes ?? null,
      unit_price: Math.max(0, best ? best.total / quantity : item.price),
      bundle_id: null,
      special_id: best?.special.id ?? null,
      special_name: best ? specialAuditLabel(best.special) : null,
    });
  }

  const totalAmount = roundMoney(
    pricedLines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
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
    pricedLines.map((line) => ({
      order_id: order.id,
      ...line,
    }))
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
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
