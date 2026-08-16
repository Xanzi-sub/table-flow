"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteStaff, deleteInvite } from "@/app/actions/onboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";
import type { StaffInvite, UserRole } from "@/types/database";

export function InviteStaffStep({
  role,
  title,
  description,
  initialInvites,
  nextHref,
  nextLabel,
  stepLabel,
}: {
  role: UserRole;
  title: string;
  description: string;
  initialInvites: StaffInvite[];
  nextHref: string;
  nextLabel: string;
  stepLabel: string;
}) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name || !email) return;
    setLoading(true);
    setError(null);

    const result = await inviteStaff({ email, fullName: name, phone, role });
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not add invite");
      return;
    }

    setInvites((prev) => [
      {
        id: crypto.randomUUID(),
        email: email.trim().toLowerCase(),
        full_name: name,
        phone: phone || null,
        role,
        invited_by: null,
        claimed_by: null,
        claimed_at: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setName("");
    setEmail("");
    setPhone("");
  }

  async function handleRemove(id: string) {
    await deleteInvite(id);
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <AuthLayout eyebrow={stepLabel} title={title} description={description} panelClassName="max-w-md lg:max-w-2xl">
      <div className="w-full rounded-2xl border border-[#326750] bg-[#103d2e] p-8 shadow-xl lg:p-10">
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="rounded-xl border border-[#41735f] bg-[#174c3a] px-3 py-2.5 text-sm text-white"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-[#41735f] bg-[#174c3a] px-3 py-2.5 text-sm text-white"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-xl border border-[#41735f] bg-[#174c3a] px-3 py-2.5 text-sm text-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="mt-3 w-full rounded-xl border border-neutral-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          + Add
        </button>

        <div className="mt-5 flex flex-col divide-y divide-[#326750]">
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">{invite.full_name}</p>
                <p className="text-xs text-neutral-500">{invite.email}</p>
              </div>
              <button
                onClick={() => handleRemove(invite.id)}
                className="text-xs font-semibold text-red-400 underline"
              >
                Remove
              </button>
            </div>
          ))}
          {invites.length === 0 && (
            <p className="py-4 text-center text-xs text-neutral-500">
              Nobody added yet.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          They&apos;ll set their own password at <code>/staff/signup</code> using
          this exact email — it links automatically.
        </p>

        <button
          onClick={() => {
            router.push(nextHref);
            router.refresh();
          }}
          className="mt-6 w-full rounded-xl bg-[#cdeb69] py-3 text-sm font-semibold text-[#0c3327] hover:bg-[#d8f27f]"
        >
          {nextLabel}
        </button>
      </div>
    </AuthLayout>
  );
}
