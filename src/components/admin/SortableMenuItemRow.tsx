"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { MenuCategory, MenuItem, MenuItemStatus } from "@/types/database";
import { updateMenuItem, deleteMenuItem } from "@/app/actions/menu";
import { Select } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/utils";

const STATUS_BADGE: Record<MenuItemStatus, string> = {
  draft: "badge-neutral",
  live: "badge-success",
  archived: "badge-danger",
};

export function SortableMenuItemRow({
  item,
  categories,
  onChanged,
  onDeleted,
}: {
  item: MenuItem;
  categories: MenuCategory[];
  onChanged: (item: MenuItem) => void;
  onDeleted: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price.toString());
  const [description, setDescription] = useState(item.description ?? "");
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleStatusChange(status: MenuItemStatus) {
    const result = await updateMenuItem(item.id, { status });
    if (result.success) onChanged({ ...item, status });
  }

  async function handleSave() {
    const result = await updateMenuItem(item.id, {
      name,
      price: Number(price),
      description: description || null,
      category_id: categoryId || null,
    });
    if (result.success) {
      onChanged({
        ...item,
        name,
        price: Number(price),
        description: description || null,
        category_id: categoryId || null,
      });
      setEditing(false);
    }
  }

  async function handleDelete() {
    const result = await deleteMenuItem(item.id);
    if (result.success) onDeleted(item.id);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card flex flex-col gap-2 p-3"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="drag-handle"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        {!editing ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                {item.name}
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">{formatCurrency(item.price)}</p>
            </div>
            <select
              value={item.status}
              onChange={(e) => handleStatusChange(e.target.value as MenuItemStatus)}
              className={`badge ${STATUS_BADGE[item.status]} cursor-pointer border-0`}
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => setEditing(true)}
              className="btn btn-ghost !px-2 !py-1 text-xs"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="btn btn-ghost !text-[var(--danger-600)] !px-2 !py-1 text-xs"
            >
              Delete
            </button>
          </>
        ) : (
          <div className="grid flex-1 gap-2 sm:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input !py-1.5"
            />
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input !py-1.5"
            />
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="!py-1.5 !text-sm"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={1}
              className="input sm:col-span-4"
            />
            <div className="flex gap-2 sm:col-span-4">
              <button
                onClick={handleSave}
                className="btn btn-primary flex-1 !py-1.5 !text-xs"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="btn btn-secondary flex-1 !py-1.5 !text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {!editing && item.description && (
        <p className="pl-7 text-xs text-[var(--foreground-muted)]">{item.description}</p>
      )}
    </div>
  );
}
