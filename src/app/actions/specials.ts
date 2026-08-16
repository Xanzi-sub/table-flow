"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./tables";
import type {
  MenuItemStatus,
  MenuSpecial,
  MenuSpecialDiscountType,
  MenuSpecialKind,
} from "@/types/database";

export interface SpecialInput {
  name: string;
  description?: string;
  kind: MenuSpecialKind;
  itemIds: string[];
  discountType: MenuSpecialDiscountType;
  discountValue: number;
  applicableQuantity?: number;
  buyQuantity?: number;
  payQuantity?: number;
  status: MenuItemStatus;
  startsAt?: string;
  endsAt?: string;
}

function validateSpecial(input: SpecialInput): string | null {
  if (!input.name.trim()) return "Special name is required.";
  if (input.itemIds.length === 0) return "Select at least one menu item.";
  if (input.kind === "combo" && input.itemIds.length < 2) return "A paired combo needs at least two items.";
  if (input.discountValue < 0) return "Price or discount cannot be negative.";
  if ((input.applicableQuantity ?? 1) < 1) return "Applicable quantity must be at least 1.";
  if (input.discountType === "percentage" && input.discountValue > 100) return "Percentage cannot exceed 100%.";
  if (input.discountType === "quantity_deal") {
    const buy = input.buyQuantity ?? 1;
    const pay = input.payQuantity ?? 1;
    if (input.kind !== "item_discount") return "Quantity deals apply to individual menu items, not combos.";
    if (buy <= pay) return "Buy quantity must be greater than pay quantity.";
  }
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
    return "End date must be after the start date.";
  }
  return null;
}

function revalidateSpecials() {
  revalidatePath("/admin/specials");
  revalidatePath("/menu", "layout");
}

export async function listSpecials(): Promise<MenuSpecial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_specials")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function createSpecial(input: SpecialInput): Promise<ActionResult<{ special: MenuSpecial }>> {
  const validationError = validateSpecial(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("menu_specials")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      item_ids: input.itemIds,
      discount_type: input.kind === "combo" ? "fixed_price" : input.discountType,
      discount_value: input.discountValue,
      applicable_quantity:
        input.discountType === "quantity_deal" ? input.buyQuantity ?? 2 : input.applicableQuantity ?? 1,
      buy_quantity: input.discountType === "quantity_deal" ? input.buyQuantity ?? 2 : 1,
      pay_quantity: input.discountType === "quantity_deal" ? input.payQuantity ?? 1 : 1,
      status: input.status,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create special." };
  revalidateSpecials();
  return { success: true, data: { special: data } };
}

export async function updateSpecial(id: string, input: SpecialInput): Promise<ActionResult<{ special: MenuSpecial }>> {
  const validationError = validateSpecial(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_specials")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      item_ids: input.itemIds,
      discount_type: input.kind === "combo" ? "fixed_price" : input.discountType,
      discount_value: input.discountValue,
      applicable_quantity:
        input.discountType === "quantity_deal" ? input.buyQuantity ?? 2 : input.applicableQuantity ?? 1,
      buy_quantity: input.discountType === "quantity_deal" ? input.buyQuantity ?? 2 : 1,
      pay_quantity: input.discountType === "quantity_deal" ? input.payQuantity ?? 1 : 1,
      status: input.status,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not update special." };
  revalidateSpecials();
  return { success: true, data: { special: data } };
}

export async function archiveSpecial(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_specials").update({ status: "archived" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidateSpecials();
  return { success: true };
}

export async function deleteSpecial(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_specials").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidateSpecials();
  return { success: true };
}
