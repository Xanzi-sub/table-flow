"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { formatDateTime } from "@/lib/utils";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/database";

interface TicketWithMessages extends SupportTicket {
  messages: SupportTicketMessage[];
  events: unknown[];
}

const STATUS_BADGES: Record<SupportTicketStatus, string> = {
  open: "badge-warning",
  in_progress: "badge-accent",
  waiting_on_venue: "badge-danger",
  resolved: "badge-success",
  closed: "badge-neutral",
};

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  technical: "Technical issue",
  billing: "Billing / subscription",
  menu: "Menu setup",
  orders: "Orders / tables",
  payments: "Payments / tips",
  whatsapp: "WhatsApp / messaging",
  account: "Account / staff access",
  other: "Other",
};

export function SupportTicketSection() {
  const [tickets, setTickets] = useState<TicketWithMessages[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [reply, setReply] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" });
      const result = (await response.json()) as TicketWithMessages[] | { error?: string };
      if (!response.ok || !Array.isArray(result)) {
        setError(!Array.isArray(result) ? result.error ?? "Could not load support tickets" : "Could not load support tickets");
        return;
      }
      setTickets(result);
    } catch {
      setError("Could not reach support. The page will retry automatically.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    void refresh();
    const channel = supabase
      .channel("venue-support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_ticket_messages" }, refresh)
      .subscribe();
    const fallback = window.setInterval(refresh, 8000);
    return () => {
      window.clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, []);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (filter === "active") return !["resolved", "closed"].includes(ticket.status);
        if (filter === "resolved") return ["resolved", "closed"].includes(ticket.status);
        return true;
      }),
    [tickets, filter]
  );

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", subject, description, category, priority }),
      });
      const result = (await response.json()) as SupportTicket | { error?: string };
      if (!response.ok || !("id" in result)) {
        setError("error" in result ? result.error ?? "Could not create ticket" : "Could not create ticket");
        return;
      }
      setSubject("");
      setDescription("");
      setCategory("technical");
      setPriority("normal");
      await refresh();
      setSelectedId(result.id);
    } catch {
      setError("Could not reach support. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    setError(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", ticketId: selected.id, message: reply }),
      });
      const result = (await response.json()) as SupportTicketMessage | { error?: string };
      if (!response.ok || !("id" in result)) {
        setError("error" in result ? result.error ?? "Could not send reply" : "Could not send reply");
        return;
      }
      setReply("");
      await refresh();
    } catch {
      setError("Could not send reply. Please try again.");
    } finally {
      setReplying(false);
    }
  }

  async function updateStatus(status: SupportTicketStatus) {
    if (!selected) return;
    setError(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selected.id, status }),
      });
      const result = (await response.json()) as SupportTicket | { error?: string };
      if (!response.ok || !("id" in result)) {
        setError("error" in result ? result.error ?? "Could not update ticket" : "Could not update ticket");
        return;
      }
      await refresh();
    } catch {
      setError("Could not update ticket. Please try again.");
    }
  }

  return (
    <section id="support" className="card p-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Support</h2>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Report a problem, follow its progress, and reply directly to the TableFlow support team.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}

      <div className="mt-5 grid gap-6 xl:grid-cols-[360px_1fr]">
        <div>
          <form onSubmit={createTicket} className="border border-[var(--border)] bg-[var(--gray-25)] p-4">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Open a support ticket</h3>
            <div className="mt-3 flex flex-col gap-3">
              <label className="text-sm">
                <span className="label">Subject</span>
                <input required value={subject} onChange={(event) => setSubject(event.target.value)} className="input" placeholder="What do you need help with?" />
              </label>
              <label className="text-sm">
                <span className="label">Category</span>
                <Select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="label">Priority</span>
                <Select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent — service blocked</option>
                </Select>
              </label>
              <label className="text-sm">
                <span className="label">Description</span>
                <textarea required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="input" placeholder="Include what happened, when it started, and what you expected." />
              </label>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </form>

          <div className="mt-4 flex gap-1.5">
            {(["active", "resolved", "all"] as const).map((option) => (
              <button key={option} onClick={() => setFilter(option)} className={`btn capitalize ${filter === option ? "btn-primary" : "btn-secondary"}`}>
                {option}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[440px] overflow-y-auto border border-[var(--border)] bg-white">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`block w-full border-b border-[var(--border)] p-3 text-left last:border-0 hover:bg-[var(--gray-50)] ${selectedId === ticket.id ? "bg-[var(--accent-50)]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--foreground)]">{ticket.ticket_number}</span>
                  <span className={`badge ${STATUS_BADGES[ticket.status]}`}>{ticket.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">{ticket.subject}</p>
                <p className="mt-1 text-xs text-[var(--foreground-muted)]">{ticket.priority} · updated {formatDateTime(ticket.updated_at)}</p>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="p-6 text-center text-sm text-[var(--foreground-muted)]">No tickets in this view.</p>
            )}
            {loading && <p className="p-6 text-center text-sm text-[var(--foreground-muted)]">Loading tickets…</p>}
          </div>
        </div>

        <div className="min-w-0">
          {selected ? (
            <div className="border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{selected.ticket_number}</span>
                      <span className={`badge ${STATUS_BADGES[selected.status]}`}>{selected.status.replaceAll("_", " ")}</span>
                      <span className="badge badge-neutral">{selected.priority}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-[var(--foreground)]">{selected.subject}</h3>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                      {CATEGORY_LABELS[selected.category]} · opened {formatDateTime(selected.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selected.status === "resolved" && (
                      <button onClick={() => updateStatus("closed")} className="btn btn-secondary">Close ticket</button>
                    )}
                    {["resolved", "closed"].includes(selected.status) && (
                      <button onClick={() => updateStatus("open")} className="btn btn-secondary">Reopen</button>
                    )}
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--gray-700)]">{selected.description}</p>
                {selected.external_assignee_name && (
                  <p className="mt-3 text-xs text-[var(--foreground-muted)]">Assigned support agent: {selected.external_assignee_name}</p>
                )}
                {selected.resolution_summary && (
                  <div className="mt-3 rounded-md bg-[var(--success-50)] p-3 text-sm text-[var(--success-600)]">
                    <strong>Resolution:</strong> {selected.resolution_summary}
                  </div>
                )}
              </div>

              <div className="max-h-[420px] touch-pan-y overflow-y-auto p-5">
                <div className="flex flex-col gap-3">
                  {selected.messages.map((message) => (
                    <div key={message.id} className={`max-w-[85%] rounded-md p-3 ${message.author_type === "venue" ? "ml-auto bg-[var(--accent-50)]" : "bg-[var(--gray-100)]"}`}>
                      <div className="flex items-center justify-between gap-3 text-xs text-[var(--foreground-muted)]">
                        <span className="font-semibold text-[var(--foreground)]">{message.author_name}</span>
                        <span>{formatDateTime(message.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[var(--gray-700)]">{message.body}</p>
                    </div>
                  ))}
                  {selected.messages.length === 0 && (
                    <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">No replies yet.</p>
                  )}
                </div>
              </div>

              {selected.status !== "closed" && (
                <div className="border-t border-[var(--border)] p-4">
                  <label className="text-sm">
                    <span className="label">Reply to support</span>
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} className="input" placeholder="Add more detail or answer the support team's question." />
                  </label>
                  <div className="mt-2 flex justify-end">
                    <button onClick={sendReply} disabled={replying || !reply.trim()} className="btn btn-primary">
                      {replying ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--gray-25)] p-8 text-center text-sm text-[var(--foreground-muted)]">
              Select a ticket to view its conversation and status.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
