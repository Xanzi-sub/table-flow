"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StaffInvite, StaffProfile, UserRole } from "@/types/database";
import { updateStaffName, updateStaffRole, removeStaffMember } from "@/app/actions/staff";
import { inviteStaff, deleteInvite } from "@/app/actions/onboarding";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";

export function StaffManager({
  initialStaff,
  initialInvites,
}: {
  initialStaff: StaffProfile[];
  initialInvites: StaffInvite[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [invites, setInvites] = useState(initialInvites);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("waiter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialStaff.map((member) => [member.id, member.full_name]))
  );
  const [savingNameId, setSavingNameId] = useState<string | null>(null);

  // Live on/off-duty status — a waiter toggling elsewhere should reflect here without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("staff-manager-duty")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "staff_profiles" },
        (payload) => {
          const updated = payload.new as StaffProfile;
          setStaff((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await inviteStaff({ email, fullName, phone, role });
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not add invite");
      return;
    }

    setInvites((prev) => [
      {
        id: crypto.randomUUID(),
        email: email.trim().toLowerCase(),
        full_name: fullName,
        phone: phone || null,
        role,
        invited_by: null,
        claimed_by: null,
        claimed_at: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("waiter");
  }

  async function handleRoleChange(id: string, newRole: UserRole) {
    const result = await updateStaffRole(id, newRole);
    if (result.success) {
      setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role: newRole } : s)));
    }
  }

  async function handleNameSave(id: string) {
    setSavingNameId(id);
    setError(null);
    const result = await updateStaffName(id, nameDrafts[id] ?? "");
    setSavingNameId(null);
    if (!result.success) {
      setError(result.error ?? "Could not update staff name");
      return;
    }
    const name = nameDrafts[id].trim();
    setStaff((current) => current.map((member) => (member.id === id ? { ...member, full_name: name } : member)));
  }

  async function handleRemove(id: string) {
    const result = await removeStaffMember(id);
    if (result.success) {
      setStaff((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function handleRemoveInvite(id: string) {
    const result = await deleteInvite(id);
    if (result.success) {
      setInvites((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <div>
      <PageHeader title="Staff" description="Manage your team and pending invites." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={handleInvite}
        className="card flex flex-col gap-4 p-6"
      >
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">Add Staff Member</h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            They set their own password at <code>/staff/signup</code> using
            this exact email — it links automatically.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
        )}

        <label className="text-sm">
          <span className="label">Full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
          />
        </label>
        <label className="text-sm">
          <span className="label">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
        <label className="text-sm">
          <span className="label">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
          />
        </label>
        <label className="text-sm">
          <span className="label">Role</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="waiter">Waiter</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary mt-1 w-full"
        >
          {loading ? "Adding…" : "Add Staff Member"}
        </button>
      </form>

      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Team</h2>
          <div className="mt-2 flex flex-col">
            {staff.map((s) => (
              <div key={s.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <div className="flex max-w-md items-center gap-2">
                    <input
                      value={nameDrafts[s.id] ?? s.full_name}
                      onChange={(event) =>
                        setNameDrafts((current) => ({ ...current, [s.id]: event.target.value }))
                      }
                      aria-label={`Display name for ${s.email ?? "staff member"}`}
                      className="input !py-1.5 !text-xs"
                    />
                    <button
                      onClick={() => handleNameSave(s.id)}
                      disabled={savingNameId === s.id || (nameDrafts[s.id] ?? s.full_name).trim() === s.full_name}
                      className="btn btn-secondary !py-1.5 !text-xs"
                    >
                      {savingNameId === s.id ? "Saving…" : "Save name"}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--foreground-muted)]">{s.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.role === "waiter" && (
                    <span className={`badge ${s.is_checked_in ? "badge-success" : "badge-neutral"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.is_checked_in ? "bg-[var(--success-600)]" : "bg-[var(--gray-400)]"}`} />
                      {s.is_checked_in ? "On duty" : "Off duty"}
                    </span>
                  )}
                  <Select
                    value={s.role}
                    onChange={(e) => handleRoleChange(s.id, e.target.value as UserRole)}
                    className="!w-28 !py-1 !pr-8 !text-xs"
                  >
                    <option value="waiter">Waiter</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="btn btn-ghost !text-[var(--danger-600)] !px-2 !py-1 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {staff.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">
                No active staff members yet.
              </p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Pending Invites</h2>
          <div className="mt-2 flex flex-col">
            {invites.map((invite) => (
              <div key={invite.id} className="list-row">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {invite.full_name}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {invite.email} · <span className="capitalize">{invite.role}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveInvite(invite.id)}
                  className="btn btn-ghost !text-[var(--danger-600)] !px-2 !py-1 text-xs"
                >
                  Cancel invite
                </button>
              </div>
            ))}
            {invites.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--foreground-muted)]">
                No pending invites.
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
