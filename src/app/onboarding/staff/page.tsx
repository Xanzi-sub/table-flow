import { listInvites } from "@/app/actions/onboarding";
import { InviteStaffStep } from "@/components/onboarding/InviteStaffStep";

export default async function OnboardingStaffPage() {
  const invites = (await listInvites()).filter((i) => i.role === "waiter");

  return (
    <InviteStaffStep
      role="waiter"
      stepLabel="Step 3 of 3"
      title="Add your waiters/staff"
      description="Waiters check in, get assigned tables, and settle orders."
      initialInvites={invites}
      nextHref="/staff/dashboard"
      nextLabel="Finish Setup"
    />
  );
}
