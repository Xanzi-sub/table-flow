import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVenueSettings } from "@/app/actions/onboarding";
import { enforceRateLimit, getRequestIpFromHeaders, trustedSiteOrigin } from "@/lib/security";

// Zernio redirects here after the user finishes the WhatsApp/Meta embedded
// signup flow started from Settings, appending the connection details as
// query params: ?connected=whatsapp&profileId=xxx&accountId=xxx&username=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = trustedSiteOrigin(request);
  const connected = searchParams.get("connected");
  const accountId = searchParams.get("accountId");
  const profileId = searchParams.get("profileId");
  const username = searchParams.get("username");

  if (
    connected !== "whatsapp" ||
    !accountId ||
    accountId.length > 200 ||
    (profileId?.length ?? 0) > 200 ||
    (username?.length ?? 0) > 200
  ) {
    return NextResponse.redirect(`${origin}/admin/settings?whatsapp=error`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/staff/login`);
  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "waiter") {
    return NextResponse.redirect(`${origin}/staff/dashboard`);
  }

  try {
    await enforceRateLimit({
      scope: "zendio-callback",
      identifier: `${user.id}:${getRequestIpFromHeaders(request.headers)}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });
  } catch {
    return NextResponse.redirect(`${origin}/admin/settings?whatsapp=error`);
  }

  const existing = await getVenueSettings();
  if (!profileId || !existing?.zendio_profile_id || profileId !== existing.zendio_profile_id) {
    return NextResponse.redirect(`${origin}/admin/settings?whatsapp=error`);
  }

  const payload = {
    zendio_account_id: accountId,
    zendio_account_label: username ?? "WhatsApp",
    ...(profileId ? { zendio_profile_id: profileId } : {}),
  };

  const { error } = existing
    ? await supabase.from("venue_settings").update(payload).eq("id", existing.id)
    : await supabase.from("venue_settings").insert({ name: "My Venue", ...payload });

  if (error) {
    return NextResponse.redirect(`${origin}/admin/settings?whatsapp=error`);
  }

  return NextResponse.redirect(`${origin}/admin/settings?whatsapp=connected`);
}
