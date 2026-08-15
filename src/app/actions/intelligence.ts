"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatStaffName } from "@/lib/utils";
import type { MenuItem, Order, OrderFeedback, OrderItem, TableRow } from "@/types/database";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MenuPerformanceRow {
  id: string;
  name: string;
  category: string;
  units: number;
  orders: number;
  revenue: number;
  previousUnits: number;
  trendPercent: number | null;
  label: "best_seller" | "rising" | "slow_mover" | "high_revenue" | "steady";
}

export interface PairingInsight {
  firstItemId: string;
  firstItem: string;
  secondItemId: string;
  secondItem: string;
  orderCount: number;
  attachRate: number;
  combinedPrice: number;
}

export interface CustomerSegment {
  id: "new" | "returning" | "loyal" | "lapsed" | "high_value" | "lunch" | "weekend";
  label: string;
  description: string;
  count: number;
  customerIds: string[];
  optedInIds: string[];
}

export interface WaiterInsight {
  id: string;
  name: string;
  activeTables: number;
  paidOrders: number;
  revenue: number;
  tips: number;
}

export interface FeedbackInsight {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  tableLabel: string;
  waiterName: string;
  rating: number;
  comment: string | null;
  recoveryStatus: OrderFeedback["recovery_status"];
  recoveryNotes: string | null;
  createdAt: string;
  whatsappEligible: boolean;
}

export interface IntelligenceSnapshot {
  generatedAt: string;
  today: {
    revenue: number;
    orders: number;
    customers: number;
    returningCustomers: number;
    activeTables: number;
    serviceRequests: number;
    awaitingBill: number;
    unassignedTables: number;
  };
  previousDay: { revenue: number; orders: number };
  peakHour: { hour: number; orders: number } | null;
  menuPerformance: MenuPerformanceRow[];
  pairings: PairingInsight[];
  segments: CustomerSegment[];
  waiterInsights: WaiterInsight[];
  feedback: {
    averageRating: number | null;
    totalResponses: number;
    lowRatingCount: number;
    recoveryQueue: FeedbackInsight[];
  };
  briefing: string[];
}

