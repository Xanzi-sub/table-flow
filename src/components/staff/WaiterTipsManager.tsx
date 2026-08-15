"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { requestTipCashout } from "@/app/actions/tips";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { TipCashoutRequest, TipCashoutStatus } from "@/types/database";
import type { WaiterTipSummary } from "@/app/actions/tips";

const STATUS_BADGE: Record<TipCashoutStatus, string> = {
  pending: "badge-warning",
  scheduled: "badge-accent",
  approved: "badge-success",
  rejected: "badge-danger",
};

export function WaiterTipsManager({
  waiterId,
  initialSummary,
  initialRequests,
}: {
  waiterId: string;
  initialSummary: WaiterTipSummary;
  initialRequests: TipCashoutRequest[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [requests, setRequests] = useState(initialRequests);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCashout() {
    setRequesting(true);
    setError(null);

    const result = await requestTipCashout(waiterId);
    setRequesting(false);

    if (!result.success || !result.data) {
      setError(result.error ?? "Could not submit cash-out request");
      return;
    }

    setRequests((prev) => [
      {
        id: crypto.randomUUID(),
        waiter_id: waiterId,
        amount: result.data!.amount,
        status: "pending",
        scheduled_for: null,
        notes: null,
        requested_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      },
      ...prev,
    ]);
    setSummary((prev) => ({
      ...prev,
      availableForCashout: 0,
      pendingCashoutAmount: prev.pendingCashoutAmount + result.data!.amount,
    }));
  }

  return (
    <div>
      <PageHeader title="My Tips" description="Cash tips are yours directly — this tracks card tips owed to you." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Cash tips</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{formatCurrency(summary.cashTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Card tips (all time)</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{formatCurrency(summary.cardTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Pending cash-out</p>
          <p className="mt-1 text-2xl font-bold text-[var(--warning-600)]">{formatCurrency(summary.pendingCashoutAmount)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Available to cash out</p>
          <p className="mt-1 text-2xl font-bold text-[var(--success-600)]">{formatCurrency(summary.availableForCashout)}</p>
        </div>
      </div>

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Request a cash-out</p>
          <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
            Submits every card/online tip you haven&apos;t cashed out yet for manager approval.
          </p>
        </div>
        <button
          onClick={handleCashout}
          disabled={requesting || summary.availableForCashout <= 0}
          className="btn btn-primary"
        >
          {requesting ? "Submitting…" : `Cash Out ${formatCurrency(summary.availableForCashout)}`}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scheduled for</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{formatDateTime(r.requested_at)}</td>
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{formatCurrency(r.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`badge capitalize ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
                  {r.scheduled_for ? formatDateTime(r.scheduled_for) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{r.notes ?? "—"}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--foreground-muted)]">
                  No cash-out requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
