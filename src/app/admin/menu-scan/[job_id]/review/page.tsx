import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewBoard } from "@/components/admin/ReviewBoard";

export default async function MenuScanReviewPage({
  params,
}: {
  params: Promise<{ job_id: string }>;
}) {
  const { job_id } = await params;
  const supabase = await createClient();

  const [{ data: job }, { data: items }, { data: categories }] = await Promise.all([
    supabase.from("menu_scan_jobs").select("*").eq("id", job_id).single(),
    supabase
      .from("menu_items")
      .select("*")
      .eq("scan_job_id", job_id)
      .order("created_at", { ascending: true }),
    supabase.from("menu_categories").select("*").order("sort_order"),
  ]);

  if (!job) notFound();

  return (
    <ReviewBoard job={job} initialItems={items ?? []} categories={categories ?? []} />
  );
}
