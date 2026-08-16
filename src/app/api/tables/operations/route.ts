import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, RateLimitError, readJsonBody } from "@/lib/security";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: "reassign" | "resolve_service" | "claim"; tableId?: string; waiterId?: string | null };
  try {
    body = await readJsonBody(request, 4_096);
    await enforceRateLimit({ scope: "table-operation", identifier: user.id, limit: 300, windowSeconds: 60 * 60 });
  } catch (error) {
    const limited = error instanceof RateLimitError;
    return NextResponse.json({ error: limited ? "Too many updates" : "Invalid request" }, { status: limited ? 429 : 400 });
  }
  if (!body.tableId || !UUID_PATTERN.test(body.tableId)) return NextResponse.json({ error: "Invalid table" }, { status: 400 });

  if (body.action === "resolve_service") {
    const { error } = await supabase.rpc("resolve_table_service_requests", { p_table_id: body.tableId });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ success: true });
  }

  if (body.action === "claim") {
    if (profile.role !== "waiter") return NextResponse.json({ error: "Only waiters can claim tables" }, { status: 403 });
    const { data: table, error } = await supabase.rpc("claim_table_assignment", { p_table_id: body.tableId });
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ success: true, table });
  }

  if (body.action === "reassign") {
    if (profile.role === "waiter") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.waiterId !== null && body.waiterId !== undefined && !UUID_PATTERN.test(body.waiterId)) return NextResponse.json({ error: "Invalid waiter" }, { status: 400 });
    const waiterId = body.waiterId ?? null;
    const { error: tableError } = await supabase.from("tables").update({ current_waiter_id: waiterId }).eq("id", body.tableId);
    if (tableError) return NextResponse.json({ error: tableError.message }, { status: 400 });
    const { error: ordersError } = await supabase.from("orders").update({ waiter_id: waiterId }).eq("table_id", body.tableId).in("status", ["pending", "preparing", "served"]);
    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 400 });
    if (waiterId) {
      after(async () => {
        await supabase.functions.invoke("send-staff-push", {
          body: { tableId: body.tableId, notificationType: "table_assigned" },
        }).catch(() => {});
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
}
