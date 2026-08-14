"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTable } from "@/app/actions/tables";
import { Select } from "@/components/ui/Select";
import type { StaffProfile, TableRow } from "@/types/database";

interface AssignTableFormProps {
  qrIdentifier: string;
  existingTable: TableRow | null;
  waiters: Pick<StaffProfile, "id" | "full_name">[];
}

export function AssignTableForm({
  qrIdentifier,
  existingTable,
  waiters,
}: AssignTableFormProps) {
  const router = useRouter();
  const [tableNumber, setTableNumber] = useState(
    existingTable?.table_number?.toString() ?? ""
  );
  const [section, setSection] = useState(existingTable?.section ?? "");
  const [waiterId, setWaiterId] = useState(
    existingTable?.current_waiter_id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await assignTable({
      qrIdentifier,
      tableNumber: Number(tableNumber),
      section: section || undefined,
      waiterId: waiterId || undefined,
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Could not assign table");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/staff/dashboard"), 900);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card mx-auto flex max-w-md flex-col gap-4 p-6"
    >
      <div>
        <h1 className="text-lg font-bold text-[var(--foreground)]">Assign Table</h1>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          Sticker: <code>{qrIdentifier}</code>
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-[var(--success-50)] px-3 py-2 text-sm text-[var(--success-600)]">
          Table assigned!
        </p>
      )}

      <label className="text-sm">
        <span className="label">Table number</span>
        <input
          type="number"
          required
          min={1}
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          className="input"
        />
      </label>

      <label className="text-sm">
        <span className="label">Section</span>
        <input
          type="text"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="e.g. Patio"
          className="input"
        />
      </label>

      <label className="text-sm">
        <span className="label">Waiter</span>
        <Select
          value={waiterId}
          onChange={(e) => setWaiterId(e.target.value)}
        >
          <option value="">Auto-assign (round robin)</option>
          {waiters.map((w) => (
            <option key={w.id} value={w.id}>
              {w.full_name}
            </option>
          ))}
        </Select>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-2 w-full"
      >
        {loading ? "Saving…" : "Save Assignment"}
      </button>
    </form>
  );
}
