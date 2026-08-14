import { listInvites } from "@/app/actions/onboarding";
import { InviteStaffStep } from "@/components/onboarding/InviteStaffStep";

export default async function OnboardingTeamPage() {
  const invites = (await listInvites()).filter((i) => i.role === "manager");

  return (
    <InviteStaffStep
      role="manager"
      stepLabel="Step 2 of 3"
      title="Add your manager(s)"
      description="Managers can edit the menu, run marketing, and view analytics."
      initialInvites={invites}
      nextHref="/onboarding/staff"
      nextLabel="Continue"
    />
  );
}
