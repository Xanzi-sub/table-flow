import { createClient } from "@/lib/supabase/server";
import { listSpecials } from "@/app/actions/specials";
import { SpecialsManager } from "@/components/admin/SpecialsManager";

export default async function AdminSpecialsPage() {
  const supabase = await createClient();
  const [specials, { data: items }] = await Promise.all([
    listSpecials(),
    supabase
      .from("menu_items")
      .select("*")
      .neq("status", "archived")
      .order("name"),
  ]);

  return <SpecialsManager initialSpecials={specials} items={items ?? []} />;
}
