"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveVenueSettings } from "@/app/actions/onboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function OnboardingVenuePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let logoUrl: string | undefined;

    try {
      if (logoFile) {
        const supabase = createClient();
        const path = `venue-logo/${crypto.randomUUID()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-photos")
          .upload(path, logoFile);
        if (uploadError) throw new Error(uploadError.message);
        logoUrl = supabase.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
      }

      const result = await saveVenueSettings({ name, address, phone, logoUrl });
      if (!result.success) throw new Error(result.error ?? "Could not save venue");

      router.push("/onboarding/team");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Step 1 of 3"
      title="Your venue details"
      description="This shows up on the customer menu and staff dashboard."
    >
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl lg:p-10"
      >
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <label className="text-sm text-neutral-300">
            Venue name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Logo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-900"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Address / location
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
