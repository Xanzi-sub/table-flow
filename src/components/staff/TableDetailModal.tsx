"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { updateOrderStatus } from "@/app/actions/orders";
import { markTablePaid, reassignTableWaiter } from "@/app/actions/tables";
import { Select } from "@/components/ui/Select";
import type { Order, OrderStatus, StaffProfile, TableRow, UserRole } from "@/types/database";

const STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "served", "completed"];
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

function OrderCard({ order, lines, customerName }: { order: Order; lines: OrderLine[]; customerName?: string }) {
  const [updating, setUpdating] = useState(false);
  const [payingWith, setPayingWith] = useState<"cash" | "speedpoint" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];

  async function handleAdvance() {
    if (!nextStatus) return;
    setUpdating(true);
    await updateOrderStatus(order.id, nextStatus);
    setUpdating(false);
  }

  async function handleMarkPaid(method: "cash" | "speedpoint") {
    setPayingWith(method);
    setPayError(null);
    const result = await markTablePaid(order.table_id, method);
    setPayingWith(null);
    if (!result.success) setPayError(result.error ?? "Could not mark as paid");
  }

  return (
    <div className="panel-muted p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            {customerName ?? "Guest"} · {formatDateTime(order.created_at)}
          </p>
        </div>
        <span className={`badge capitalize ${STATUS_BADGE[order.status]}`}>{order.status.replace("_", " ")}</span>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
        Payment: <span className={order.payment_status === "paid" ? "text-[var(--success-600)]" : "text-[var(--warning-600)]"}>
          {order.payment_status.replace("_", " ")}
        </span>
      </p>
      {payError && <p className="mb-2 text-xs font-semibold text-[var(--danger-600)]">{payError}</p>}

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between py-1.5 text-sm">
            <div>
              <span className="font-medium text-[var(--foreground)]">
                {line.quantity}x {line.name}
              </span>
              {line.notes && (
                <p className="text-xs text-[var(--foreground-muted)]">{line.notes}</p>
              )}
            </div>
            <span className="text-[var(--foreground-muted)]">
              {formatCurrency(line.unitPrice * line.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
        <span className="text-sm font-bold text-[var(--foreground)]">
          Total: {formatCurrency(order.total_amount)}
        </span>
        <div className="flex gap-2">
          {order.payment_status !== "paid" && (
            <>
              <button
                onClick={() => handleMarkPaid("cash")}
                disabled={payingWith !== null}
                className="btn btn-secondary !py-1.5 !text-xs"
              >
                {payingWith === "cash" ? "…" : "Mark Paid (Cash)"}
              </button>
              <button
                onClick={() => handleMarkPaid("speedpoint")}
                disabled={payingWith !== null}
                className="btn btn-secondary !py-1.5 !text-xs"
              >
                {payingWith === "speedpoint" ? "…" : "Mark Paid (Card)"}
              </button>
            </>
          )}
          {nextStatus && (
            <button onClick={handleAdvance} disabled={updating} className="btn btn-primary !py-1.5 !text-xs">
              {updating ? "Updating…" : `Mark ${nextStatus}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReassignWaiter({
  tableId,
  currentWaiterId,
  waiters,
}: {
  tableId: string;
  currentWaiterId: string | null;
  waiters: Pick<StaffProfile, "id" | "full_name" | "is_checked_in">[];
}) {
  const [value, setValue] = useState(currentWaiterId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(currentWaiterId ?? ""), [currentWaiterId]);

  async function handleChange(nextId: string) {
    setValue(nextId);
    setSaving(true);
    setError(null);
    const result = await reassignTableWaiter(tableId, nextId || null);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? "Could not reassign waiter");
      setValue(currentWaiterId ?? "");
    }
  }

  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="label !mb-0">Waiter</span>
      <Select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="w-48"
      >
        <option value="">Unassigned</option>
        {waiters.map((w) => (
          <option key={w.id} value={w.id}>
            {w.full_name}{w.is_checked_in ? "" : " (off duty)"}
          </option>
        ))}
      </Select>
      {error && <span className="text-xs font-semibold text-[var(--danger-600)]">{error}</span>}
    </div>
  );
}

export function TableDetailModal({
  table,
  role,
  waiters,
  onClose,
}: {
  table: TableRow;
  role: UserRole;
  waiters: Pick<StaffProfile, "id" | "full_name" | "is_checked_in">[];
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [linesByOrder, setLinesByOrder] = useState<Record<string, OrderLine[]>>({});
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: orderRows } = await supabase
        .from("orders")
        .select("*")
        .eq("table_id", table.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      const activeOrders = orderRows ?? [];
      setOrders(activeOrders);

      if (activeOrders.length > 0) {
        const { data: itemRows } = await supabase
          .from("order_items")
          .select("id, order_id, quantity, unit_price, notes, menu_items(name)")
          .in(
            "order_id",
            activeOrders.map((o) => o.id)
          );

        if (cancelled) return;
        type Row = {
          id: string;
          order_id: string;
          quantity: number;
          unit_price: number;
          notes: string | null;
          menu_items: { name: string } | { name: string }[] | null;
        };
        const grouped: Record<string, OrderLine[]> = {};
        for (const row of (itemRows ?? []) as Row[]) {
          const name = Array.isArray(row.menu_items)
            ? row.menu_items[0]?.name ?? "Item"
            : row.menu_items?.name ?? "Item";
          grouped[row.order_id] ??= [];
          grouped[row.order_id].push({
            id: row.id,
            name,
            quantity: row.quantity,
            unitPrice: row.unit_price,
            notes: row.notes,
          });
        }
        setLinesByOrder(grouped);

        const customerIds = [...new Set(activeOrders.map((o) => o.customer_id).filter((id): id is string => !!id))];
        if (customerIds.length > 0) {
          const { data: customerRows } = await supabase
            .from("customer_profiles")
            .select("id, full_name")
            .in("id", customerIds);
          if (cancelled) return;
          const names: Record<string, string> = {};
          for (const c of customerRows ?? []) {
            if (c.full_name) names[c.id] = c.full_name;
          }
          setCustomerNames(names);
        }
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`table-detail-${table.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${table.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Table {table.table_number ?? "—"}
            </h2>
            <p className="text-xs text-[var(--foreground-muted)]">{table.section ?? "No section"}</p>
          </div>
          <button onClick={onClose} className="btn btn-secondary !px-3 !py-1.5">
            Close
          </button>
        </div>

        {(role === "manager" || role === "admin") && (
          <ReassignWaiter tableId={table.id} currentWaiterId={table.current_waiter_id} waiters={waiters} />
        )}

        {table.status === "awaiting_bill" && (
          <p className="mb-4 rounded-lg bg-[var(--warning-50)] px-3 py-2 text-sm font-semibold text-[var(--warning-600)]">
            🔔 Customer requested the waiter / bill
          </p>
        )}

        {loading && <p className="text-sm text-[var(--foreground-muted)]">Loading orders…</p>}

        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              lines={linesByOrder[order.id] ?? []}
              customerName={order.customer_id ? customerNames[order.customer_id] : undefined}
            />
          ))}
          {!loading && orders.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">
              No orders yet for this table.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
