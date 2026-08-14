import { createClient } from "@/lib/supabase/server";
import { MenuManager } from "@/components/admin/MenuManager";

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: items }, { data: groups }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order"),
    supabase.from("menu_items").select("*").order("sort_order"),
    supabase.from("menu_category_groups").select("*").order("sort_order"),
  ]);

  return (
    <MenuManager
      initialCategories={categories ?? []}
      initialItems={items ?? []}
      initialGroups={groups ?? []}
    />
  );
}
