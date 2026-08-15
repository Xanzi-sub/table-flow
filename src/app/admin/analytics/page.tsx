import { getIntelligenceSnapshot } from "@/app/actions/intelligence";
import { IntelligenceDashboard } from "@/components/admin/IntelligenceDashboard";

export default async function AnalyticsPage() {
  const snapshot = await getIntelligenceSnapshot();
  return <IntelligenceDashboard snapshot={snapshot} />;
}
