import { StaffShell } from "@/components/staff/StaffShell";
import { requireStaffProfile } from "@/lib/get-staff-profile";
import { getVenueSettings } from "@/app/actions/onboarding";

export default async function StaffProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, venue] = await Promise.all([requireStaffProfile(), getVenueSettings()]);

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
