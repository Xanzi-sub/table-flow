import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, RateLimitError, readJsonBody } from "@/lib/security";
import type { OrderStatus } from "@/types/database";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<OrderStatus>(["pending", "preparing", "served", "completed", "cancelled"]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("staff_profiles").select("id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { orderId?: string; status?: OrderStatus };
  try {
    body = await readJsonBody(request, 4_096);
    await enforceRateLimit({ scope: "order-status", identifier: user.id, limit: 300, windowSeconds: 60 * 60 });
  } catch (error) {
    const limited = error instanceof RateLimitError;
    return NextResponse.json({ error: limited ? "Too many updates" : "Invalid request" }, { status: limited ? 429 : 400 });
  }
  if (!body.orderId || !UUID_PATTERN.test(body.orderId) || !body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid order update" }, { status: 400 });
  }

  const { data: order, error } = await supabase.from("orders").update({ status: body.status }).eq("id", body.orderId).select("table_id").single();
  if (error || !order) return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 400 });

  if (body.status === "completed") {
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("table_id", order.table_id).in("status", ["pending", "preparing", "served"]);
    if (!count) await supabase.from("tables").update({ status: "vacant", current_waiter_id: null }).eq("id", order.table_id);
  }
  if (body.status === "cancelled") {
    after(async () => {
      await supabase.functions.invoke("send-staff-push", {
        body: { orderId: body.orderId, notificationType: "order_cancelled" },
      }).catch(() => {});
    });
  }

  return NextResponse.json({ success: true });
}
