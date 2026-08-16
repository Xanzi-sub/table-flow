"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime, formatStaffName } from "@/lib/utils";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { Select } from "@/components/ui/Select";
import type {
  Order,
  OrderStatus,
  StaffProfile,
  TableRow,
  UserRole,
} from "@/types/database";

const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "served",
  "completed",
];

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    dot: string;
    text: string;
    bg: string;
  }
> = {
  pending: {
    label: "New",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  preparing: {
    label: "Preparing",
    dot: "bg-blue-600",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  served: {
    label: "Served",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  completed: {
    label: "Completed",
    dot: "bg-gray-400",
    text: "text-gray-600",
    bg: "bg-gray-50",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
  },
};

interface OrderLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  specialName: string | null;
  bundleId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Order card                                                                  */
/* -------------------------------------------------------------------------- */

function OrderCard({
  order,
  lines,
  customerName,
  onOrderUpdated,
}: {
  order: Order;
  lines: OrderLine[];
  customerName?: string;
  onOrderUpdated: (orderId: string, updates: Partial<Order>) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [payingWith, setPayingWith] = useState<
    "cash" | "speedpoint" | null
  >(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const nextStatus =
    currentIndex >= 0
      ? STATUS_FLOW[currentIndex + 1]
      : undefined;

  const status =
    STATUS_CONFIG[order.status] ?? STATUS_CONFIG.completed;

  async function handleAdvance() {
    if (!nextStatus || updating) return;

    setUpdating(true);
    try {
      const response = await fetch("/api/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, status: nextStatus }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        setPayError(result.error ?? "Could not update order status.");
        return;
      }
      onOrderUpdated(order.id, { status: nextStatus });
    } catch {
      setPayError("The update was interrupted. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  function handlePaymentSuccess() {
    const method = payingWith;
    setPayingWith(null);
    setPaymentComplete(true);
    onOrderUpdated(order.id, {
      payment_status: "paid",
      payment_method: method,
    });

    setTimeout(() => {
      setPaymentComplete(false);
    }, 2500);
  }

  return (
    <article className="border border-[#DFE2E6] bg-white">
      {/* Order header */}
      <div className="flex items-start justify-between border-b border-[#E7E9EC] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.01em] text-[#171A20]">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>

            <span
              className={`flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-[8px] font-semibold ${status.bg} ${status.text}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
              />

              {status.label}
            </span>
          </div>

          <p className="mt-1.5 text-[9px] text-[#858B95]">
            {customerName ?? "Guest"} ·{" "}
            {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-[#969BA4]">
            Payment
          </div>

          <div
            className={`mt-1 text-[9px] font-semibold ${
              order.payment_status === "paid"
                ? "text-emerald-600"
                : "text-amber-600"
            }`}
          >
            {order.payment_status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Order items */}
      <div className="px-4">
        {lines.length === 0 ? (
          <div className="py-5 text-[10px] text-[#969BA4]">
            No items recorded for this order.
          </div>
        ) : (
          <div className="divide-y divide-[#ECEEF1]">
            {lines.map((line) => (
              <div
                key={line.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[#30353D]">
                    <span className="mr-2 font-mono text-[9px] text-[#858B95]">
                      {line.quantity}×
                    </span>

                    {line.name}
                  </div>

                  {line.specialName && (
                    <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                      {line.bundleId ? `Combo · ${line.specialName}` : line.specialName}
                    </div>
                  )}

                  {line.notes && (
                    <div className="mt-1 max-w-[280px] text-[9px] leading-4 text-[#8A9099]">
                      {line.notes}
                    </div>
                  )}
                </div>

                <span className="shrink-0 font-mono text-[10px] text-[#626973]">
                  {formatCurrency(
                    line.unitPrice * line.quantity
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order total */}
      <div className="border-t border-[#E7E9EC] bg-[#FAFBFC] px-4 py-3">
        {order.loyalty_discount_amount > 0 && (
          <div className="mb-2 flex items-center justify-between text-[9px] font-medium text-emerald-700">
            <span>Loyalty · {order.loyalty_points_redeemed} points</span>
            <span>−{formatCurrency(order.loyalty_discount_amount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-[#737983]">
            Order total
          </span>

          <span className="text-[14px] font-semibold tracking-[-0.02em] text-[#15181D]">
            {formatCurrency(order.total_amount)}
          </span>
        </div>
      </div>

      {/* Payment error */}
      {payError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2.5 text-[9px] font-medium text-red-700">
          {payError}
        </div>
      )}

      {/* Payment success */}
      {paymentComplete && (
        <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[9px] font-medium text-emerald-700">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white">
            ✓
          </span>

          Payment recorded successfully.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E7E9EC] px-4 py-3">
        <div className="flex gap-1.5">
          {order.payment_status !== "paid" && (
            <>
              <button
                onClick={() => setPayingWith("cash")}
                disabled={payingWith !== null}
                className="h-8 border border-[#D9DDE2] bg-white px-3 text-[9px] font-medium text-[#555C66] transition-colors hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cash
              </button>

              <button
                onClick={() => setPayingWith("speedpoint")}
                disabled={payingWith !== null}
                className="h-8 border border-[#D9DDE2] bg-white px-3 text-[9px] font-medium text-[#555C66] transition-colors hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Card
              </button>
            </>
          )}

          {order.payment_status === "paid" && (
            <span className="flex h-8 items-center gap-1.5 px-1 text-[9px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Paid
            </span>
          )}
        </div>

        {nextStatus && (
          <button
            onClick={handleAdvance}
            disabled={updating}
            className="h-8 bg-[var(--accent-500)] px-3.5 text-[9px] font-semibold text-white transition-opacity hover:bg-[var(--accent-600)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updating
              ? "Updating..."
              : `Mark ${STATUS_CONFIG[nextStatus]?.label ?? nextStatus}`}
          </button>
        )}
      </div>

      <MarkPaidDialog
        open={payingWith !== null}
        orderId={order.id}
        method={payingWith ?? "cash"}
        onClose={() => setPayingWith(null)}
        onSuccess={handlePaymentSuccess}
      />
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Waiter assignment                                                           */
/* -------------------------------------------------------------------------- */

function ReassignWaiter({
  tableId,
  currentWaiterId,
  waiters,
}: {
  tableId: string;
  currentWaiterId: string | null;
  waiters: Pick<
    StaffProfile,
    "id" | "full_name" | "is_checked_in"
  >[];
}) {
  const [value, setValue] = useState(
    currentWaiterId ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(currentWaiterId ?? "");
  }, [currentWaiterId]);

  async function handleChange(nextId: string) {
    setValue(nextId);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/tables/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", tableId, waiterId: nextId || null }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (response.ok && result.success) return;
      setError(result.error ?? "Could not reassign waiter.");
      setValue(currentWaiterId ?? "");
    } catch {
      setError("The reassignment was interrupted. Please try again.");
      setValue(currentWaiterId ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-[#E2E4E8] bg-white px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#858B95]">
            Assigned waiter
          </div>

          <div className="mt-1 text-[10px] text-[#626973]">
            Controls who owns this table.
          </div>
        </div>

        <Select
          value={value}
          disabled={saving}
          onChange={(event) =>
            handleChange(event.target.value)
          }
          className="h-8 w-full border-[#D9DDE2] text-[10px] sm:w-48"
        >
          <option value="">Unassigned</option>

          {waiters.map((waiter) => (
            <option key={waiter.id} value={waiter.id}>
              {formatStaffName(waiter.full_name)}
              {waiter.is_checked_in ? "" : " · Off duty"}
            </option>
          ))}
        </Select>
      </div>

      {saving && (
        <p className="mt-2 text-[9px] text-[#858B95]">
          Saving assignment...
        </p>
      )}

      {error && (
        <p className="mt-2 text-[9px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table detail modal / POS drawer                                             */
/* -------------------------------------------------------------------------- */

export function TableDetailModal({
  table,
  role,
  waiters,
  onServiceResolved,
  onClose,
}: {
  table: TableRow;
  role: UserRole;
  waiters: Pick<
    StaffProfile,
    "id" | "full_name" | "is_checked_in"
  >[];
  onServiceResolved: (tableId: string) => void;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [linesByOrder, setLinesByOrder] = useState<
    Record<string, OrderLine[]>
  >({});
  const [customerNames, setCustomerNames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [resolvingRequest, setResolvingRequest] = useState(false);

  async function handleResolveRequest() {
    setResolvingRequest(true);
    onServiceResolved(table.id);
    try {
      await fetch("/api/tables/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_service", tableId: table.id }),
      });
    } finally {
      setResolvingRequest(false);
    }
  }

  function handleOrderUpdated(orderId: string, updates: Partial<Order>) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, ...updates } : order))
    );
  }

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
        .order("created_at", {
          ascending: false,
        });

      if (cancelled) return;

      const activeOrders = orderRows ?? [];

      setOrders(activeOrders);

      if (activeOrders.length > 0) {
        const { data: itemRows } = await supabase
          .from("order_items")
          .select(
            "id, order_id, quantity, unit_price, notes, special_name, bundle_id, menu_items(name)"
          )
          .in(
            "order_id",
            activeOrders.map((order) => order.id)
          );

        if (cancelled) return;

        type Row = {
          id: string;
          order_id: string;
          quantity: number;
          unit_price: number;
          notes: string | null;
          special_name: string | null;
          bundle_id: string | null;
          menu_items:
            | { name: string }
            | { name: string }[]
            | null;
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
            specialName: row.special_name,
            bundleId: row.bundle_id,
          });
        }

        setLinesByOrder(grouped);

        const customerIds = [
          ...new Set(
            activeOrders
              .map((order) => order.customer_id)
              .filter(
                (id): id is string => Boolean(id)
              )
          ),
        ];

        if (customerIds.length > 0) {
          const { data: customerRows } =
            await supabase
              .from("customer_profiles")
              .select("id, full_name")
              .in("id", customerIds);

          if (cancelled) return;

          const names: Record<string, string> = {};

          for (const customer of customerRows ?? []) {
            if (customer.full_name) {
              names[customer.id] = customer.full_name;
            }
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
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `table_id=eq.${table.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table.id]);

  const openOrders = orders.filter(
    (order) =>
      order.status !== "completed" &&
      order.status !== "cancelled"
  );

  const completedOrders = orders.filter(
    (order) => order.status === "completed"
  );

  const total = orders.reduce(
    (sum, order) => sum + Number(order.total_amount ?? 0),
    0
  );

  const paidTotal = orders
    .filter((order) => order.payment_status === "paid")
    .reduce(
      (sum, order) =>
        sum + Number(order.total_amount ?? 0),
      0
    );

  const outstandingTotal = Math.max(
    total - paidTotal,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20"
      onClick={onClose}
    >
      {/* Drawer */}
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[540px] flex-col border-l border-[#DDE1E6] bg-[#F5F6F8] shadow-[-16px_0_50px_rgba(0,0,0,0.10)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#DFE2E7] bg-white px-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  table.status === "vacant"
                    ? "bg-[#B8BDC5]"
                    : table.status === "dining"
                      ? "bg-blue-600"
                      : table.status === "awaiting_bill"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                }`}
              />

              <h2 className="text-[15px] font-semibold tracking-[-0.025em] text-[#15181D]">
                Table {table.table_number ?? "—"}
              </h2>
            </div>

            <div className="mt-1.5 flex items-center gap-2 text-[9px] text-[#858B95]">
              <span>
                {table.section ?? "Main floor"}
              </span>

              <span className="h-2.5 w-px bg-[#DDE0E4]" />

              <span className="capitalize">
                {table.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close table"
            className="flex h-8 w-8 items-center justify-center border border-[#DDE1E6] bg-white text-[17px] leading-none text-[#737983] transition-colors hover:bg-[#F4F5F7] hover:text-[#171A20]"
          >
            ×
          </button>
        </header>

        {/* Table summary */}
        <div className="grid shrink-0 grid-cols-3 border-b border-[#DFE2E7] bg-white">
          <SummaryMetric
            label="Orders"
            value={orders.length}
          />

          <SummaryMetric
            label="Paid"
            value={formatCurrency(paidTotal)}
          />

          <SummaryMetric
            label="Outstanding"
            value={formatCurrency(outstandingTotal)}
            warning={outstandingTotal > 0}
          />
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Waiter assignment */}
          {(role === "manager" || role === "admin") && (
            <ReassignWaiter
              tableId={table.id}
              currentWaiterId={table.current_waiter_id}
              waiters={waiters}
            />
          )}

          {/* Service request */}
          {table.service_requested_at && (
            <div className="border-b border-[#E8DDBF] bg-[#FFFBF1] px-5 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />

                  <span className="text-[10px] font-semibold text-[#80651D]">
                    Waiter requested
                  </span>
                </div>

                <button
                  onClick={handleResolveRequest}
                  disabled={resolvingRequest}
                  className="text-[9px] font-semibold text-[#2556C8] hover:underline disabled:opacity-50"
                >
                  {resolvingRequest ? "Resolving..." : "Resolve"}
                </button>
              </div>

              <p className="mt-1.5 pl-3.5 text-[9px] text-[#9A7C2B]">
                This table requires service attention.
              </p>
            </div>
          )}

          {/* Orders section */}
          <div className="px-5 py-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#737983]">
                  Current orders
                </h3>

                <p className="mt-1 text-[9px] text-[#969BA4]">
                  {openOrders.length} active{" "}
                  {openOrders.length === 1
                    ? "order"
                    : "orders"}
                </p>
              </div>

              {loading && (
                <span className="text-[9px] text-[#969BA4]">
                  Updating...
                </span>
              )}
            </div>

            {loading && orders.length === 0 ? (
              <div className="border border-[#DFE2E6] bg-white px-5 py-10 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-[#DDE1E6] border-t-[#2563EB]" />

                <p className="mt-3 text-[10px] text-[#858B95]">
                  Loading table activity...
                </p>
              </div>
            ) : openOrders.length === 0 ? (
              <div className="border border-dashed border-[#D8DCE1] bg-white px-5 py-10 text-center">
                <div className="text-[11px] font-medium text-[#626973]">
                  No active orders
                </div>

                <p className="mt-1 text-[9px] text-[#969BA4]">
                  Orders placed at this table will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    lines={
                      linesByOrder[order.id] ?? []
                    }
                    customerName={
                      order.customer_id
                        ? customerNames[
                            order.customer_id
                          ]
                        : undefined
                    }
                    onOrderUpdated={handleOrderUpdated}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed orders */}
          {completedOrders.length > 0 && (
            <div className="border-t border-[#DFE2E6] bg-[#F8F9FA] px-5 py-5">
              <div className="mb-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#858B95]">
                  Completed orders
                </h3>

                <p className="mt-1 text-[9px] text-[#A0A5AD]">
                  Previous activity for this table
                </p>
              </div>

              <div className="space-y-2">
                {completedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between border border-[#E1E4E8] bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#A8ADB5]" />

                      <div>
                        <div className="font-mono text-[9px] font-medium text-[#555C66]">
                          #
                          {order.id
                            .slice(0, 8)
                            .toUpperCase()}
                        </div>

                        <div className="mt-0.5 text-[8px] text-[#969BA4]">
                          {formatDateTime(
                            order.created_at
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] text-[#626973]">
                      {formatCurrency(
                        order.total_amount
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom summary */}
        <footer className="shrink-0 border-t border-[#DDE1E6] bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#969BA4]">
                Table total
              </div>

              <div className="mt-1 text-[18px] font-semibold tracking-[-0.035em] text-[#15181D]">
                {formatCurrency(total)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#969BA4]">
                Outstanding
              </div>

              <div
                className={`mt-1 text-[13px] font-semibold ${
                  outstandingTotal > 0
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {formatCurrency(outstandingTotal)}
              </div>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary metric                                                              */
/* -------------------------------------------------------------------------- */

function SummaryMetric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div className="border-r border-[#E2E4E8] px-4 py-3.5 last:border-r-0">
      <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#969BA4]">
        {label}
      </div>

      <div
        className={`mt-1.5 text-[12px] font-semibold tracking-[-0.01em] ${
          warning ? "text-amber-600" : "text-[#252A31]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}