"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./tables";
import type { UserRole } from "@/types/database";

/**
 * First-run only: turns the current auth user into the venue's sole admin.
 * Idempotent and safe to call after every signup/login — if a profile already
 * exists (for this user or anyone else) it's a no-op. This is what lets the
 * flow work whether or not Supabase Auth requires email confirmation: signup
 * may not have a session yet, so we finish the job on first successful login.
 */
export async function ensureBootstrap(): Promise<ActionResult<{ bootstrapped: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not signed in" };

  const { data: existingProfile } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) return { success: true, data: { bootstrapped: false } };

  // A plain client-side count() is RLS-filtered to rows this user can see —
  // and a brand-new user can't see ANY staff_profiles row yet (RLS: id =
  // auth.uid() or is_manager_or_admin()), so it would always read as empty.
  // This RPC bypasses that and reports the true state of the table.
  const { data: isEmpty } = await supabase.rpc("staff_profiles_is_empty");

  if (!isEmpty) {
    // Someone else is already the admin — this user must go through an invite.
    return { success: true, data: { bootstrapped: false } };
  }

  const fullName = (user.user_metadata?.full_name as string | undefined) || user.email || "Owner";

  const { error } = await supabase
    .from("staff_profiles")
    .insert({ id: user.id, full_name: fullName, role: "admin", email: user.email });

  if (error) {
    return {
      success: false,
      error: error.message.includes("row-level security")
        ? "An admin already exists for this venue."
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  return { success: true, data: { bootstrapped: true } };
}

export async function getVenueSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("venue_settings").select("*").maybeSingle();
  return data;
}

export async function saveVenueSettings(input: {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  vatPercentage?: number;
  tipPercentage?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const existing = await getVenueSettings();

  const payload = {
    name: input.name,
    logo_url: input.logoUrl ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    ...(input.vatPercentage !== undefined ? { vat_percentage: input.vatPercentage } : {}),
    ...(input.tipPercentage !== undefined ? { tip_percentage: input.tipPercentage } : {}),
  };

  const { error } = existing
    ? await supabase.from("venue_settings").update(payload).eq("id", existing.id)
    : await supabase.from("venue_settings").insert(payload);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

/** Pre-registers a manager/waiter by email — they claim it themselves at /staff/signup. */
export async function inviteStaff(input: {
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("staff_invites").insert({
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName,
    phone: input.phone ?? null,
    role: input.role,
    invited_by: user?.id ?? null,
  });

  if (error) {
    return {
      success: false,
      error: error.message.includes("duplicate")
        ? "That email has already been invited."
        : error.message,
    };
  }

  revalidatePath("/admin/staff");
  revalidatePath("/onboarding/staff");
  return { success: true };
}

export async function listInvites() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_invites")
    .select("*")
    .is("claimed_by", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteInvite(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("staff_invites").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/staff");
  return { success: true };
}

/**
 * Called right after a new auth user signs up on /staff/signup. Matches their
 * email against a pending staff_invites row and creates their staff_profiles
 * row — this is the "automatic detection/linking" for invited staff.
 */
export async function claimStaffInvite(): Promise<ActionResult<{ role: UserRole }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { success: false, error: "Not signed in" };

  const { data, error } = await supabase.rpc("claim_staff_invite", {
    p_user_id: user.id,
    p_email: user.email,
  });

  if (error || !data) {
    // No matching invite — remove the orphaned auth account so they can retry cleanly.
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
    await supabase.auth.signOut();
    return {
      success: false,
      error: "No staff invite found for this email. Ask your manager to add you first.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true, data: { role: data.role } };
}
