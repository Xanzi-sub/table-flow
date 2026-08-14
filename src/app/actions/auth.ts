"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";

export async function signInStaff(
  email: string,
  password: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOutStaff() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
