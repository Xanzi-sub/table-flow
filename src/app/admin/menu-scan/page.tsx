import { createClient } from "@/lib/supabase/server";
import { MenuScanBoard } from "@/components/admin/MenuScanBoard";

export default async function MenuScanPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("menu_scan_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  return <MenuScanBoard initialJobs={jobs ?? []} />;
}
