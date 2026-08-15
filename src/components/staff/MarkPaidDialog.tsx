"use client";

import { useState } from "react";
import { markTablePaid } from "@/app/actions/tables";
import type { PaymentMethod } from "@/types/database";

/** Small tip-capture step inserted between "Cash/Card" and actually marking a table paid. */
export function MarkPaidDialog({
  open,
  tableId,
  method,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tableId: string;
  method: PaymentMethod;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await markTablePaid(tableId, method, Number(tip) || 0);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not mark as paid");
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-[var(--border)] bg-[var(--surface)] p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-[var(--foreground)]">
          Mark Paid ({method === "cash" ? "Cash" : "Card"})
        </h2>
        <label className="mt-3 block text-sm">
          <span className="label">Tip received (optional)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="0.00"
            className="input"
            autoFocus
          />
        </label>
        {error && <p className="mt-2 text-xs font-semibold text-[var(--danger-600)]">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading} className="btn btn-primary">
            {loading ? "…" : "Confirm Paid"}
          </button>
        </div>
      </div>
    </div>
  );
}
