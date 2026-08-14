"use client";

import { useState } from "react";
import { updateDraftItem, deleteDraftItem } from "@/app/actions/scan";
import { Select } from "@/components/ui/Select";
import type { MenuCategory, MenuItem } from "@/types/database";

export interface ScanCrop {
  imageUrl: string;
  x: number; // 0-1 relative
  y: number;
  width: number;
  height: number;
}

export function ReviewItemCard({
  item,
  crop,
  categories,
  onRemoved,
}: {
  item: MenuItem;
  crop: ScanCrop | null;
  categories: MenuCategory[];
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(item.price.toString());
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowConfidence =
    item.scan_confidence !== null && item.scan_confidence < 0.7;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateDraftItem(item.id, {
      name,
      description: description || null,
      price: Number(price),
      category_id: categoryId || null,
    });
    setSaving(false);
    if (!result.success) setError(result.error ?? "Could not save");
  }

  async function handleDelete() {
    await deleteDraftItem(item.id);
    onRemoved(item.id);
  }

  return (
    <div
      className={`card flex flex-col gap-4 p-4 sm:flex-row ${
        lowConfidence ? "border-[var(--warning-500)] ring-1 ring-[var(--warning-500)]/30" : ""
      }`}
    >
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md bg-[var(--gray-100)] sm:w-40">
        {crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary crop transform, not compatible with next/image sizing
          <img
            src={crop.imageUrl}
            alt={item.name}
            className="absolute max-w-none"
            style={{
              width: `${(1 / crop.width) * 100}%`,
              height: `${(1 / crop.height) * 100}%`,
              left: `${-(crop.x / crop.width) * 100}%`,
              top: `${-(crop.y / crop.height) * 100}%`,
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            📝
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          {lowConfidence && (
            <span className="badge badge-warning">Low confidence — double check</span>
          )}
          {item.scan_confidence !== null && (
            <span className="ml-auto text-xs text-[var(--foreground-muted)]">
              {Math.round(item.scan_confidence * 100)}% confidence
            </span>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-[var(--danger-600)]">{error}</p>}

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="input"
          />
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className="input"
          />
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="sm:col-span-2"
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
            rows={2}
            className="input sm:col-span-2"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary !py-2 !text-xs"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger !py-2 !text-xs"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
