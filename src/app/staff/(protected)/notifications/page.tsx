import { requireStaffProfile } from "@/lib/get-staff-profile";
import { getVenueSettings } from "@/app/actions/onboarding";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffNotificationCentre } from "@/components/staff/StaffNotifications";

export default async function StaffNotificationsPage() {
  const [profile, venue] = await Promise.all([requireStaffProfile(), getVenueSettings()]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="New orders, table assignments and customer requests remain here until you have handled them."
      />
      <StaffNotificationCentre staffId={profile.id} venueId={venue?.id} />
    </div>
  );
}
