"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInStaff } from "@/app/actions/auth";
import { ensureBootstrap } from "@/app/actions/onboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signInStaff(email, password);

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? "Invalid email or password");
      return;
    }

    // Self-heals a first-run admin whose profile couldn't be created at signup
    // time (e.g. Supabase required email confirmation first).
    const bootstrap = await ensureBootstrap();
    setLoading(false);

    if (bootstrap.success && bootstrap.data?.bootstrapped) {
      router.push("/onboarding/venue");
      router.refresh();
      return;
    }

    router.push(searchParams.get("redirect") ?? "/staff/dashboard");
    router.refresh();
  }

  return (
    <AuthLayout
      eyebrow="TableFlow"
      title="Staff Sign In"
      description="Waiters, managers, and admins sign in here to reach the live floor, menu, and marketing tools."
    >
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl lg:p-10"
      >
        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {!error && searchParams.get("confirmed") && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Email confirmed — sign in below.
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
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Invited as staff but haven&apos;t set a password yet?{" "}
          <a href="/staff/signup" className="underline">
            Activate your account
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={null}>
      <StaffLoginForm />
    </Suspense>
  );
}
