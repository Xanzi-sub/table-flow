"use client";

import { useEffect, useState } from "react";
import { listOrderHistory } from "@/app/actions/orders";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrderDetailModal } from "./OrderDetailModal";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderStatus, StaffProfile } from "@/types/database";

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "badge-warning",
  preparing: "badge-accent",
  served: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-danger",
};

interface OrderHistoryRow {
  id: string;
  created_at: string;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  tables: { table_number: number | null; section: string | null } | { table_number: number | null; section: string | null }[] | null;
  staff_profiles: { full_name: string } | { full_name: string }[] | null;
  customer_profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  order_items: { id: string }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function OrderHistoryManager({
  initialOrders,
  waiters,
  lockedWaiterId,
}: {
  initialOrders: OrderHistoryRow[];
  waiters: Pick<StaffProfile, "id" | "full_name">[];
  /** When set (a waiter viewing their own history), forces every fetch to this waiter and hides the waiter filter. */
  lockedWaiterId?: string;
}) {
  const [orders, setOrders] = useState<OrderHistoryRow[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryRow | null>(null);
  const [waiterId, setWaiterId] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(async () => {
      const result = await listOrderHistory({
        waiterId: lockedWaiterId ?? (waiterId || undefined),
        status: (status as OrderStatus) || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      });
      setOrders(result as unknown as OrderHistoryRow[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [lockedWaiterId, waiterId, status, startDate, endDate]);

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      <PageHeader title="Order History" description={`${orders.length} orders · ${formatCurrency(totalRevenue)} total`} />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        {!lockedWaiterId && (
          <label className="text-sm">
            <span className="label">Waiter</span>
            <Select value={waiterId} onChange={(e) => setWaiterId(e.target.value)} className="w-44">
              <option value="">All waiters</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="text-sm">
          <span className="label">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="served">Served</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </label>
        <label className="text-sm">
          <span className="label">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input w-40"
          />
        </label>
        <label className="text-sm">
          <span className="label">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input w-40"
          />
        </label>
        {(waiterId || status || startDate || endDate) && (
          <button
            onClick={() => {
              setWaiterId("");
              setStatus("");
              setStartDate("");
              setEndDate("");
            }}
            className="btn btn-ghost"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Waiter</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const tableRow = one(order.tables);
              const waiter = one(order.staff_profiles);
              const customer = one(order.customer_profiles);
              return (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--gray-50)]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--foreground-muted)]">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    {tableRow?.table_number ? `Table ${tableRow.table_number}` : "—"}
                    {tableRow?.section && (
                      <span className="text-xs text-[var(--foreground-muted)]"> · {tableRow.section}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{waiter?.full_name ?? "Unassigned"}</td>
                  <td className="px-4 py-3">{customer?.full_name ?? "Guest"}</td>
                  <td className="px-4 py-3">{order.order_items?.length ?? 0}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${STATUS_BADGE[order.status]}`}>{order.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
                    {formatDateTime(order.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--foreground-muted)]">
            No orders match these filters.
          </p>
        )}
        {loading && (
          <p className="py-4 text-center text-xs text-[var(--foreground-muted)]">Loading…</p>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder.id}
          tableLabel={
            one(selectedOrder.tables)?.table_number ? `Table ${one(selectedOrder.tables)!.table_number}` : "—"
          }
          waiterName={one(selectedOrder.staff_profiles)?.full_name ?? "Unassigned"}
          customerName={one(selectedOrder.customer_profiles)?.full_name ?? "Guest"}
          status={selectedOrder.status}
          paymentStatus={selectedOrder.payment_status}
          totalAmount={selectedOrder.total_amount}
          createdAt={selectedOrder.created_at}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
