import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError, readJsonBody } from "@/lib/security";
import type { TipCashoutStatus } from "@/types/database";
import { getVenueTipSummary } from "@/app/actions/tips";

const VALID_STATUSES = new Set<TipCashoutStatus>(["pending", "scheduled", "approved", "rejected"]);

async function requireManagerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "waiter") return null;
  return { user, supabase };
}

export async function GET() {
  const auth = await requireManagerOrAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await enforceRateLimit({ scope: "cashout-read", identifier: auth.user.id, limit: 120, windowSeconds: 60 });
  } catch (error) {
    const retryAfter = error instanceof RateLimitError ? error.retryAfter : 60;
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const admin = createAdminClient();
  const [{ data: requests, error }, { data: staff }] = await Promise.all([
    admin.from("tip_cashout_requests").select("*").order("requested_at", { ascending: false }),
    admin.from("staff_profiles").select("id, full_name"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map((staff ?? []).map((member) => [member.id, member.full_name]));

  const mappedRequests = (requests ?? []).map((request) => ({
      ...request,
      staff_profiles: { full_name: names.get(request.waiter_id) ?? "Staff member" },
    }));
  const summary = await getVenueTipSummary();

  return NextResponse.json({ requests: mappedRequests, summary });
}

export async function PATCH(request: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    requestId?: string;
    status?: TipCashoutStatus;
    scheduledFor?: string;
    notes?: string;
  };
  try {
    body = await readJsonBody(request, 8_192);
    await enforceRateLimit({ scope: "cashout-update", identifier: auth.user.id, limit: 40, windowSeconds: 60 * 60 });
  } catch (error) {
    const limited = error instanceof RateLimitError;
    return NextResponse.json(
      { error: limited ? "Too many requests" : error instanceof Error ? error.message : "Invalid request" },
      { status: limited ? 429 : 400, headers: limited ? { "Retry-After": String(error.retryAfter) } : undefined }
    );
  }

  if (!body.requestId || !body.status || !VALID_STATUSES.has(body.status) || (body.notes?.length ?? 0) > 2000) {
    return NextResponse.json({ error: "Invalid cash-out update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tip_cashout_requests")
    .update({
      status: body.status,
      scheduled_for: body.status === "scheduled" ? body.scheduledFor ?? null : null,
      notes: body.notes?.trim() || null,
      resolved_at: body.status === "pending" ? null : new Date().toISOString(),
      resolved_by: auth.user.id,
    })
    .eq("id", body.requestId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "rejected") {
    const { error: unlinkError } = await admin
      .from("orders")
      .update({ tip_cashout_request_id: null })
      .eq("tip_cashout_request_id", body.requestId);
    if (unlinkError) return NextResponse.json({ error: unlinkError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
