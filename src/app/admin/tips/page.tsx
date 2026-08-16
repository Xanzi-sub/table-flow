import { getVenueTipSummary, listAllCashoutRequests } from "@/app/actions/tips";
import { TipsCashoutManager } from "@/components/admin/TipsCashoutManager";

export default async function AdminTipsPage() {
  const [requests, summary] = await Promise.all([listAllCashoutRequests(), getVenueTipSummary()]);
  return <TipsCashoutManager initialRequests={requests as Parameters<typeof TipsCashoutManager>[0]["initialRequests"]} initialSummary={summary} />;
}
