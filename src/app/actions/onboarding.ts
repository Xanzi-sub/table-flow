"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./tables";
import type { UserRole } from "@/types/database";
import { enforceRateLimit, RateLimitError } from "@/lib/security";

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
  loyaltyPointsPerRand?: number;
  loyaltyRewardThreshold?: number;
  loyaltyRewardValue?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };
  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "waiter") return { success: false, error: "Unauthorized" };
  if (
    !input.name.trim() || input.name.length > 200 ||
    (input.address?.length ?? 0) > 500 || (input.phone?.length ?? 0) > 50 ||
    [input.vatPercentage, input.tipPercentage].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) ||
    input.loyaltyPointsPerRand !== undefined && (!Number.isFinite(input.loyaltyPointsPerRand) || input.loyaltyPointsPerRand < 0 || input.loyaltyPointsPerRand > 1000) ||
    input.loyaltyRewardThreshold !== undefined && (!Number.isInteger(input.loyaltyRewardThreshold) || input.loyaltyRewardThreshold < 1 || input.loyaltyRewardThreshold > 1000000) ||
    input.loyaltyRewardValue !== undefined && (!Number.isFinite(input.loyaltyRewardValue) || input.loyaltyRewardValue < 0 || input.loyaltyRewardValue > 1000000)
  ) return { success: false, error: "Invalid venue settings" };
  const existing = await getVenueSettings();

  const payload = {
    name: input.name,
    logo_url: input.logoUrl ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    ...(input.vatPercentage !== undefined ? { vat_percentage: input.vatPercentage } : {}),
    ...(input.tipPercentage !== undefined ? { tip_percentage: input.tipPercentage } : {}),
    ...(input.loyaltyPointsPerRand !== undefined ? { loyalty_points_per_rand: input.loyaltyPointsPerRand } : {}),
    ...(input.loyaltyRewardThreshold !== undefined ? { loyalty_reward_threshold: input.loyaltyRewardThreshold } : {}),
    ...(input.loyaltyRewardValue !== undefined ? { loyalty_reward_value: input.loyaltyRewardValue } : {}),
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
  if (!user) return { success: false, error: "Unauthorized" };
  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "waiter" || input.role === "admin" || (profile.role === "manager" && input.role !== "waiter")) {
    return { success: false, error: "Unauthorized" };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 320 || !input.fullName.trim() || input.fullName.length > 200 || (input.phone?.length ?? 0) > 50) {
    return { success: false, error: "Invalid staff invite" };
  }
  try {
    await enforceRateLimit({ scope: "staff-invite", identifier: user.id, limit: 50, windowSeconds: 24 * 60 * 60 });
  } catch (error) {
    return { success: false, error: error instanceof RateLimitError ? error.message : "Invites are temporarily unavailable" };
  }

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
