"use client";

import { useEffect, useState } from "react";
import { listOrderHistory } from "@/app/actions/orders";
import { OrderDetailModal } from "./OrderDetailModal";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "badge-warning",
  preparing: "badge-accent",
  served: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-danger",
};

interface CustomerOrderRow {
  id: string;
  created_at: string;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  tables: { table_number: number | null } | { table_number: number | null }[] | null;
  staff_profiles: { full_name: string } | { full_name: string }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function CustomerDetailModal({
  customerId,
  customerName,
  onClose,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOrderHistory({ customerId }).then((data) => {
      if (cancelled) return;
      setOrders(data as unknown as CustomerOrderRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const totalSpend = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-[var(--border)] bg-[var(--surface)] p-6 sm:rounded-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">{customerName}</h2>
              <p className="text-xs text-[var(--foreground-muted)]">
                {orders.length} order{orders.length === 1 ? "" : "s"} · {formatCurrency(totalSpend)} total
              </p>
            </div>
            <button onClick={onClose} className="btn btn-secondary !px-3 !py-1.5">
              Close
            </button>
          </div>

          {loading && <p className="text-sm text-[var(--foreground-muted)]">Loading orders…</p>}

          <div className="flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-[var(--gray-50)]"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-[var(--foreground)]">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">{formatDateTime(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge capitalize ${STATUS_BADGE[order.status]}`}>{order.status}</span>
                  <span className="font-semibold text-[var(--foreground)]">{formatCurrency(order.total_amount)}</span>
                </div>
              </button>
            ))}
            {!loading && orders.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">No orders yet.</p>
            )}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder.id}
          tableLabel={
            one(selectedOrder.tables)?.table_number ? `Table ${one(selectedOrder.tables)!.table_number}` : "—"
          }
          waiterName={one(selectedOrder.staff_profiles)?.full_name ?? "Unassigned"}
          customerName={customerName}
          status={selectedOrder.status}
          paymentStatus={selectedOrder.payment_status}
          totalAmount={selectedOrder.total_amount}
          createdAt={selectedOrder.created_at}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
