"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, getRequestIp, RateLimitError } from "@/lib/security";
import type { ActionResult } from "./tables";

export async function signInStaff(
  email: string,
  password: string
): Promise<ActionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || password.length < 1 || password.length > 1024) {
    return { success: false, error: "Invalid email or password" };
  }

  try {
    await enforceRateLimit({
      scope: "staff-login",
      identifier: `${await getRequestIp()}:${normalizedEmail}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof RateLimitError ? error.message : "Sign-in is temporarily unavailable",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) return { success: false, error: "Invalid email or password" };
  return { success: true };
}

export async function signOutStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
