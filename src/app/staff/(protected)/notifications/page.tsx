import { requireStaffProfile } from "@/lib/get-staff-profile";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffNotificationCentre } from "@/components/staff/StaffNotifications";

export default async function StaffNotificationsPage() {
  const profile = await requireStaffProfile();

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="New orders, table assignments and customer requests remain here until you have handled them."
      />
      <StaffNotificationCentre staffId={profile.id} />
    </div>
  );
}