interface CustomerAgg {
  id: string;
  orderCount: number;
  spend: number;
  firstVisit: string;
  lastVisit: string;
  hours: number[];
  weekendOrders: number;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function buildPairings(
  orderItems: Pick<OrderItem, "order_id" | "menu_item_id">[],
  menuItems: Pick<MenuItem, "id" | "name" | "price">[],
  eligibleOrderIds: Set<string>
): PairingInsight[] {
  const itemsByOrder = new Map<string, Set<string>>();
  const itemOrderCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const menuMap = new Map(menuItems.map((item) => [item.id, item]));

  for (const line of orderItems) {
    if (!eligibleOrderIds.has(line.order_id)) continue;
    const set = itemsByOrder.get(line.order_id) ?? new Set<string>();
    set.add(line.menu_item_id);
    itemsByOrder.set(line.order_id, set);
  }

  for (const set of itemsByOrder.values()) {
    const ids = [...set].sort();
    for (const id of ids) itemOrderCounts.set(id, (itemOrderCounts.get(id) ?? 0) + 1);
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) {
        const key = `${ids[first]}::${ids[second]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...pairCounts.entries()]
    .map(([key, orderCount]) => {
      const [firstItemId, secondItemId] = key.split("::");
      const first = menuMap.get(firstItemId);
      const second = menuMap.get(secondItemId);
      if (!first || !second) return null;
      const denominator = Math.min(
        itemOrderCounts.get(firstItemId) ?? 1,
        itemOrderCounts.get(secondItemId) ?? 1
      );
      return {
        firstItemId,
        firstItem: first.name,
        secondItemId,
        secondItem: second.name,
        orderCount,
        attachRate: Math.round((orderCount / denominator) * 100),
        combinedPrice: first.price + second.price,
      };
    })
    .filter((pair): pair is PairingInsight => pair !== null)
    .sort((a, b) => b.orderCount - a.orderCount || b.attachRate - a.attachRate);
}

export async function getIntelligenceSnapshot(): Promise<IntelligenceSnapshot> {
  const supabase = createAdminClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(todayStart.getTime() - 60 * DAY_MS);
  const ninetyDaysAgo = new Date(todayStart.getTime() - 90 * DAY_MS);

  const [ordersResult, orderItemsResult, menuItemsResult, categoriesResult, customersResult, tablesResult, waitersResult, feedbackResult] =
    await Promise.all([
      supabase.from("orders").select("*").gte("created_at", ninetyDaysAgo.toISOString()),
      supabase.from("order_items").select("*"),
      supabase.from("menu_items").select("id, name, category_id, price, status, created_at"),
      supabase.from("menu_categories").select("id, name"),
      supabase.from("customer_profiles").select("id, full_name, whatsapp_opt_in"),
      supabase.from("tables").select("*"),
      supabase.from("staff_profiles").select("id, full_name").eq("role", "waiter"),
      supabase.from("order_feedback").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

  const orders = (ordersResult.data ?? []).filter((order) => order.status !== "cancelled") as Order[];
  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const orderItems = (orderItemsResult.data ?? []) as OrderItem[];
  const menuItems = (menuItemsResult.data ?? []) as Pick<MenuItem, "id" | "name" | "category_id" | "price" | "status" | "created_at">[];
  const categories = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  const customerOptIn = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer.whatsapp_opt_in]));
  const customerNames = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer.full_name ?? "Guest"]));
  const tables = (tablesResult.data ?? []) as TableRow[];
  const waiters = waitersResult.data ?? [];
  const tableMap = new Map(tables.map((table) => [table.id, table]));
  const waiterMap = new Map(waiters.map((waiter) => [waiter.id, formatStaffName(waiter.full_name)]));
  const feedbackRows = (feedbackResult.data ?? []) as OrderFeedback[];

  const todayOrders = paidOrders.filter((order) => new Date(order.created_at) >= todayStart);
  const yesterdayOrders = paidOrders.filter((order) => {
    const created = new Date(order.created_at);
    return created >= yesterdayStart && created < todayStart;
  });
  const currentPeriodOrders = paidOrders.filter((order) => new Date(order.created_at) >= thirtyDaysAgo);
  const previousPeriodOrders = paidOrders.filter((order) => {
    const created = new Date(order.created_at);
    return created >= sixtyDaysAgo && created < thirtyDaysAgo;
  });
  const currentOrderIds = new Set(currentPeriodOrders.map((order) => order.id));
  const previousOrderIds = new Set(previousPeriodOrders.map((order) => order.id));
  const ninetyDayOrderIds = new Set(paidOrders.map((order) => order.id));

  const itemAgg = new Map<string, { units: number; revenue: number; orderIds: Set<string>; previousUnits: number }>();
  for (const line of orderItems) {
    const agg = itemAgg.get(line.menu_item_id) ?? {
      units: 0,
      revenue: 0,
      orderIds: new Set<string>(),
      previousUnits: 0,
    };
    if (currentOrderIds.has(line.order_id)) {
      agg.units += line.quantity;
      agg.revenue += line.quantity * line.unit_price;
      agg.orderIds.add(line.order_id);
    }
    if (previousOrderIds.has(line.order_id)) agg.previousUnits += line.quantity;
    itemAgg.set(line.menu_item_id, agg);
  }

  const activeItems = menuItems.filter((item) => item.status !== "archived");
  const revenueValues = activeItems.map((item) => itemAgg.get(item.id)?.revenue ?? 0).sort((a, b) => b - a);
  const highRevenueThreshold = revenueValues[Math.max(0, Math.floor(revenueValues.length * 0.25) - 1)] ?? 0;
  const maxUnits = Math.max(0, ...activeItems.map((item) => itemAgg.get(item.id)?.units ?? 0));

  const menuPerformance: MenuPerformanceRow[] = activeItems
    .map((item) => {
      const agg = itemAgg.get(item.id) ?? { units: 0, revenue: 0, orderIds: new Set<string>(), previousUnits: 0 };
      const trendPercent = percentageChange(agg.units, agg.previousUnits);
      let label: MenuPerformanceRow["label"] = "steady";
      if (agg.units > 0 && agg.units === maxUnits) label = "best_seller";
      else if (trendPercent !== null && trendPercent >= 20 && agg.units >= 3) label = "rising";
      else if (agg.units < 5) label = "slow_mover";
      else if (agg.revenue >= highRevenueThreshold && highRevenueThreshold > 0) label = "high_revenue";
      return {
        id: item.id,
        name: item.name,
        category: item.category_id ? categories.get(item.category_id) ?? "Uncategorized" : "Uncategorized",
        units: agg.units,
        orders: agg.orderIds.size,
        revenue: agg.revenue,
        previousUnits: agg.previousUnits,
        trendPercent,
        label,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);

  const pairings = buildPairings(orderItems, menuItems, ninetyDayOrderIds).slice(0, 12);

  const customerAgg = new Map<string, CustomerAgg>();
  for (const order of paidOrders) {
    if (!order.customer_id) continue;
    const existing = customerAgg.get(order.customer_id);
    const date = new Date(order.created_at);
    const agg = existing ?? {
      id: order.customer_id,
      orderCount: 0,
      spend: 0,
      firstVisit: order.created_at,
      lastVisit: order.created_at,
      hours: [],
      weekendOrders: 0,
    };
    agg.orderCount += 1;
    agg.spend += order.total_amount;
    agg.firstVisit = order.created_at < agg.firstVisit ? order.created_at : agg.firstVisit;
    agg.lastVisit = order.created_at > agg.lastVisit ? order.created_at : agg.lastVisit;
    agg.hours.push(date.getHours());
    if (date.getDay() === 0 || date.getDay() === 6) agg.weekendOrders += 1;
    customerAgg.set(order.customer_id, agg);
  }

  const makeSegment = (
    id: CustomerSegment["id"],
    label: string,
    description: string,
    predicate: (customer: CustomerAgg) => boolean
  ): CustomerSegment => {
    const matching = [...customerAgg.values()].filter(predicate);
    return {
      id,
      label,
      description,
      count: matching.length,
      customerIds: matching.map((customer) => customer.id),
      optedInIds: matching.filter((customer) => customerOptIn.get(customer.id)).map((customer) => customer.id),
    };
  };

  const segments: CustomerSegment[] = [
    makeSegment("new", "New customers", "First paid order in the last 30 days", (customer) =>
      customer.orderCount === 1 && new Date(customer.firstVisit) >= thirtyDaysAgo
    ),
    makeSegment("returning", "Returning customers", "Customers with two or more paid orders", (customer) =>
      customer.orderCount >= 2
    ),
    makeSegment("loyal", "Loyal customers", "Five or more paid orders", (customer) => customer.orderCount >= 5),
    makeSegment("lapsed", "Lapsed customers", "Previously active, but no visit in 30+ days", (customer) =>
      customer.orderCount >= 2 && new Date(customer.lastVisit) < thirtyDaysAgo
    ),
    makeSegment("high_value", "High-value customers", "Lifetime spend of R1,500 or more", (customer) =>
      customer.spend >= 1500
    ),
    makeSegment("lunch", "Lunch customers", "Most visits occur between 11:00 and 14:00", (customer) =>
      customer.hours.filter((hour) => hour >= 11 && hour < 14).length > customer.orderCount / 2
    ),
    makeSegment("weekend", "Weekend customers", "Most visits happen on Saturday or Sunday", (customer) =>
      customer.weekendOrders > customer.orderCount / 2
    ),
  ];

  const activeTables = tables.filter((table) => table.status === "dining" || table.status === "awaiting_bill");
  const waiterInsights: WaiterInsight[] = waiters
    .map((waiter) => {
      const waiterOrders = currentPeriodOrders.filter((order) => order.waiter_id === waiter.id);
      return {
        id: waiter.id,
        name: formatStaffName(waiter.full_name),
        activeTables: activeTables.filter((table) => table.current_waiter_id === waiter.id).length,
        paidOrders: waiterOrders.length,
        revenue: waiterOrders.reduce((sum, order) => sum + order.total_amount, 0),
        tips: waiterOrders.reduce((sum, order) => sum + order.tip_amount, 0),
      };
    })
    .sort((a, b) => b.activeTables - a.activeTables || b.revenue - a.revenue);

  const feedback = {
    averageRating: feedbackRows.length
      ? Math.round((feedbackRows.reduce((sum, row) => sum + row.rating, 0) / feedbackRows.length) * 10) / 10
      : null,
    totalResponses: feedbackRows.length,
    lowRatingCount: feedbackRows.filter((row) => row.rating <= 2 && row.recovery_status !== "resolved").length,
    recoveryQueue: feedbackRows
      .filter((row) => row.rating <= 3)
      .map((row): FeedbackInsight => {
        const table = row.table_id ? tableMap.get(row.table_id) : null;
        return {
          id: row.id,
          orderId: row.order_id,
          customerId: row.customer_id,
          customerName: customerNames.get(row.customer_id) ?? "Guest",
          tableLabel: table?.table_number ? `Table ${table.table_number}` : "Unknown table",
          waiterName: row.waiter_id ? waiterMap.get(row.waiter_id) ?? "Unknown waiter" : "Unassigned",
          rating: row.rating,
          comment: row.comment,
          recoveryStatus: row.recovery_status,
          recoveryNotes: row.recovery_notes,
          createdAt: row.created_at,
          whatsappEligible: customerOptIn.get(row.customer_id) ?? false,
        };
      }),
  };

  const hourCounts = new Map<number, number>();
  for (const order of paidOrders) {
    const hour = new Date(order.created_at).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const peakEntry = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakHour = peakEntry ? { hour: peakEntry[0], orders: peakEntry[1] } : null;
  const todayCustomerIds = new Set(todayOrders.map((order) => order.customer_id).filter(Boolean));
  const returningToday = [...todayCustomerIds].filter((id) => (customerAgg.get(id as string)?.orderCount ?? 0) >= 2).length;

  const today = {
    revenue: todayOrders.reduce((sum, order) => sum + order.total_amount, 0),
    orders: todayOrders.length,
    customers: todayCustomerIds.size,
    returningCustomers: returningToday,
    activeTables: activeTables.length,
    serviceRequests: tables.filter((table) => table.service_requested_at).length,
    awaitingBill: tables.filter((table) => table.status === "awaiting_bill").length,
    unassignedTables: activeTables.filter((table) => !table.current_waiter_id).length,
  };
  const previousDay = {
    revenue: yesterdayOrders.reduce((sum, order) => sum + order.total_amount, 0),
    orders: yesterdayOrders.length,
  };

  const briefing: string[] = [];
  const topItem = menuPerformance[0];
  if (topItem?.units) {
    briefing.push(`${topItem.name} leads the last 30 days with ${topItem.units} units and R${Math.round(topItem.revenue).toLocaleString("en-ZA")} revenue.`);
  }
  const slowMovers = menuPerformance.filter((item) => item.label === "slow_mover");
  if (slowMovers.length) briefing.push(`${slowMovers.length} live menu items sold fewer than 5 units in the last 30 days.`);
  const topPair = pairings[0];
  if (topPair) briefing.push(`${topPair.firstItem} and ${topPair.secondItem} appeared together in ${topPair.orderCount} paid orders — a strong combo candidate.`);
  const lapsed = segments.find((segment) => segment.id === "lapsed");
  if (lapsed?.count) briefing.push(`${lapsed.count} returning customers have not visited in 30+ days; ${lapsed.optedInIds.length} are eligible for WhatsApp re-engagement.`);
  if (today.serviceRequests) briefing.push(`${today.serviceRequests} tables currently need service attention.`);
  if (waiterInsights.length >= 2 && waiterInsights[0].activeTables - waiterInsights.at(-1)!.activeTables >= 3) {
    briefing.push(`${waiterInsights[0].name} has ${waiterInsights[0].activeTables} active tables versus ${waiterInsights.at(-1)!.name}'s ${waiterInsights.at(-1)!.activeTables}; consider rebalancing.`);
  }
  if (peakHour) briefing.push(`The busiest historical hour is ${String(peakHour.hour).padStart(2, "0")}:00–${String((peakHour.hour + 1) % 24).padStart(2, "0")}:00 with ${peakHour.orders} paid orders in the last 90 days.`);
  if (feedback.lowRatingCount) briefing.push(`${feedback.lowRatingCount} low-rating experiences are still open for service recovery.`);

  return {
    generatedAt: now.toISOString(),
    today,
    previousDay,
    peakHour,
    menuPerformance,
    pairings,
    segments,
    waiterInsights,
    feedback,
    briefing,
  };
}

/** Aggregate-only recommendations for the public menu. No customer/order PII leaves the server. */
export async function getPublicMenuRecommendations(menuItems: MenuItem[]) {
  const supabase = createAdminClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const [{ data: orders }, { data: orderItems }] = await Promise.all([
    supabase
      .from("orders")
      .select("id")
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", ninetyDaysAgo),
    supabase.from("order_items").select("order_id, menu_item_id"),
  ]);
  const eligibleOrderIds = new Set((orders ?? []).map((order) => order.id));
  const pairings = buildPairings(orderItems ?? [], menuItems, eligibleOrderIds);
  const menuMap = new Map(menuItems.filter((item) => item.status === "live").map((item) => [item.id, item]));
  const result: Record<string, MenuItem[]> = {};

  for (const pairing of pairings) {
    if (pairing.orderCount < 2) continue;
    const firstList = result[pairing.firstItemId] ?? [];
    const second = menuMap.get(pairing.secondItemId);
    if (second && firstList.length < 3 && !firstList.some((item) => item.id === second.id)) firstList.push(second);
    result[pairing.firstItemId] = firstList;

    const secondList = result[pairing.secondItemId] ?? [];
    const first = menuMap.get(pairing.firstItemId);
    if (first && secondList.length < 3 && !secondList.some((item) => item.id === first.id)) secondList.push(first);
    result[pairing.secondItemId] = secondList;
  }

  return result;
}
