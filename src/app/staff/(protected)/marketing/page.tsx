import { createClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/app/actions/marketing";
import { getVenueSettings } from "@/app/actions/onboarding";
import { MarketingComposer } from "@/components/staff/MarketingComposer";

export default async function MarketingPage() {
  const supabase = await createClient();
  const [campaigns, { count }, venue] = await Promise.all([
    listCampaigns(),
    supabase
      .from("customer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_opt_in", true),
    getVenueSettings(),
  ]);

  return (
    <MarketingComposer
      initialCampaigns={campaigns}
      optedInCount={count ?? 0}
      zendioAccountId={venue?.zendio_account_id ?? null}
      zendioAccountLabel={venue?.zendio_account_label ?? null}
    />
  );
}
