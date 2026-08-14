"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerDetailModal } from "./CustomerDetailModal";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CustomerSummary, PaymentSegment } from "@/app/actions/customers";

type SortKey = "spend" | "loyalty" | "orders" | "lastVisit";
type PaymentFilter = "all" | PaymentSegment;

const PAYMENT_BADGE: Record<PaymentSegment, string> = {
  cash: "badge-warning",
  card: "badge-accent",
  mixed: "badge-neutral",
  none: "badge-neutral",
};
const PAYMENT_LABEL: Record<PaymentSegment, string> = {
  cash: "Cash",
  card: "Card",
  mixed: "Mixed",
  none: "No data",
};

export function CustomerManager({ initialCustomers }: { initialCustomers: CustomerSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [optedInOnly, setOptedInOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailCustomer, setDetailCustomer] = useState<CustomerSummary | null>(null);

  const filtered = useMemo(() => {
    let rows = initialCustomers;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (c) => (c.full_name ?? "").toLowerCase().includes(q) || (c.phone_number ?? "").includes(q)
      );
    }
    if (paymentFilter !== "all") rows = rows.filter((c) => c.paymentSegment === paymentFilter);
    if (optedInOnly) rows = rows.filter((c) => c.whatsapp_opt_in);

    const sorted = [...rows];
    if (sortKey === "spend") sorted.sort((a, b) => b.totalSpend - a.totalSpend);
    else if (sortKey === "loyalty") sorted.sort((a, b) => b.loyalty_points - a.loyalty_points);
    else if (sortKey === "orders") sorted.sort((a, b) => b.orderCount - a.orderCount);
    else sorted.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
    return sorted;
  }, [initialCustomers, search, paymentFilter, optedInOnly, sortKey]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((c) => prev.has(c.id));
      return allSelected ? new Set() : new Set(filtered.map((c) => c.id));
    });
  }

  function handleLaunchCampaign() {
    router.push(`/staff/marketing?customerIds=${encodeURIComponent([...selected].join(","))}`);
  }

  const totalRevenue = initialCustomers.reduce((sum, c) => sum + c.totalSpend, 0);
  const optedInCount = initialCustomers.filter((c) => c.whatsapp_opt_in).length;

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${initialCustomers.length} guests · ${formatCurrency(totalRevenue)} lifetime spend · ${optedInCount} opted in to WhatsApp`}
      />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or phone"
            className="input w-48"
          />
        </label>
        <label className="text-sm">
          <span className="label">Sort by</span>
          <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-40">
            <option value="spend">Total spend</option>
            <option value="loyalty">Loyalty points</option>
            <option value="orders">Order count</option>
            <option value="lastVisit">Last visit</option>
          </Select>
        </label>
        <label className="text-sm">
          <span className="label">Payment method</span>
          <Select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="w-36"
          >
            <option value="all">All</option>
            <option value="cash">Cash payers</option>
            <option value="card">Card payers</option>
            <option value="mixed">Mixed</option>
            <option value="none">No orders yet</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={optedInOnly} onChange={(e) => setOptedInOnly(e.target.checked)} />
          WhatsApp opted-in only
        </label>
        {selected.size > 0 && (
          <button onClick={handleLaunchCampaign} className="btn btn-primary ml-auto">
            Send Campaign to Selected ({selected.size})
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                  onChange={toggleSelectAllVisible}
                />
              </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Total Spend</th>
              <th className="px-4 py-3">Loyalty</th>
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--gray-50)]">
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelected(c.id)} />
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  {c.full_name ?? "Guest"}
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  {c.phone_number ?? "—"}
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  <span className={`badge ${PAYMENT_BADGE[c.paymentSegment]}`}>{PAYMENT_LABEL[c.paymentSegment]}</span>
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  {c.orderCount}
                </td>
                <td
                  className="cursor-pointer px-4 py-3 font-semibold text-[var(--foreground)]"
                  onClick={() => setDetailCustomer(c)}
                >
                  {formatCurrency(c.totalSpend)}
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  {c.loyalty_points}
                </td>
                <td
                  className="cursor-pointer px-4 py-3 text-xs text-[var(--foreground-muted)]"
                  onClick={() => setDetailCustomer(c)}
                >
                  {c.lastVisit ? formatDateTime(c.lastVisit) : "—"}
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => setDetailCustomer(c)}>
                  <span className={`badge ${c.whatsapp_opt_in ? "badge-success" : "badge-neutral"}`}>
                    {c.whatsapp_opt_in ? "Opted in" : "Not opted in"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--foreground-muted)]">No customers match these filters.</p>
        )}
      </div>

      {detailCustomer && (
        <CustomerDetailModal
          customerId={detailCustomer.id}
          customerName={detailCustomer.full_name ?? "Guest"}
          onClose={() => setDetailCustomer(null)}
        />
      )}
    </div>
  );
}
