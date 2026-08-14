import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBootstrap, claimStaffInvite } from "@/app/actions/onboarding";

// Handles the redirect Supabase sends after a user confirms their email
// (?code=...) or when confirmation fails (?error=...). Must be added to the
// project's Auth → URL Configuration → Redirect URLs allowlist.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/staff/login?error=${encodeURIComponent(error)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/staff/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // A session now exists — finish whichever signup this was: the very
    // first admin, or an invited manager/waiter claiming their invite.
    const bootstrap = await ensureBootstrap();
    if (bootstrap.success && bootstrap.data?.bootstrapped) {
      return NextResponse.redirect(`${origin}/onboarding/venue`);
    }

    const claim = await claimStaffInvite();
    if (claim.success) {
      return NextResponse.redirect(
        `${origin}/${claim.data?.role === "waiter" ? "staff/dashboard" : "admin/menu"}`
      );
    }

    return NextResponse.redirect(`${origin}/staff/login?confirmed=1`);
  }

  return NextResponse.redirect(`${origin}/staff/login`);
}

