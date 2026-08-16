"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { claimStaffInvite } from "@/app/actions/onboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";

function StaffSignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Could not create your account");
      return;
    }

    // No session yet means Supabase requires email confirmation first — the
    // invite gets claimed automatically once they click that link instead.
    if (!data.session) {
      setLoading(false);
      setSuccess("Account created! Check your email to confirm it, then you're in.");
      return;
    }

    const result = await claimStaffInvite();
    setLoading(false);

    if (!result.success) {
      setError(
        result.error ?? "No staff invite found for this email. Ask your manager to add you first."
      );
      return;
    }

    router.push(result.data?.role === "waiter" ? "/staff/dashboard" : "/admin/menu");
    router.refresh();
  }

  return (
    <AuthLayout
      eyebrow="TableFlow"
      title="Activate your account"
      description="Use the exact email your manager added you with — we'll link it to your invite automatically."
    >
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-[#326750] bg-[#103d2e] p-8 shadow-xl lg:p-10"
      >
        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {success}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-4">
          <label className="text-sm text-neutral-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#41735f] bg-[#174c3a] px-4 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Choose a password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#41735f] bg-[#174c3a] px-4 py-3 text-sm text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !!success}
          className="mt-6 w-full rounded-xl bg-[#cdeb69] py-3 text-sm font-semibold text-[#0c3327] hover:bg-[#d8f27f] disabled:opacity-50"
        >
          {loading ? "Activating…" : "Activate Account"}
        </button>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Already activated?{" "}
          <a href="/staff/login" className="underline">
            Sign in
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function StaffSignupPage() {
  return (
    <Suspense fallback={null}>
      <StaffSignupForm />
    </Suspense>
  );
}
