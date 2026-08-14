import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerMenuApp } from "@/components/customer/CustomerMenuApp";

export default async function CustomerMenuPage({
  params,
}: {
  params: Promise<{ qr_identifier: string }>;
}) {
  const { qr_identifier } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("tables")
    .select("*")
    .eq("qr_identifier", qr_identifier)
    .single();

  if (!table) notFound();

  const [{ data: categories }, { data: items }, { data: groups }, { data: venue }] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("status", "live")
      .order("sort_order"),
    supabase.from("menu_category_groups").select("*").order("sort_order"),
    supabase.from("venue_settings").select("name, logo_url").maybeSingle(),
  ]);

  return (
    <CustomerMenuApp
      table={table}
      categories={categories ?? []}
      items={items ?? []}
      groups={groups ?? []}
      venueName={venue?.name ?? "TableFlow"}
      venueLogoUrl={venue?.logo_url ?? null}
    />
  );
}
