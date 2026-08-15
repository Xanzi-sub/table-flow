"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { resolveFeedback } from "@/app/actions/feedback";
import type {
  CustomerSegment,
  IntelligenceSnapshot,
  MenuPerformanceRow,
} from "@/app/actions/intelligence";

type View = "overview" | "menu" | "customers" | "floor" | "feedback";

const ITEM_LABELS: Record<MenuPerformanceRow["label"], string> = {
  best_seller: "Best seller",
  rising: "Rising",
  slow_mover: "Slow mover",
  high_revenue: "High revenue",
  steady: "Steady",
};

const ITEM_BADGES: Record<MenuPerformanceRow["label"], string> = {
  best_seller: "badge-success",
  rising: "badge-accent",
  slow_mover: "badge-warning",
  high_revenue: "badge-success",
  steady: "badge-neutral",
};

function campaignHref(segment: CustomerSegment) {
  const ids = segment.optedInIds.join(",");
  return ids ? `/staff/marketing?customerIds=${encodeURIComponent(ids)}` : "/staff/marketing";
}

export function IntelligenceDashboard({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  const [view, setView] = useState<View>("overview");
  const revenueChange = snapshot.previousDay.revenue
    ? Math.round(((snapshot.today.revenue - snapshot.previousDay.revenue) / snapshot.previousDay.revenue) * 100)
    : null;

  return (
    <div>
      <PageHeader
        title="Intelligence"
        description={`Actionable menu, customer and floor signals · updated ${formatDateTime(snapshot.generatedAt)}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(["overview", "menu", "customers", "floor", "feedback"] as View[]).map((option) => (
              <button
                key={option}
                onClick={() => setView(option)}
                className={`btn capitalize ${view === option ? "btn-primary" : "btn-secondary"}`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      {view === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label="Revenue today"
              value={formatCurrency(snapshot.today.revenue)}
              detail={revenueChange === null ? "No prior-day baseline" : `${revenueChange >= 0 ? "+" : ""}${revenueChange}% vs yesterday`}
            />
            <Metric label="Paid orders" value={snapshot.today.orders.toString()} detail={`${snapshot.previousDay.orders} yesterday`} />
            <Metric label="Customers" value={snapshot.today.customers.toString()} detail={`${snapshot.today.returningCustomers} returning`} />
            <Metric label="Live floor" value={`${snapshot.today.activeTables} tables`} detail={`${snapshot.today.serviceRequests} need attention`} warning={snapshot.today.serviceRequests > 0} />
          </div>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)]">Manager briefing</h2>
                <p className="mt-1 text-xs text-[var(--foreground-muted)]">What changed, what needs attention, and where the opportunity is.</p>
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {snapshot.briefing.map((insight, index) => (
                <div key={`${index}-${insight}`} className="flex gap-3 border border-[var(--border)] bg-[var(--gray-25)] p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-50)] text-xs font-bold text-[var(--accent-700)]">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-5 text-[var(--gray-700)]">{insight}</p>
                </div>
              ))}
              {snapshot.briefing.length === 0 && (
                <p className="text-sm text-[var(--foreground-muted)]">Not enough completed order history yet. Insights will appear as transactions accumulate.</p>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <TopMenuItems rows={snapshot.menuPerformance.slice(0, 6)} />
            <PairingList pairings={snapshot.pairings.slice(0, 5)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SegmentGrid segments={snapshot.segments.filter((segment) => ["loyal", "lapsed", "high_value"].includes(segment.id))} compact />
            <FloorPressure snapshot={snapshot} />
          </div>
        </div>
      )}

      {view === "menu" && <MenuIntelligence snapshot={snapshot} />}
      {view === "customers" && <SegmentGrid segments={snapshot.segments} />}
      {view === "floor" && <FloorIntelligence snapshot={snapshot} />}
      {view === "feedback" && <FeedbackQueue snapshot={snapshot} />}
    </div>
  );
}

function Metric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return (
    <div className="stat-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-bold ${warning ? "text-[var(--warning-600)]" : "text-[var(--foreground)]"}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">{detail}</p>
    </div>
  );
}

function TopMenuItems({ rows }: { rows: MenuPerformanceRow[] }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-[var(--foreground)]">Menu leaders · last 30 days</h2>
      <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
              <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{item.category} · {item.units} units · {item.orders} orders</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-[var(--foreground)]">{formatCurrency(item.revenue)}</p>
              <span className={`badge mt-1 ${ITEM_BADGES[item.label]}`}>{ITEM_LABELS[item.label]}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-sm text-[var(--foreground-muted)]">No paid order data yet.</p>}
      </div>
    </section>
  );
}

function PairingList({ pairings }: { pairings: IntelligenceSnapshot["pairings"] }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-[var(--foreground)]">Frequently bought together</h2>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">Use these as guest upsells or manager-approved combos.</p>
      <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
        {pairings.map((pair) => (
          <div key={`${pair.firstItemId}-${pair.secondItemId}`} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{pair.firstItem} + {pair.secondItem}</p>
              <p className="shrink-0 text-sm font-bold text-[var(--foreground)]">{formatCurrency(pair.combinedPrice)}</p>
            </div>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              Together in {pair.orderCount} paid orders · {pair.attachRate}% attach rate
            </p>
          </div>
        ))}
        {pairings.length === 0 && <p className="py-6 text-sm text-[var(--foreground-muted)]">Pairings appear after at least two items are bought together.</p>}
      </div>
    </section>
  );
}

function MenuIntelligence({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  const slowMovers = snapshot.menuPerformance.filter((item) => item.label === "slow_mover");
  const rising = snapshot.menuPerformance.filter((item) => item.label === "rising");
  const best = snapshot.menuPerformance.find((item) => item.label === "best_seller");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Opportunity title="Promote the leader" body={best ? `${best.name} generated ${formatCurrency(best.revenue)} from ${best.units} units in 30 days. Keep it prominent.` : "No clear leader yet."} />
        <Opportunity title="Review slow movers" body={`${slowMovers.length} items sold fewer than 5 units in 30 days. Review placement, price, photo, description or removal.`} />
        <Opportunity title="Watch rising demand" body={rising.length ? `${rising.map((item) => item.name).slice(0, 3).join(", ")} grew at least 20% versus the prior period.` : "No statistically useful rising items yet."} />
      </div>

      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Trend</th>
              <th className="px-4 py-3">Signal</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.menuPerformance.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{item.name}</td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{item.category}</td>
                <td className="px-4 py-3">{item.units}</td>
                <td className="px-4 py-3">{item.orders}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(item.revenue)}</td>
                <td className={`px-4 py-3 text-xs font-semibold ${item.trendPercent === null ? "text-[var(--foreground-muted)]" : item.trendPercent >= 0 ? "text-[var(--success-600)]" : "text-[var(--danger-600)]"}`}>
                  {item.trendPercent === null ? "—" : `${item.trendPercent >= 0 ? "+" : ""}${item.trendPercent}%`}
                </td>
                <td className="px-4 py-3"><span className={`badge ${ITEM_BADGES[item.label]}`}>{ITEM_LABELS[item.label]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PairingList pairings={snapshot.pairings} />
    </div>
  );
}

function Opportunity({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">{body}</p>
    </div>
  );
}

function SegmentGrid({ segments, compact = false }: { segments: CustomerSegment[]; compact?: boolean }) {
  return (
    <section className={compact ? "card p-5" : ""}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--foreground)]">Automatic customer segments</h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Derived from paid-order recency, frequency, value and visit time.</p>
        </div>
        <Link href="/admin/customers" className="btn btn-secondary">Open CRM</Link>
      </div>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {segments.map((segment) => (
          <div key={segment.id} className="border border-[var(--border)] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">{segment.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">{segment.description}</p>
              </div>
              <span className="text-2xl font-bold text-[var(--foreground)]">{segment.count}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
              <p className="text-xs text-[var(--foreground-muted)]">{segment.optedInIds.length} WhatsApp eligible</p>
              <Link href={campaignHref(segment)} className={`btn !py-1 !text-xs ${segment.optedInIds.length ? "btn-primary" : "btn-secondary"}`}>
                Create campaign
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FloorPressure({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-[var(--foreground)]">Floor pressure</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniMetric label="Active tables" value={snapshot.today.activeTables} />
        <MiniMetric label="Service requests" value={snapshot.today.serviceRequests} warning />
        <MiniMetric label="Awaiting bill" value={snapshot.today.awaitingBill} />
        <MiniMetric label="Unassigned" value={snapshot.today.unassignedTables} warning />
      </div>
    </section>
  );
}

function MiniMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--gray-25)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-bold ${warning && value ? "text-[var(--warning-600)]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

function FloorIntelligence({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <FloorPressure snapshot={snapshot} />
      <section className="card overflow-x-auto p-0">
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="text-sm font-bold text-[var(--foreground)]">Waiter workload · last 30 days</h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Operational context, not employee surveillance.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
              <th className="px-4 py-3">Waiter</th>
              <th className="px-4 py-3">Active tables</th>
              <th className="px-4 py-3">Paid orders</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Tips</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.waiterInsights.map((waiter) => (
              <tr key={waiter.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{waiter.name}</td>
                <td className="px-4 py-3">{waiter.activeTables}</td>
                <td className="px-4 py-3">{waiter.paidOrders}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(waiter.revenue)}</td>
                <td className="px-4 py-3">{formatCurrency(waiter.tips)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FeedbackQueue({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  const [rows, setRows] = useState(snapshot.feedback.recoveryQueue);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  async function updateStatus(feedbackId: string, status: "contacted" | "resolved") {
    setSavingId(feedbackId);
    const result = await resolveFeedback({ feedbackId, status, notes: notesById[feedbackId] });
    setSavingId(null);
    if (!result.success) return;
    setRows((current) =>
      current.map((row) =>
        row.id === feedbackId
          ? { ...row, recoveryStatus: status, recoveryNotes: notesById[feedbackId] || null }
          : row
      )
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Average rating"
          value={snapshot.feedback.averageRating === null ? "—" : `${snapshot.feedback.averageRating}/5`}
          detail={`${snapshot.feedback.totalResponses} responses`}
        />
        <Metric
          label="Open recovery"
          value={snapshot.feedback.lowRatingCount.toString()}
          detail="Ratings of 1–2 not resolved"
          warning={snapshot.feedback.lowRatingCount > 0}
        />
        <Metric
          label="Recovery queue"
          value={rows.filter((row) => row.recoveryStatus !== "resolved").length.toString()}
          detail="Ratings of 1–3"
        />
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${row.rating <= 2 ? "badge-danger" : "badge-warning"}`}>{row.rating}/5</span>
                  <span className="badge badge-neutral capitalize">{row.recoveryStatus}</span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-[var(--foreground)]">{row.customerName} · {row.tableLabel}</h3>
                <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                  {row.waiterName} · Order #{row.orderId.slice(0, 8).toUpperCase()} · {formatDateTime(row.createdAt)}
                </p>
              </div>
              {row.whatsappEligible && row.recoveryStatus !== "resolved" && (
                <Link href={`/staff/marketing?customerIds=${encodeURIComponent(row.customerId)}`} className="btn btn-secondary !text-xs">
                  Contact via WhatsApp
                </Link>
              )}
            </div>
            <p className="mt-3 border-l-2 border-[var(--border-strong)] pl-3 text-sm leading-6 text-[var(--gray-700)]">
              {row.comment || "No written comment was provided."}
            </p>
            {row.recoveryStatus !== "resolved" && (
              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-sm">
                  <span className="label">Recovery notes</span>
                  <input
                    value={notesById[row.id] ?? row.recoveryNotes ?? ""}
                    onChange={(event) => setNotesById((current) => ({ ...current, [row.id]: event.target.value }))}
                    className="input"
                    placeholder="What did the team do to recover this experience?"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(row.id, "contacted")}
                    disabled={savingId === row.id}
                    className="btn btn-secondary"
                  >
                    Mark contacted
                  </button>
                  <button
                    onClick={() => updateStatus(row.id, "resolved")}
                    disabled={savingId === row.id}
                    className="btn btn-primary"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {rows.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--foreground-muted)]">
            No low-rating feedback has been submitted.
          </div>
        )}
      </div>
    </div>
  );
}
