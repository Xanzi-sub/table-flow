"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./tables";
import type { UserRole } from "@/types/database";

async function assertManagerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "waiter") {
    throw new Error("Only managers/admins can manage staff");
  }
}

export async function listStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("*")
    .order("full_name");
  return data ?? [];
}

export async function updateStaffRole(
  id: string,
  role: UserRole
): Promise<ActionResult> {
  try {
    await assertManagerOrAdmin();
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_profiles").update({ role }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/staff");
  return { success: true };
}

export async function updateStaffName(id: string, fullName: string): Promise<ActionResult> {
  try {
    await assertManagerOrAdmin();
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const name = fullName.trim();
  if (!name || name.includes("@")) {
    return { success: false, error: "Enter the staff member's name, not an email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_profiles").update({ full_name: name }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/staff");
  revalidatePath("/staff/dashboard");
  return { success: true };
}

export async function removeStaffMember(id: string): Promise<ActionResult> {
  try {
    await assertManagerOrAdmin();
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/staff");
  return { success: true };
}
