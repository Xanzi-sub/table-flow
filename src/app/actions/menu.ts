"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";
import type { MenuItemStatus } from "@/types/database";

// ---------------- Category Groups (Food / Drinks / etc.) ----------------

export async function listCategoryGroups() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_category_groups")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function createCategoryGroup(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_category_groups").insert({ name });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function deleteCategoryGroup(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_category_groups").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

// ---------------- Categories ----------------

export async function createCategory(name: string, groupId?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_categories")
    .insert({ name, group_id: groupId ?? null });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function updateCategory(
  id: string,
  updates: { name?: string; is_active?: boolean; sort_order?: number; group_id?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_categories")
    .update(updates)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

// ---------------- Items ----------------

export interface MenuItemInput {
  categoryId: string | null;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  status?: MenuItemStatus;
}

export async function createMenuItem(
  input: MenuItemInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      image_url: input.imageUrl ?? null,
      status: input.status ?? "draft",
      source: "manual",
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message };
  revalidatePath("/admin/menu");
  return { success: true, data: { id: data.id } };
}

export async function updateMenuItem(
  id: string,
  updates: Partial<{
    category_id: string | null;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    status: MenuItemStatus;
    sort_order: number;
  }>
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  return { success: true };
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}

/** Persists a new item ordering within a category (drag-and-drop reorder). */
export async function reorderMenuItems(
  updates: { id: string; sort_order: number }[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const results = await Promise.all(
    updates.map((u) =>
      supabase.from("menu_items").update({ sort_order: u.sort_order }).eq("id", u.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { success: false, error: failed.error.message };
  revalidatePath("/admin/menu");
  return { success: true };
}
