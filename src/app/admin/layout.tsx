import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { requireStaffProfile } from "@/lib/get-staff-profile";
import { getVenueSettings } from "@/app/actions/onboarding";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaffProfile();
  const venue = await getVenueSettings();

  if (profile.role === "waiter") redirect("/staff/dashboard");

  return (
    <StaffShell
      role={profile.role}
      fullName={profile.full_name}
      staffId={profile.id}
      isCheckedIn={profile.is_checked_in}
      venueName={venue?.name}
      venueLogoUrl={venue?.logo_url}
    >
      {children}
    </StaffShell>
  );
}
