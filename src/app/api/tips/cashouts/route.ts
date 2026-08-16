import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipCashoutStatus } from "@/types/database";

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

  const admin = createAdminClient();
  const [{ data: requests, error }, { data: staff }] = await Promise.all([
    admin.from("tip_cashout_requests").select("*").order("requested_at", { ascending: false }),
    admin.from("staff_profiles").select("id, full_name"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map((staff ?? []).map((member) => [member.id, member.full_name]));

  return NextResponse.json(
    (requests ?? []).map((request) => ({
      ...request,
      staff_profiles: { full_name: names.get(request.waiter_id) ?? "Staff member" },
    }))
  );
}

export async function PATCH(request: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    requestId?: string;
    status?: TipCashoutStatus;
    scheduledFor?: string;
    notes?: string;
  };

  if (!body.requestId || !body.status || !VALID_STATUSES.has(body.status)) {
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
