import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicMenuRecommendations } from "@/app/actions/intelligence";
import { CustomerMenuApp } from "@/components/customer/CustomerMenuApp";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ qr_identifier: string }> }): Promise<Metadata> {
  const { qr_identifier } = await params;
  return { manifest: `/menu/${qr_identifier}/manifest.webmanifest` };
}

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

  const [{ data: categories }, { data: items }, { data: groups }, { data: venue }, { data: waiterName }, { data: specials }] =
    await Promise.all([
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
      supabase
        .from("venue_settings")
        .select("name, logo_url, vat_percentage, tip_percentage, loyalty_reward_threshold, loyalty_reward_value")
        .maybeSingle(),
      supabase.rpc("get_table_waiter_name", { p_table_id: table.id }),
      supabase.from("menu_specials").select("*").eq("status", "live").order("sort_order"),
    ]);

  const menuItems = items ?? [];
  const recommendationsByItem = await getPublicMenuRecommendations(menuItems);

  return (
    <CustomerMenuApp
      table={table}
      categories={categories ?? []}
      items={menuItems}
      groups={groups ?? []}
      venueName={venue?.name ?? "TableFlow"}
      venueLogoUrl={venue?.logo_url ?? null}
      vatPercentage={venue?.vat_percentage ?? 15}
      tipPercentage={venue?.tip_percentage ?? 10}
      waiterName={waiterName ?? null}
      recommendationsByItem={recommendationsByItem}
      loyaltyRewardThreshold={venue?.loyalty_reward_threshold ?? 500}
      loyaltyRewardValue={venue?.loyalty_reward_value ?? 50}
      specials={specials ?? []}
    />
  );
}
