import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVenueSettings } from "@/app/actions/onboarding";

// Zernio redirects here after the user finishes the WhatsApp/Meta embedded
// signup flow started from Settings, appending the connection details as
// query params: ?connected=whatsapp&profileId=xxx&accountId=xxx&username=...
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const connected = searchParams.get("connected");
  const accountId = searchParams.get("accountId");
  const profileId = searchParams.get("profileId");
  const username = searchParams.get("username");

  if (connected !== "whatsapp" || !accountId) {
    return NextResponse.redirect(`${origin}/admin/settings?whatsapp=error`);
  }

  const supabase = await createClient();
  const existing = await getVenueSettings();

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
