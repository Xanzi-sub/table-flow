// Supabase Edge Function: send-otp-whatsapp
// Wired up as Supabase Auth's "Send SMS Hook" (Authentication -> Hooks -> Send
// SMS hook, HTTP endpoint). Supabase calls this instead of a built-in SMS
// provider, so the login OTP is delivered over WhatsApp via Zernio instead of
// requiring a separate Twilio/MessageBird account.
//
// Prerequisites (cannot be done from code):
//   1. WhatsApp connected in /admin/settings (venue_settings.zendio_account_id set).
//   2. A Meta-APPROVED WhatsApp template in the "AUTHENTICATION" category on
//      that WABA (Meta requires this for business-initiated OTP messages —
//      review can take up to ~24h). Set its name via ZENDIO_OTP_TEMPLATE_NAME.
//   3. Supabase Dashboard -> Authentication -> Hooks -> Send SMS hook -> HTTP,
//      paste this function's URL, generate a secret, and set that secret here
//      as SEND_SMS_HOOK_SECRET (format "v1,whsec_...", the "v1,whsec_" prefix
//      is stripped below same as Supabase's own example).
//
// Deploy with: supabase functions deploy send-otp-whatsapp --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { createHash } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZENDIO_API_URL = Deno.env.get("ZENDIO_API_URL") ?? "https://zernio.com/api/v1";
const ZENDIO_API_KEY = Deno.env.get("ZENDIO_API_KEY")!;
const ZENDIO_OTP_TEMPLATE_NAME = Deno.env.get("ZENDIO_OTP_TEMPLATE_NAME") ?? "otp_verification";
const SEND_SMS_HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET")!;

async function zendioFetch(path: string, body: unknown) {
  const response = await fetch(`${ZENDIO_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZENDIO_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Zendio request to ${path} failed: ${await response.text()}`);
  return response.json();
}

Deno.serve(async (req: Request) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let verified: { user: { phone: string }; sms: { otp: string } };
  try {
    const secret = SEND_SMS_HOOK_SECRET.replace("v1,whsec_", "");
    verified = new Webhook(secret).verify(payload, headers) as typeof verified;
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 401, message: "Invalid hook signature" } }), {
      status: 401,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: venue } = await supabase
      .from("venue_settings")
      .select("zendio_account_id, zendio_profile_id")
      .maybeSingle();

    if (!venue?.zendio_account_id || !venue?.zendio_profile_id) {
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "WhatsApp is not connected in Settings yet." } }),
        { status: 400 }
      );
    }

    const phone = verified.user.phone.startsWith("+") ? verified.user.phone : `+${verified.user.phone}`;
    const identifierHash = createHash("sha256")
      .update(`${SUPABASE_SERVICE_ROLE_KEY}:${phone}`)
      .digest("hex");
    const { data: limit, error: limitError } = await supabase.rpc("consume_rate_limit", {
      p_scope: "whatsapp-otp",
      p_identifier_hash: identifierHash,
      p_limit: 3,
      p_window_seconds: 60 * 60,
    });
    if (limitError) throw new Error("OTP rate limiting is unavailable");
    if (!limit?.[0]?.allowed) {
      return new Response(
        JSON.stringify({ error: { http_code: 429, message: "Too many verification attempts. Try again later." } }),
        { status: 429, headers: { "Retry-After": String(limit?.[0]?.retry_after_seconds ?? 3600) } }
      );
    }

    // One-off "broadcast" of a single recipient — Zernio has no single-send
    // endpoint for templates, so this mirrors send-marketing-campaign's pattern.
    const { broadcast } = await zendioFetch("/broadcasts", {
      profileId: venue.zendio_profile_id,
      accountId: venue.zendio_account_id,
      platform: "whatsapp",
      name: `OTP ${phone} ${new Date().toISOString()}`,
      template: {
        name: ZENDIO_OTP_TEMPLATE_NAME,
        language: "en",
        components: [
          { type: "body", parameters: [{ type: "text", text: verified.sms.otp }] },
        ],
      },
    });

    await zendioFetch(`/broadcasts/${broadcast.id}/recipients`, { phones: [phone] });
    await zendioFetch(`/broadcasts/${broadcast.id}/send`, {});

    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err instanceof Error ? err.message : "OTP delivery failed");
    return new Response(JSON.stringify({ error: { http_code: 500, message: "OTP delivery failed" } }), { status: 500 });
  }
});
