"use server";

import { createClient } from "@/lib/supabase/server";

export type PaymentSegment = "cash" | "card" | "mixed" | "none";

export interface CustomerSummary {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  whatsapp_opt_in: boolean;
  loyalty_points: number;
  created_at: string;
  totalSpend: number;
  orderCount: number;
  lastVisit: string | null;
  cashOrders: number;
  cardOrders: number;
  paymentSegment: PaymentSegment;
}

/** Manager/admin-only CRM list — aggregates each guest's spend/visit history for targeted marketing. */
export async function listCustomers(): Promise<CustomerSummary[]> {
  const supabase = await createClient();

  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase.from("customer_profiles").select("*"),
    supabase
      .from("orders")
      .select("customer_id, total_amount, payment_status, payment_method, created_at")
      .not("customer_id", "is", null),
  ]);

  interface Agg {
    spend: number;
    count: number;
    last: string;
    cash: number;
    card: number;
  }
  const byCustomer = new Map<string, Agg>();

  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const entry = byCustomer.get(o.customer_id) ?? { spend: 0, count: 0, last: o.created_at, cash: 0, card: 0 };
    entry.count += 1;
    if (o.payment_status === "paid") entry.spend += o.total_amount;
    if (o.created_at > entry.last) entry.last = o.created_at;
    if (o.payment_method === "cash") entry.cash += 1;
    if (o.payment_method === "speedpoint" || o.payment_method === "online_portal") entry.card += 1;
    byCustomer.set(o.customer_id, entry);
  }

  return (customers ?? [])
    .map((c) => {
      const agg = byCustomer.get(c.id);
      const cashOrders = agg?.cash ?? 0;
      const cardOrders = agg?.card ?? 0;
      const paymentSegment: PaymentSegment =
        cashOrders > 0 && cardOrders > 0 ? "mixed" : cardOrders > 0 ? "card" : cashOrders > 0 ? "cash" : "none";

      return {
        id: c.id,
        full_name: c.full_name,
        phone_number: c.phone_number,
        whatsapp_opt_in: c.whatsapp_opt_in,
        loyalty_points: c.loyalty_points,
        created_at: c.created_at,
        totalSpend: agg?.spend ?? 0,
        orderCount: agg?.count ?? 0,
        lastVisit: agg?.last ?? null,
        cashOrders,
        cardOrders,
        paymentSegment,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}
