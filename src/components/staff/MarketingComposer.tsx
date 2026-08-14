"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createCampaign } from "@/app/actions/marketing";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MarketingCampaign } from "@/types/database";

export function MarketingComposer({
  initialCampaigns,
  optedInCount,
  zendioAccountId,
  zendioAccountLabel,
}: {
  initialCampaigns: MarketingCampaign[];
  optedInCount: number;
  zendioAccountId: string | null;
  zendioAccountLabel: string | null;
}) {
  const searchParams = useSearchParams();
  const customerIds = searchParams.get("customerIds")?.split(",").filter(Boolean) ?? [];
  const isTargeted = customerIds.length > 0;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [daysSinceLastVisit, setDaysSinceLastVisit] = useState("");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountId = zendioAccountId;
  const accountLabel = zendioAccountLabel;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createCampaign({
      title,
      messageBody: message,
      daysSinceLastVisit: daysSinceLastVisit ? Number(daysSinceLastVisit) : undefined,
      customerIds: isTargeted ? customerIds : undefined,
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not send campaign");
      return;
    }

    setCampaigns((prev) => [
      {
        id: result.data!.campaignId,
        title,
        message_body: message,
        total_recipients: isTargeted ? customerIds.length : optedInCount,
        status: "processing",
        created_by: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setTitle("");
    setMessage("");
    setDaysSinceLastVisit("");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Marketing" description="Send WhatsApp broadcasts to opted-in customers." />

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">WhatsApp Connection</h2>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              {accountId ? `Connected: ${accountLabel ?? accountId}` : "Not connected yet."}
            </p>
          </div>
          <Link href="/admin/settings" className="btn btn-secondary">
            Manage in Settings
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="card flex flex-col gap-4 p-6"
        >
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Draft a Broadcast</h2>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              {optedInCount} customers opted in to WhatsApp specials.
            </p>
          </div>

          {isTargeted && (
            <p className="rounded-lg bg-[var(--accent-50)] px-3 py-2 text-sm text-[var(--accent-700)]">
              Targeting {customerIds.length} customer{customerIds.length === 1 ? "" : "s"} selected from the CRM
              (still filtered to those opted in to WhatsApp).
            </p>
          )}

          {!accountId && (
            <p className="rounded-lg bg-[var(--warning-50)] px-3 py-2 text-sm text-[var(--warning-600)]">
              Connect &amp; detect a WhatsApp account above before sending.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
          )}

          <label className="text-sm">
            <span className="label">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
            />
          </label>

          <label className="text-sm">
            <span className="label">Message</span>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input"
            />
          </label>

          <label className={`text-sm ${isTargeted ? "opacity-50" : ""}`}>
            <span className="label">Only customers with no visit in the last (days)</span>
            <input
              type="number"
              min={0}
              disabled={isTargeted}
              value={daysSinceLastVisit}
              onChange={(e) => setDaysSinceLastVisit(e.target.value)}
              placeholder="e.g. 14 (optional)"
              className="input"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !accountId}
            className="btn btn-primary mt-2 w-full"
          >
            {loading ? "Sending…" : "Send via Zendio"}
          </button>
        </form>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Send History</h2>
          <div className="mt-2 flex flex-col">
            {campaigns.map((c) => (
              <div key={c.id} className="list-row">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{c.title}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">{c.total_recipients} recipients</p>
                </div>
                <span
                  className={`badge capitalize ${
                    c.status === "completed"
                      ? "badge-success"
                      : c.status === "failed"
                      ? "badge-danger"
                      : "badge-warning"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
            {campaigns.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">
                No campaigns sent yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
