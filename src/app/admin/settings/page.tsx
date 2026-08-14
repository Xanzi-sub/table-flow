import { Suspense } from "react";
import { getVenueSettings } from "@/app/actions/onboarding";
import { SettingsManager } from "@/components/admin/SettingsManager";

export default async function AdminSettingsPage() {
  const venue = await getVenueSettings();

  return (
    <Suspense fallback={null}>
      <SettingsManager venue={venue ?? null} />
    </Suspense>
  );
}
