"use client";

import { useMemo, useState } from "react";
import {
  archiveSpecial,
  createSpecial,
  deleteSpecial,
  updateSpecial,
  type SpecialInput,
} from "@/app/actions/specials";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type {
  MenuItem,
  MenuItemStatus,
  MenuSpecial,
  MenuSpecialDiscountType,
  MenuSpecialKind,
} from "@/types/database";

interface FormState {
  name: string;
  description: string;
  kind: MenuSpecialKind;
  itemIds: string[];
  discountType: MenuSpecialDiscountType;
  discountValue: string;
  applicableQuantity: string;
  buyQuantity: string;
  payQuantity: string;
  status: MenuItemStatus;
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  kind: "item_discount",
  itemIds: [],
  discountType: "percentage",
  discountValue: "",
  applicableQuantity: "1",
  buyQuantity: "2",
  payQuantity: "1",
  status: "draft",
  startsAt: "",
  endsAt: "",
};

const STATUS_BADGE: Record<MenuItemStatus, string> = {
  draft: "badge-warning",
  live: "badge-success",
  archived: "badge-neutral",
};

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toInput(form: FormState): SpecialInput {
  return {
    name: form.name,
    description: form.description,
    kind: form.kind,
    itemIds: form.itemIds,
    discountType: form.kind === "combo" ? "fixed_price" : form.discountType,
    discountValue: form.discountType === "quantity_deal" ? 0 : Number(form.discountValue),
    applicableQuantity: Number(form.applicableQuantity),
    buyQuantity: Number(form.buyQuantity),
    payQuantity: Number(form.payQuantity),
    status: form.status,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
  };
}

function specialToForm(special: MenuSpecial): FormState {
  return {
    name: special.name,
    description: special.description ?? "",
    kind: special.kind,
    itemIds: special.item_ids,
    discountType: special.discount_type,
    discountValue: special.discount_value.toString(),
    applicableQuantity: special.applicable_quantity.toString(),
    buyQuantity: special.buy_quantity.toString(),
    payQuantity: special.pay_quantity.toString(),
    status: special.status,
    startsAt: toLocalInput(special.starts_at),
    endsAt: toLocalInput(special.ends_at),
  };
}

