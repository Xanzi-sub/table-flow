import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffProfile } from "@/types/database";

export async function requireStaffProfile(): Promise<StaffProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/staff/login");

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/staff/login");

  return profile;
}
