"use client";

import type { TableRow } from "@/types/database";
import { markTablePaid } from "@/app/actions/tables";
import { useState } from "react";

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

  const needsAttention =
    hasNewOrder || table.status === "awaiting_bill";

  async function handleMarkPaid(
    method: "cash" | "speedpoint"
  ) {
    setLoading(true);
    setError(null);

    const result = await markTablePaid(table.id, method);

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not mark as paid");
      return;
    }

    setJustPaid(true);

    setTimeout(() => {
      setJustPaid(false);
    }, 2000);
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
      className={`group relative min-h-[178px] cursor-pointer bg-white p-4 transition-colors hover:bg-[#FAFBFC] ${
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
            {waiterName}
          </div>
        ) : (
          <div className="mt-1 text-[10px] text-[#A0A5AD]">
            Unassigned
          </div>
        )}
      </div>

      {/* Attention state */}
      {hasNewOrder && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between border-t border-[#E9EBEE] pt-3">
          <span className="flex items-center gap-2 text-[9px] font-medium text-[#2556C8]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            New order
          </span>

          <span className="font-mono text-[8px] text-[#999FA8]">
            OPEN
          </span>
        </div>
      )}

      {table.status === "awaiting_bill" && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between border-t border-[#E9EBEE] pt-3">
          <span className="flex items-center gap-2 text-[9px] font-medium text-[#A57613]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D99A20]" />
            Bill requested
          </span>

          <span className="font-mono text-[8px] text-[#999FA8]">
            ACTION
          </span>
        </div>
      )}

      {justPaid && (
        <div className="absolute bottom-4 left-4 right-4 border-t border-[#E9EBEE] pt-3 text-[9px] font-medium text-emerald-600">
          Payment recorded
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 border-t border-[#E9EBEE] pt-3 text-[9px] font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Payment controls */}
      {(table.status === "dining" ||
        table.status === "awaiting_bill") &&
        hasUnpaidOrder &&
        !justPaid && (
          <div
            className="absolute bottom-3 left-3 right-3 flex gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => handleMarkPaid("cash")}
              disabled={loading}
              className="h-7 flex-1 border border-[#D9DDE2] bg-white text-[9px] font-medium text-[#555C66] transition-colors hover:bg-[#F4F5F7] disabled:opacity-50"
            >
              {loading ? "..." : "Cash"}
            </button>

            <button
              onClick={() => handleMarkPaid("speedpoint")}
              disabled={loading}
              className="h-7 flex-1 border border-[#D9DDE2] bg-white text-[9px] font-medium text-[#555C66] transition-colors hover:bg-[#F4F5F7] disabled:opacity-50"
            >
              {loading ? "..." : "Card"}
            </button>
          </div>
        )}

      {/* Hover affordance */}
      <div className="pointer-events-none absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-[12px] text-[#A0A5AD]">↗</span>
      </div>
    </div>
  );
}