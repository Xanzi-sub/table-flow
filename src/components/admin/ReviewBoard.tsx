"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewItemCard, type ScanCrop } from "./ReviewItemCard";
import { addManualItemToJob, publishScanJob } from "@/app/actions/scan";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MenuCategory, MenuItem, MenuScanJob } from "@/types/database";

interface RawExtractedItem {
  name?: string;
  category?: string;
  description?: string;
  price?: number;
  confidence?: number;
  image_index?: number;
  crop?: { x: number; y: number; width: number; height: number };
}

export function ReviewBoard({
  job,
  initialItems,
  categories,
}: {
  job: MenuScanJob;
  initialItems: MenuItem[];
  categories: MenuCategory[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualCategory, setManualCategory] = useState("");

  const rawItems = Array.isArray(job.raw_ai_output)
    ? (job.raw_ai_output as unknown as RawExtractedItem[])
    : [];

  const scannedItems = items.filter((i) => i.source === "scanned");
  const cropByItemId = new Map<string, ScanCrop>();
  scannedItems.forEach((item, index) => {
    const raw = rawItems[index];
    if (raw?.crop && typeof raw.image_index === "number") {
      const imageUrl = job.image_urls[raw.image_index];
      if (imageUrl) {
        cropByItemId.set(item.id, { imageUrl, ...raw.crop });
      }
    }
  });

  function handleRemoved(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleAddManual() {
    if (!manualName || !manualPrice) return;
    await addManualItemToJob({
      scanJobId: job.id,
      categoryId: manualCategory || null,
      name: manualName,
      price: Number(manualPrice),
    });
    router.refresh();
    setManualName("");
    setManualPrice("");
    setManualCategory("");
    setManualOpen(false);
  }

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    const result = await publishScanJob(job.id);
    setPublishing(false);
    if (!result.success) {
      setError(result.error ?? "Could not publish");
      return;
    }
    router.push("/admin/menu-scan");
  }

  const draftCount = items.filter((i) => i.status === "draft").length;

  return (
    <div>
      <PageHeader
        title="Review Scan Batch"
        description={`${draftCount} item(s) awaiting review · job status: ${job.status}`}
        actions={
          <>
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="btn btn-secondary"
            >
              + Add missed item
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || draftCount === 0}
              className="btn btn-primary"
            >
              {publishing ? "Publishing…" : "Publish Reviewed Items"}
            </button>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}

      {manualOpen && (
        <div className="card mb-6 grid gap-2 p-4 sm:grid-cols-4">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Name"
            className="input"
          />
          <input
            type="number"
            step="0.01"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            placeholder="Price"
            className="input"
          />
          <Select
            value={manualCategory}
            onChange={(e) => setManualCategory(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            onClick={handleAddManual}
            className="btn btn-primary"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <ReviewItemCard
            key={item.id}
            item={item}
            crop={cropByItemId.get(item.id) ?? null}
            categories={categories}
            onRemoved={handleRemoved}
          />
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] py-10 text-center text-sm text-[var(--foreground-muted)]">
            No items left to review.
          </p>
        )}
      </div>
    </div>
  );
}
