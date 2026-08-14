"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "badge-warning",
  preparing: "badge-accent",
  served: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-danger",
};

interface OrderLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export function OrderDetailModal({
  orderId,
  tableLabel,
  waiterName,
  customerName,
  status,
  paymentStatus,
  totalAmount,
  createdAt,
  onClose,
}: {
  orderId: string;
  tableLabel: string;
  waiterName: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("order_items")
      .select("id, quantity, unit_price, notes, menu_items(name)")
      .eq("order_id", orderId)
      .then(({ data }) => {
        type Row = {
          id: string;
          quantity: number;
          unit_price: number;
          notes: string | null;
          menu_items: { name: string } | { name: string }[] | null;
        };
        setLines(
          ((data ?? []) as Row[]).map((row) => ({
            id: row.id,
            name: Array.isArray(row.menu_items) ? row.menu_items[0]?.name ?? "Item" : row.menu_items?.name ?? "Item",
            quantity: row.quantity,
            unitPrice: row.unit_price,
            notes: row.notes,
          }))
        );
        setLoading(false);
      });
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Order #{orderId.slice(0, 8).toUpperCase()}
            </h2>
            <p className="text-xs text-[var(--foreground-muted)]">{formatDateTime(createdAt)}</p>
          </div>
          <button onClick={onClose} className="btn btn-secondary !px-3 !py-1.5">
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--foreground-muted)]">Table</p>
            <p className="font-medium text-[var(--foreground)]">{tableLabel}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--foreground-muted)]">Waiter</p>
            <p className="font-medium text-[var(--foreground)]">{waiterName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--foreground-muted)]">Customer</p>
            <p className="font-medium text-[var(--foreground)]">{customerName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--foreground-muted)]">Payment</p>
            <p className="font-medium capitalize text-[var(--foreground)]">{paymentStatus.replace("_", " ")}</p>
          </div>
        </div>

        <span className={`badge capitalize ${STATUS_BADGE[status]}`}>{status.replace("_", " ")}</span>

        <div className="mt-4 flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {loading && <p className="py-3 text-sm text-[var(--foreground-muted)]">Loading items…</p>}
          {lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-[var(--foreground)]">
                  {line.quantity}x {line.name}
                </span>
                {line.notes && <p className="text-xs text-[var(--foreground-muted)]">{line.notes}</p>}
              </div>
              <span className="text-[var(--foreground-muted)]">
                {formatCurrency(line.unitPrice * line.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-sm font-bold text-[var(--foreground)]">Total</span>
          <span className="text-base font-bold text-[var(--foreground)]">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
