import { createClient } from "@/lib/supabase/server";
import { requireStaffProfile } from "@/lib/get-staff-profile";
import { StaffDashboard } from "@/components/staff/StaffDashboard";

export default async function StaffDashboardPage() {
  const profile = await requireStaffProfile();
  const supabase = await createClient();

  const [{ data: tables }, { data: orders }, { data: waiters }] = await Promise.all([
    supabase.from("tables").select("*").order("table_number"),
    supabase
      .from("orders")
      .select("*")
      .in("status", ["pending", "preparing", "served"]),
    supabase.from("staff_profiles").select("id, full_name, role, is_checked_in"),
  ]);

  const waiterNames = Object.fromEntries(
    (waiters ?? []).map((w) => [w.id, w.full_name])
  );
  const waiterOptions = (waiters ?? []).filter((w) => w.role === "waiter");

  return (
    <StaffDashboard
      profile={profile}
      initialTables={tables ?? []}
      initialOrders={orders ?? []}
      waiterNames={waiterNames}
      waiters={waiterOptions}
    />
  );
}