export function SpecialsManager({
  initialSpecials,
  items,
}: {
  initialSpecials: MenuSpecial[];
  items: MenuItem[];
}) {
  const [specials, setSpecials] = useState(initialSpecials);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuSpecial | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? items.filter((item) => item.name.toLowerCase().includes(query)) : items;
  }, [items, search]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSearch("");
    setError(null);
  }

  function toggleItem(itemId: string) {
    setForm((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = toInput(form);
      const result = editingId ? await updateSpecial(editingId, input) : await createSpecial(input);

      if (!result.success || !result.data) {
        setError(result.error ?? "Could not save special.");
        return;
      }

      setSpecials((current) =>
        editingId
          ? current.map((special) => (special.id === editingId ? result.data!.special : special))
          : [result.data!.special, ...current]
      );
      resetForm();
    } catch {
      setError("The app was updated while this page was open. Refresh this page and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(special: MenuSpecial) {
    try {
      const result = await archiveSpecial(special.id);
      if (!result.success) {
        setError(result.error ?? "Could not archive special.");
        return;
      }
      setSpecials((current) =>
        current.map((entry) => (entry.id === special.id ? { ...entry, status: "archived" } : entry))
      );
    } catch {
      setError("The app was updated while this page was open. Refresh this page and try again.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteSpecial(deleteTarget.id);
      if (!result.success) {
        setError(result.error ?? "Could not delete special.");
        return;
      }
      setSpecials((current) => current.filter((special) => special.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("The app was updated while this page was open. Refresh this page and try again.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedItems = form.itemIds.map((id) => itemMap.get(id)).filter((item): item is MenuItem => Boolean(item));
  const originalComboTotal = selectedItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <div>
      <PageHeader
        title="Specials"
        description="Create item discounts and paired combos, schedule visibility, and control lifecycle."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleSave} className="card self-start p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                {editingId ? "Edit special" : "Create special"}
              </h2>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Customer prices are revalidated on the server at checkout.
              </p>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn btn-secondary !py-1 !text-xs">
                Cancel edit
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-600)]">
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, kind: "item_discount", itemIds: [] }))}
              className={`btn ${form.kind === "item_discount" ? "btn-primary" : "btn-secondary"}`}
            >
              Item discount
            </button>
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({ ...current, kind: "combo", discountType: "fixed_price", itemIds: [] }))
              }
              className={`btn ${form.kind === "combo" ? "btn-primary" : "btn-secondary"}`}
            >
              Paired combo
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="text-sm">
              <span className="label">Name</span>
              <input
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="input"
                placeholder={form.kind === "combo" ? "Burger + Chips Combo" : "Happy Hour Drinks"}
              />
            </label>
            <label className="text-sm">
              <span className="label">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="input"
                placeholder="Shown to guests on the menu"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              {form.kind === "item_discount" && (
                <label className="text-sm">
                  <span className="label">Price rule</span>
                  <Select
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountType: event.target.value as MenuSpecialDiscountType,
                      }))
                    }
                  >
                    <option value="percentage">Percentage off</option>
                    <option value="fixed_price">Special price</option>
                    <option value="quantity_deal">Buy X, pay for Y</option>
                  </Select>
                </label>
              )}
              {form.discountType === "quantity_deal" && form.kind === "item_discount" ? (
                <div className="col-span-2 grid grid-cols-2 gap-3 rounded-md border border-[var(--border)] bg-[var(--gray-25)] p-3">
                  <label className="text-sm">
                    <span className="label">Customer buys</span>
                    <input
                      required
                      type="number"
                      min={2}
                      step="1"
                      value={form.buyQuantity}
                      onChange={(event) => setForm((current) => ({ ...current, buyQuantity: event.target.value }))}
                      className="input"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="label">Customer pays for</span>
                    <input
                      required
                      type="number"
                      min={1}
                      step="1"
                      value={form.payQuantity}
                      onChange={(event) => setForm((current) => ({ ...current, payQuantity: event.target.value }))}
                      className="input"
                    />
                  </label>
                  <p className="col-span-2 text-xs text-[var(--foreground-muted)]">
                    Example: buy 2 and pay for 1. Extra units outside a complete group are charged normally.
                  </p>
                </div>
              ) : (
                <>
                  <label className={`text-sm ${form.kind === "combo" ? "col-span-2" : ""}`}>
                    <span className="label">
                      {form.kind === "combo" || form.discountType === "fixed_price" ? "Package price (R)" : "Discount (%)"}
                    </span>
                    <input
                      required
                      type="number"
                      min={0}
                      max={form.discountType === "percentage" ? 100 : undefined}
                      step="0.01"
                      value={form.discountValue}
                      onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                      className="input"
                    />
                  </label>
                  {form.kind === "item_discount" && (
                    <label className="text-sm">
                      <span className="label">
                        {form.discountType === "fixed_price" ? "Items in each package" : "Applies from quantity"}
                      </span>
                      <input
                        required
                        type="number"
                        min={1}
                        step="1"
                        value={form.applicableQuantity}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, applicableQuantity: event.target.value }))
                        }
                        className="input"
                      />
                    </label>
                  )}
                  {form.kind === "item_discount" && (
                    <p className="col-span-2 text-xs text-[var(--foreground-muted)]">
                      {form.discountType === "fixed_price"
                        ? `Example: ${form.applicableQuantity || "2"} selected items for ${formatCurrency(Number(form.discountValue) || 0)}. Extra items are charged normally.`
                        : `The percentage starts only when the customer orders at least ${form.applicableQuantity || "1"}.`}
                    </p>
                  )}
                </>
              )}
            </div>

            <label className="text-sm">
              <span className="label">Menu visibility</span>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as MenuItemStatus }))
                }
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="archived">Archived</option>
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="label">Starts (optional)</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  className="input"
                />
              </label>
              <label className="text-sm">
                <span className="label">Ends (optional)</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                  className="input"
                />
              </label>
            </div>

            <div>
              <span className="label">
                {form.kind === "combo" ? "Combo items (select at least 2)" : "Discounted items"}
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input"
                placeholder="Search menu items"
              />
              <div className="mt-2 max-h-56 overflow-y-auto border border-[var(--border)] bg-white p-2">
                {filteredItems.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--border)] px-2 py-2 last:border-0 hover:bg-[var(--gray-50)]">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[var(--foreground)]">{item.name}</span>
                      <span className="text-[10px] text-[var(--foreground-muted)]">{formatCurrency(item.price)}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.itemIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                {selectedItems.length} selected
                {form.kind === "combo" && selectedItems.length > 0
                  ? ` · normal total ${formatCurrency(originalComboTotal)}`
                  : ""}
              </p>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary mt-4 w-full">
            {saving ? "Saving…" : editingId ? "Save changes" : "Create special"}
          </button>
        </form>

        <div className="flex flex-col gap-3">
          {specials.map((special) => {
            const specialItems = special.item_ids
              .map((id) => itemMap.get(id))
              .filter((item): item is MenuItem => Boolean(item));
            return (
              <article key={special.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--foreground)]">{special.name}</h3>
                      <span className={`badge ${STATUS_BADGE[special.status]}`}>{special.status}</span>
                      <span className="badge badge-accent">
                        {special.kind === "combo" ? "Paired combo" : "Item discount"}
                      </span>
                    </div>
                    {special.description && (
                      <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">{special.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {special.discount_type === "percentage"
                        ? `${special.discount_value}% off from ${special.applicable_quantity}`
                        : special.discount_type === "quantity_deal"
                          ? `Buy ${special.buy_quantity}, pay for ${special.pay_quantity}`
                          : `${special.applicable_quantity} for ${formatCurrency(special.discount_value)}`}
                    </p>
                    {special.kind === "combo" && (
                      <p className="text-[10px] text-[var(--foreground-muted)]">
                        Regular {formatCurrency(specialItems.reduce((sum, item) => sum + item.price, 0))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {specialItems.map((item) => (
                    <span key={item.id} className="rounded-full bg-[var(--gray-100)] px-2.5 py-1 text-[10px] font-semibold text-[var(--gray-700)]">
                      {item.name}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <p className="text-[10px] text-[var(--foreground-muted)]">
                    {special.starts_at ? `From ${formatDateTime(special.starts_at)}` : "Starts immediately"}
                    {special.ends_at ? ` · until ${formatDateTime(special.ends_at)}` : " · no end date"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(special.id);
                        setForm(specialToForm(special));
                        setError(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="btn btn-secondary !py-1 !text-xs"
                    >
                      Edit
                    </button>
                    {special.status !== "archived" && (
                      <button onClick={() => handleArchive(special)} className="btn btn-secondary !py-1 !text-xs">
                        Archive
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget(special)} className="btn btn-danger !py-1 !text-xs">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {specials.length === 0 && (
            <div className="card p-10 text-center text-sm text-[var(--foreground-muted)]">
              No specials yet. Create an item discount or paired combo to get started.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name ?? "special"}?`}
        description="This removes it permanently. Historical order lines keep their special name for audit purposes."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
