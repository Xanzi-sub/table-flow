import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // ---- QR sticker resolution: /q/[qr_identifier] ----
  if (pathname.startsWith("/q/")) {
    const qrIdentifier = pathname.split("/")[2];
    if (!qrIdentifier) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (user) {
      const { data: profile } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // Binding/creating a table is a manager/admin-only task — a waiter
      // scanning an unbound sticker has nothing to do there.
      if (profile?.role === "manager" || profile?.role === "admin") {
        url.pathname = `/staff/assign-table/${qrIdentifier}`;
        return NextResponse.redirect(url);
      }

      if (profile?.role === "waiter") {
        url.pathname = "/staff/dashboard";
        return NextResponse.redirect(url);
      }
    }

    url.pathname = `/menu/${qrIdentifier}`;
    return NextResponse.redirect(url);
  }

  // ---- Onboarding requires a signed-in user, but not yet a staff_profiles row ----
  if (pathname.startsWith("/onboarding")) {
    if (!user) {
      url.pathname = "/signup";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ---- Staff/admin surfaces require an authenticated staff account ----
  if (pathname.startsWith("/staff/") || pathname.startsWith("/admin")) {
    if (pathname.startsWith("/staff/login") || pathname.startsWith("/staff/signup")) {
      return response;
    }

    if (!user) {
      url.pathname = "/staff/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Only /admin needs the extra round-trip (to block waiters) — plain
    // /staff pages just need an authenticated user; the protected layout's
    // requireStaffProfile() already re-verifies the profile exists.
    if (pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        url.pathname = "/staff/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }

      if (profile.role === "waiter") {
        url.pathname = "/staff/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
