"use client";

import type { TableRow, TableServiceRequest } from "@/types/database";
import { useState } from "react";
import { formatStaffName } from "@/lib/utils";

const STATUS_LABEL: Record<TableRow["status"], string> = {
  vacant: "Available",
  dining: "Dining",
  awaiting_bill: "Bill requested",
  paid: "Paid",
};

const STATUS_DOT: Record<TableRow["status"], string> = {
  vacant: "bg-[#B8BDC5]",
  dining: "bg-[#2563EB]",
  awaiting_bill: "bg-[#D99A20]",
  paid: "bg-[#16A34A]",
};

const STATUS_TEXT: Record<TableRow["status"], string> = {
  vacant: "text-[#7D838D]",
  dining: "text-[#2563EB]",
  awaiting_bill: "text-[#A57613]",
  paid: "text-[#16803A]",
};

export function TableCard({
  table,
  hasNewOrder,
  serviceRequests,
  waiterName,
  onServiceResolved,
  onOpenDetail,
}: {
  table: TableRow;
  hasNewOrder: boolean;
  serviceRequests: TableServiceRequest[];
  waiterName?: string;
  onServiceResolved: (tableId: string) => void;
  onOpenDetail: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const hasBillRequest = serviceRequests.some((request) => request.request_type === "bill_requested");
  const hasWaiterCall = serviceRequests.some((request) => request.request_type === "waiter_call");
  const needsAttention = hasNewOrder || hasBillRequest || hasWaiterCall;

  async function handleResolveRequest() {
    setLoading(true);
    onServiceResolved(table.id);
    try {
      await fetch("/api/tables/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_service", tableId: table.id }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail();
        }
      }}
      className={`group flex min-h-[220px] cursor-pointer flex-col bg-white p-4 transition-colors hover:bg-[#FAFBFC] ${
        needsAttention ? "bg-[#FFFDF7]" : ""
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${STATUS_DOT[table.status]}`}
          />

          <span className="font-mono text-[12px] font-semibold tracking-[-0.01em] text-[#171A20]">
            T{table.table_number ?? "—"}
          </span>
        </div>

        <span
          className={`text-[9px] font-medium ${STATUS_TEXT[table.status]}`}
        >
          {STATUS_LABEL[table.status]}
        </span>
      </div>

      {/* Table information */}
      <div className="mt-7">
        <div className="text-[10px] text-[#8A9099]">
          {table.section ?? "Main floor"}
        </div>

        {waiterName ? (
          <div className="mt-1 text-[10px] text-[#626973]">
            {formatStaffName(waiterName, "Assigned waiter")}
          </div>
        ) : (
          <div className="mt-1 text-[10px] text-[#A0A5AD]">
            Unassigned
          </div>
        )}
      </div>

      {/* Activity states stay in normal flow so combined alerts never overlap. */}
      {needsAttention && (
        <div className="mt-auto flex flex-col divide-y divide-[#E9EBEE] border-t border-[#E9EBEE] pt-2">
          {hasNewOrder && (
            <div className="flex min-h-8 items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 font-medium text-[#2556C8]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                <span className="truncate">New order</span>
              </span>
              <span className="shrink-0 font-mono text-[#999FA8]">OPEN</span>
            </div>
          )}

          {hasBillRequest && (
            <div className="flex min-h-8 items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 font-medium text-[#A57613]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#D99A20]" />
                <span className="truncate">Bill requested</span>
              </span>
              <span className="shrink-0 font-mono text-[#999FA8]">ACTION</span>
            </div>
          )}

          {hasWaiterCall && (
            <div
              className="flex min-h-8 items-center justify-between gap-3 py-2"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-[#B4271A]">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#DC2626]" />
                <span className="truncate">Waiter requested</span>
              </span>
              <button
                onClick={handleResolveRequest}
                disabled={loading}
                className="shrink-0 rounded border border-[#D9DDE2] bg-white px-2.5 py-1 font-mono font-semibold text-[#2556C8] hover:bg-[#F4F5F7] disabled:opacity-50"
              >
                {loading ? "…" : "RESOLVE"}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}