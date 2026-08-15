"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, StaffProfile, TableRow } from "@/types/database";
import { TableCard } from "./TableCard";
import { TableDetailModal } from "./TableDetailModal";
import { formatStaffName } from "@/lib/utils";

interface StaffDashboardProps {
  profile: StaffProfile;
  initialTables: TableRow[];
  initialOrders: Order[];
  waiterNames: Record<string, string>;
  waiters: Pick<
    StaffProfile,
    "id" | "full_name" | "is_checked_in"
  >[];
}

type FloorFilter = "all" | "vacant" | "dining" | "awaiting_bill" | "paid";

const FILTERS: { id: FloorFilter; label: string }[] = [
  { id: "all", label: "All tables" },
  { id: "vacant", label: "Available" },
  { id: "dining", label: "Dining" },
  { id: "awaiting_bill", label: "Bill requested" },
  { id: "paid", label: "Paid" },
];

export function StaffDashboard({
  profile,
  initialTables,
  initialOrders,
  waiterNames,
  waiters,
}: StaffDashboardProps) {
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [filter, setFilter] = useState<FloorFilter>("all");

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("staff-dashboard")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tables",
        },
        (payload) => {
          setTables((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (table) => table.id !== (payload.old as TableRow).id
              );
            }

            const updated = payload.new as TableRow;

            const exists = prev.some(
              (table) => table.id === updated.id
            );

            if (exists) {
              return prev.map((table) =>
                table.id === updated.id ? updated : table
              );
            }

            return [...prev, updated].sort(
              (a, b) =>
                (a.table_number ?? 0) - (b.table_number ?? 0)
            );
          });
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          setOrders((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (order) => order.id !== (payload.old as Order).id
              );
            }

            const updated = payload.new as Order;

            const exists = prev.some(
              (order) => order.id === updated.id
            );

            if (exists) {
              return prev.map((order) =>
                order.id === updated.id ? updated : order
              );
            }

            return [...prev, updated];
          });
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const newOrderTableIds = useMemo(
    () =>
      new Set(
        orders
          .filter((order) => order.status === "pending")
          .map((order) => order.table_id)
      ),
    [orders]
  );

  const unpaidTableIds = useMemo(
    () =>
      new Set(
        orders
          .filter((order) => order.payment_status !== "paid")
          .map((order) => order.table_id)
      ),
    [orders]
  );

  const visibleTables = useMemo(() => {
    let result = tables;

    if (profile.role === "waiter") {
      result = result.filter(
        (table) => table.current_waiter_id === profile.id
      );
    }

    if (filter !== "all") {
      result = result.filter(
        (table) => table.status === filter
      );
    }

    return result;
  }, [tables, profile, filter]);

  const allVisibleTables = useMemo(() => {
    if (profile.role !== "waiter") return tables;

    return tables.filter(
      (table) => table.current_waiter_id === profile.id
    );
  }, [tables, profile]);

  const statusCounts = useMemo(() => {
    const counts = {
      vacant: 0,
      dining: 0,
      awaiting_bill: 0,
      paid: 0,
    };

    for (const table of allVisibleTables) {
      counts[table.status]++;
    }

    return counts;
  }, [allVisibleTables]);

  const attentionCount =
    newOrderTableIds.size + statusCounts.awaiting_bill;

  const selectedTableLive = selectedTable
    ? tables.find((table) => table.id === selectedTable.id) ??
      selectedTable
    : null;

  return (
    <div className="min-h-full bg-[#F5F6F8]">
      {/* Application header */}
      <header className="sticky top-0 z-30 border-b border-[#DFE2E7] bg-white">
        <div className="flex h-[68px] items-center justify-between px-5 lg:px-7">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.02em] text-[#15181D]">
                Main Floor
              </div>

              <div className="mt-0.5 text-[10px] text-[#858B95]">
                {allVisibleTables.length} tables ·{" "}
                {statusCounts.dining} active
              </div>
            </div>

            <div className="hidden h-6 w-px bg-[#E2E5E9] sm:block" />

            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium text-[#737983]">
                Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {attentionCount > 0 && (
              <div className="hidden items-center gap-2 rounded-[4px] border border-[#E6D9B8] bg-[#FFFBF1] px-3 py-2 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium text-[#80651D]">
                  {attentionCount} require attention
                </span>
              </div>
            )}

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171A1F] text-[10px] font-semibold text-white">
              {formatStaffName(profile.full_name)
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 lg:px-7 lg:py-7">
        {/* Metrics */}
        <section className="mb-6 grid grid-cols-2 border border-[#DEE1E6] bg-white sm:grid-cols-4">
          <Metric
            label="Available"
            value={statusCounts.vacant}
            detail="tables"
          />

          <Metric
            label="Dining"
            value={statusCounts.dining}
            detail="active tables"
          />

          <Metric
            label="Bill requested"
            value={statusCounts.awaiting_bill}
            detail="need attention"
            warning={statusCounts.awaiting_bill > 0}
          />

          <Metric
            label="Paid"
            value={statusCounts.paid}
            detail="completed"
            success={statusCounts.paid > 0}
          />
        </section>

        {/* Floor controls */}
        <section className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-[#15181D]">
              Floor
            </h1>

            <p className="mt-1 text-[11px] text-[#858B95]">
              Monitor tables, orders and service activity in real time.
            </p>
          </div>

          <div className="flex overflow-x-auto border border-[#DDE0E5] bg-white">
            {FILTERS.map((item) => {
              const active = filter === item.id;

              const count =
                item.id === "all"
                  ? allVisibleTables.length
                  : statusCounts[item.id];

              return (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`flex h-9 shrink-0 items-center gap-2 border-r border-[#E2E4E8] px-3 text-[10px] font-medium transition-colors last:border-r-0 ${
                    active
                      ? "bg-[#171A1F] text-white"
                      : "bg-white text-[#69707A] hover:bg-[#F5F6F8]"
                  }`}
                >
                  {item.label}

                  <span
                    className={`font-mono text-[9px] ${
                      active
                        ? "text-[#C7CBD2]"
                        : "text-[#999FA8]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Floor grid */}
        <section className="border border-[#DEE1E6] bg-white">
          <div className="flex h-11 items-center justify-between border-b border-[#E2E4E8] px-4">
            <div className="flex items-center gap-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737983]">
                Tables
              </span>

              <div className="hidden items-center gap-4 sm:flex">
                <Legend color="bg-[#C9CDD3]" label="Available" />
                <Legend color="bg-[#2563EB]" label="Dining" />
                <Legend color="bg-[#D99A20]" label="Bill" />
                <Legend color="bg-[#16A34A]" label="Paid" />
              </div>
            </div>

            <span className="font-mono text-[9px] text-[#969BA4]">
              {visibleTables.length} shown
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px bg-[#E4E6EA] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                hasNewOrder={newOrderTableIds.has(table.id)}
                hasUnpaidOrder={unpaidTableIds.has(table.id)}
                waiterName={
                  table.current_waiter_id
                    ? waiterNames[table.current_waiter_id]
                    : undefined
                }
                onOpenDetail={() => setSelectedTable(table)}
              />
            ))}

            {visibleTables.length === 0 && (
              <div className="col-span-full bg-white px-6 py-16 text-center">
                <div className="text-[12px] font-medium text-[#555C66]">
                  No tables in this view
                </div>

                <p className="mt-1 text-[10px] text-[#969BA4]">
                  Try selecting another floor filter.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Operational summary */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <OperationalPanel
            title="New orders"
            count={newOrderTableIds.size}
          >
            {newOrderTableIds.size === 0 ? (
              <EmptyState text="No new orders waiting." />
            ) : (
              [...newOrderTableIds].slice(0, 5).map((tableId) => {
                const table = tables.find(
                  (item) => item.id === tableId
                );

                if (!table) return null;

                return (
                  <div
                    key={tableId}
                    className="flex items-center justify-between border-b border-[#ECEEF1] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-semibold">
                        T{table.table_number}
                      </span>

                      <span className="text-[10px] text-[#737983]">
                        New order received
                      </span>
                    </div>

                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  </div>
                );
              })
            )}
          </OperationalPanel>

          <OperationalPanel
            title="Service attention"
            count={statusCounts.awaiting_bill}
          >
            {statusCounts.awaiting_bill === 0 ? (
              <EmptyState text="No tables waiting for service." />
            ) : (
              allVisibleTables
                .filter((table) => table.status === "awaiting_bill")
                .slice(0, 5)
                .map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className="flex w-full items-center justify-between border-b border-[#ECEEF1] px-4 py-3 text-left last:border-b-0 hover:bg-[#F8F9FA]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-semibold">
                        T{table.table_number}
                      </span>

                      <span className="text-[10px] text-[#737983]">
                        Bill requested
                      </span>
                    </div>

                    <span className="text-[9px] font-medium text-amber-600">
                      View
                    </span>
                  </button>
                ))
            )}
          </OperationalPanel>
        </section>
      </main>

      {/* Table drawer */}
      {selectedTableLive && (
        <TableDetailModal
          table={selectedTableLive}
          role={profile.role}
          waiters={waiters}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  warning,
  success,
}: {
  label: string;
  value: number;
  detail: string;
  warning?: boolean;
  success?: boolean;
}) {
  return (
    <div className="border-r border-[#E2E4E8] px-4 py-4 last:border-r-0 sm:px-5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#858B95]">
          {label}
        </span>

        {warning && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        )}

        {success && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold tracking-[-0.04em] text-[#15181D]">
          {value}
        </span>

        <span className="text-[9px] text-[#969BA4]">
          {detail}
        </span>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] text-[#858B95]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function OperationalPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#DEE1E6] bg-white">
      <div className="flex h-11 items-center justify-between border-b border-[#E2E4E8] px-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737983]">
          {title}
        </span>

        <span className="font-mono text-[9px] text-[#969BA4]">
          {String(count).padStart(2, "0")}
        </span>
      </div>

      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-[10px] text-[#969BA4]">
      {text}
    </div>
  );
}