import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, RateLimitError, readJsonBody } from "@/lib/security";
import type { PaymentMethod } from "@/types/database";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "speedpoint"]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { orderId?: string; method?: PaymentMethod; tipAmount?: number };
  try {
    body = await readJsonBody(request, 4_096);
    await enforceRateLimit({
      scope: "record-order-payment",
      identifier: user.id,
      limit: 120,
      windowSeconds: 60 * 60,
    });
  } catch (error) {
    const limited = error instanceof RateLimitError;
    return NextResponse.json(
      { error: limited ? "Too many payment updates" : error instanceof Error ? error.message : "Invalid request" },
      { status: limited ? 429 : 400, headers: limited ? { "Retry-After": String(error.retryAfter) } : undefined }
    );
  }

  const tipAmount = Number(body.tipAmount ?? 0);
  if (
    !body.orderId ||
    !UUID_PATTERN.test(body.orderId) ||
    !body.method ||
    !PAYMENT_METHODS.has(body.method) ||
    !Number.isFinite(tipAmount) ||
    tipAmount < 0 ||
    tipAmount > 1_000_000
  ) {
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }

  const { error } = await supabase.rpc("mark_order_paid_with_loyalty", {
    p_order_id: body.orderId,
    p_method: body.method,
    p_tip_amount: tipAmount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
