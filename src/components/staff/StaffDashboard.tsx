"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, StaffProfile, TableRow } from "@/types/database";
import { TableCard } from "./TableCard";
import { TableDetailModal } from "./TableDetailModal";
import { PageHeader } from "@/components/ui/PageHeader";

interface StaffDashboardProps {
  profile: StaffProfile;
  initialTables: TableRow[];
  initialOrders: Order[];
  waiterNames: Record<string, string>;
  waiters: Pick<StaffProfile, "id" | "full_name" | "is_checked_in">[];
}

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

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("staff-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        (payload) => {
          setTables((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== (payload.old as TableRow).id);
            }
            const updated = payload.new as TableRow;
            const exists = prev.some((t) => t.id === updated.id);
            return exists
              ? prev.map((t) => (t.id === updated.id ? updated : t))
              : [...prev, updated];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((o) => o.id !== (payload.old as Order).id);
            }
            const updated = payload.new as Order;
            const exists = prev.some((o) => o.id === updated.id);
            return exists
              ? prev.map((o) => (o.id === updated.id ? updated : o))
              : [...prev, updated];
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
        orders.filter((o) => o.status === "pending").map((o) => o.table_id)
      ),
    [orders]
  );

  const unpaidTableIds = useMemo(
    () =>
      new Set(
        orders.filter((o) => o.payment_status !== "paid").map((o) => o.table_id)
      ),
    [orders]
  );

  const visibleTables = useMemo(() => {
    if (profile.role !== "waiter") return tables;
    return tables.filter((t) => t.current_waiter_id === profile.id);
  }, [tables, profile]);

  const statusCounts = useMemo(() => {
    const counts = { vacant: 0, dining: 0, awaiting_bill: 0, paid: 0 };
    for (const t of visibleTables) counts[t.status]++;
    return counts;
  }, [visibleTables]);

  return (
    <div>
      <PageHeader
        title="Live Floor"
        description={`${visibleTables.length} table${visibleTables.length === 1 ? "" : "s"} · ${newOrderTableIds.size} new order${newOrderTableIds.size === 1 ? "" : "s"}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Vacant</p>
          <p className="mt-1 text-2xl font-bold text-[var(--gray-500)]">{statusCounts.vacant}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Dining</p>
          <p className="mt-1 text-2xl font-bold text-[var(--accent-600)]">{statusCounts.dining}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Awaiting Bill</p>
          <p className="mt-1 text-2xl font-bold text-[var(--warning-600)]">{statusCounts.awaiting_bill}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Paid</p>
          <p className="mt-1 text-2xl font-bold text-[var(--success-600)]">{statusCounts.paid}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
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
          <p className="col-span-full rounded-lg border border-dashed border-[var(--border-strong)] py-10 text-center text-sm text-[var(--foreground-muted)]">
            No tables assigned yet.
          </p>
        )}
      </div>

      {selectedTable && (
        <TableDetailModal
          table={tables.find((t) => t.id === selectedTable.id) ?? selectedTable}
          role={profile.role}
          waiters={waiters}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}
