"use client";

import type { TableRow } from "@/types/database";
import { markTablePaid } from "@/app/actions/tables";
import { useState } from "react";

const STATUS_BADGE: Record<TableRow["status"], string> = {
  vacant: "badge-neutral",
  dining: "badge-accent",
  awaiting_bill: "badge-warning",
  paid: "badge-success",
};

const STATUS_RING: Record<TableRow["status"], string> = {
  vacant: "border-[var(--border)]",
  dining: "border-[var(--accent-200)]",
  awaiting_bill: "border-[var(--warning-500)]/40",
  paid: "border-[var(--success-500)]/40",
};

const STATUS_LABEL: Record<TableRow["status"], string> = {
  vacant: "Vacant",
  dining: "Dining",
  awaiting_bill: "Awaiting Bill",
  paid: "Paid",
};

export function TableCard({
  table,
  hasNewOrder,
  hasUnpaidOrder,
  waiterName,
  onOpenDetail,
}: {
  table: TableRow;
  hasNewOrder: boolean;
  hasUnpaidOrder: boolean;
  waiterName?: string;
  onOpenDetail: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const needsAttention = hasNewOrder || table.status === "awaiting_bill";

  async function handleMarkPaid(method: "cash" | "speedpoint") {
    setLoading(true);
    setError(null);
    const result = await markTablePaid(table.id, method);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not mark as paid");
      return;
    }
    setJustPaid(true);
    setTimeout(() => setJustPaid(false), 2000);
  }

  return (
    <div
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpenDetail()}
      className={`card relative flex cursor-pointer flex-col gap-2 overflow-hidden border p-4 transition-shadow hover:shadow-md ${STATUS_RING[table.status]} ${
        needsAttention ? "ring-2 ring-[var(--danger-500)] ring-offset-1" : ""
      }`}
    >
      {needsAttention && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-[var(--danger-500)] text-[10px] font-bold text-white shadow-sm">
          !
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold text-[var(--foreground)]">
          Table {table.table_number ?? "—"}
        </p>
        <span className={`badge ${STATUS_BADGE[table.status]}`}>{STATUS_LABEL[table.status]}</span>
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">{table.section ?? "No section"}</p>
      {waiterName && (
        <p className="text-xs text-[var(--foreground-muted)]">Waiter: {waiterName}</p>
      )}
      {table.status === "awaiting_bill" && (
        <p className="text-xs font-semibold text-[var(--warning-600)]">🔔 Waiter requested</p>
      )}
      {error && (
        <p className="text-xs font-semibold text-[var(--danger-600)]">{error}</p>
      )}
      {justPaid && (
        <p className="text-xs font-semibold text-[var(--success-600)]">Marked as paid ✓</p>
      )}

      {(table.status === "dining" || table.status === "awaiting_bill") && hasUnpaidOrder && (
        <div className="mt-2 flex min-w-0 gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleMarkPaid("cash")}
            disabled={loading}
            className="btn btn-primary min-w-0 flex-1 truncate !px-2 !py-1.5 !text-xs"
          >
            {loading ? "…" : "Cash"}
          </button>
          <button
            onClick={() => handleMarkPaid("speedpoint")}
            disabled={loading}
            className="btn btn-secondary min-w-0 flex-1 truncate !px-2 !py-1.5 !text-xs"
          >
            {loading ? "…" : "Card"}
          </button>
        </div>
      )}
    </div>
  );
}
