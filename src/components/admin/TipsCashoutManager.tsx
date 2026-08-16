"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAllCashoutRequests, resolveCashoutRequest } from "@/app/actions/tips";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime, formatStaffName } from "@/lib/utils";
import type { TipCashoutStatus } from "@/types/database";

const STATUS_BADGE: Record<TipCashoutStatus, string> = {
  pending: "badge-warning",
  scheduled: "badge-accent",
  approved: "badge-success",
  rejected: "badge-danger",
};

interface CashoutRequestRow {
  id: string;
  waiter_id: string;
  amount: number;
  status: TipCashoutStatus;
  scheduled_for: string | null;
  notes: string | null;
  requested_at: string;
  resolved_at: string | null;
  staff_profiles: { full_name: string } | { full_name: string }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function ResolvePanel({
  request,
  onResolved,
  onClose,
}: {
  request: CashoutRequestRow;
  onResolved: (id: string, patch: Partial<CashoutRequestRow>) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"approve" | "schedule" | "reject">("approve");
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const status: TipCashoutStatus = mode === "approve" ? "approved" : mode === "schedule" ? "scheduled" : "rejected";
    const result = await resolveCashoutRequest(request.id, {
      status,
      scheduledFor: mode === "schedule" ? scheduledFor || undefined : undefined,
      notes: notes || undefined,
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not resolve request");
      return;
    }

    onResolved(request.id, {
      status,
      scheduled_for: mode === "schedule" ? scheduledFor || null : null,
      notes: notes || null,
      resolved_at: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-[var(--border)] bg-[var(--surface)] p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-[var(--foreground)]">
          Resolve cash-out — {formatCurrency(request.amount)}
        </h2>

        <div className="mt-3 flex gap-1.5">
          {(["approve", "schedule", "reject"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`btn flex-1 !text-xs ${mode === m ? "btn-primary" : "btn-secondary"}`}
            >
              {m === "approve" ? "Approve now" : m === "schedule" ? "Schedule" : "Reject"}
            </button>
          ))}
        </div>

        {mode === "schedule" && (
          <label className="mt-3 block text-sm">
            <span className="label">Process by</span>
            <input
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="input"
            />
          </label>
        )}

        <label className="mt-3 block text-sm">
          <span className="label">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input"
            placeholder={mode === "reject" ? "Why is this being rejected?" : "Any context for the waiter"}
          />
        </label>

        {error && <p className="mt-2 text-xs font-semibold text-[var(--danger-600)]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn btn-primary">
            {loading ? "…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TipsCashoutManager({ initialRequests }: { initialRequests: CashoutRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [resolving, setResolving] = useState<CashoutRequestRow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function refresh() {
      const latest = await listAllCashoutRequests();
      setRequests(latest as unknown as CashoutRequestRow[]);
    }
    const channel = supabase
      .channel("admin-tip-cashouts")
      .on("postgres_changes", { event: "*", schema: "public", table: "tip_cashout_requests" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const fallback = window.setInterval(refresh, 5000);
    return () => {
      window.clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, []);

  function handleResolved(id: string, patch: Partial<CashoutRequestRow>) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const pendingTotal = requests
    .filter((r) => r.status === "pending" || r.status === "scheduled")
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Tips Cash-outs"
        description={`${requests.length} requests · ${formatCurrency(pendingTotal)} pending/scheduled`}
      />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Waiter</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scheduled for</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const waiter = one(r.staff_profiles);
              const isPending = r.status === "pending" || r.status === "scheduled";
              return (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{formatDateTime(r.requested_at)}</td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{formatStaffName(waiter?.full_name, "Staff member")}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge capitalize ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
                    {r.scheduled_for ? formatDateTime(r.scheduled_for) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{r.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {isPending && (
                      <button onClick={() => setResolving(r)} className="btn btn-secondary !py-1 !text-xs">
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--foreground-muted)]">
                  No cash-out requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resolving && (
        <ResolvePanel request={resolving} onResolved={handleResolved} onClose={() => setResolving(null)} />
      )}
    </div>
  );
}
