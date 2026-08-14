import { createClient } from "@/lib/supabase/server";
import { listCheckedInWaiters } from "@/app/actions/tables";
import { AssignTableForm } from "@/components/staff/AssignTableForm";

export default async function AssignTablePage({
  params,
}: {
  params: Promise<{ qr_identifier: string }>;
}) {
  const { qr_identifier } = await params;
  const supabase = await createClient();

  const [{ data: existingTable }, waiters] = await Promise.all([
    supabase.from("tables").select("*").eq("qr_identifier", qr_identifier).maybeSingle(),
    listCheckedInWaiters(),
  ]);

  return (
    <AssignTableForm
      qrIdentifier={qr_identifier}
      existingTable={existingTable ?? null}
      waiters={waiters}
    />
  );
}
