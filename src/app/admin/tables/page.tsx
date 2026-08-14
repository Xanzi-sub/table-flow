import { listTables } from "@/app/actions/tables";
import { getVenueSettings } from "@/app/actions/onboarding";
import { TableQrManager } from "@/components/admin/TableQrManager";

export default async function AdminTablesPage() {
  const [tables, venue] = await Promise.all([listTables(), getVenueSettings()]);
  return <TableQrManager initialTables={tables} venueName={venue?.name ?? "TableFlow"} />;
}
