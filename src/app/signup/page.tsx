"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureBootstrap } from "@/app/actions/onboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function VenueSignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Could not create your account");
      return;
    }

    // No session yet means Supabase requires email confirmation first —
    // the admin profile gets created on their first successful login instead.
    if (!data.session) {
      setLoading(false);
      setSuccess("Account created! Check your email to confirm it, then sign in.");
      setTimeout(() => router.push("/staff/login"), 2000);
      return;
    }

    const result = await ensureBootstrap();
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not set up your admin account");
      return;
    }

    setSuccess("Venue created! Taking you to setup…");
    setTimeout(() => {
      router.push("/onboarding/venue");
      router.refresh();
    }, 1500);
  }

  return (
    <AuthLayout
      eyebrow="TableFlow"
      title="Set up your venue"
      description="Create the owner/admin account, then walk through branding, your manager, and your waiters in a few quick steps."
    >
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl lg:p-10"
      >
        <h2 className="text-lg font-bold text-white lg:hidden">Set up your venue</h2>
        <p className="mt-1 text-sm text-neutral-400 lg:mt-0">
          Google sign-in is coming soon — email &amp; password only for now.
        </p>

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
            Your name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !!success}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Venue"}
        </button>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Already have staff access?{" "}
          <a href="/staff/login" className="underline">
            Sign in
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
