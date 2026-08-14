import { listStaff } from "@/app/actions/staff";
import { listInvites } from "@/app/actions/onboarding";
import { StaffManager } from "@/components/admin/StaffManager";

export default async function AdminStaffPage() {
  const [staff, invites] = await Promise.all([listStaff(), listInvites()]);
  return <StaffManager initialStaff={staff} initialInvites={invites} />;
}
