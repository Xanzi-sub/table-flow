import { requireStaffProfile } from "@/lib/get-staff-profile";
import { getWaiterTipSummary, listMyCashoutRequests } from "@/app/actions/tips";
import { WaiterTipsManager } from "@/components/staff/WaiterTipsManager";

export default async function StaffTipsPage() {
  const profile = await requireStaffProfile();
  const [summary, requests] = await Promise.all([
    getWaiterTipSummary(profile.id),
    listMyCashoutRequests(profile.id),
  ]);

  return <WaiterTipsManager waiterId={profile.id} initialSummary={summary} initialRequests={requests} />;
}
