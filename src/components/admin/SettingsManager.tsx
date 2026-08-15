"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveVenueSettings } from "@/app/actions/onboarding";
import { getWhatsAppConnectUrl, syncZendioWhatsAppAccount } from "@/app/actions/zendio";
import { PageHeader } from "@/components/ui/PageHeader";
import type { VenueSettings } from "@/types/database";

export function SettingsManager({ venue }: { venue: VenueSettings | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [phone, setPhone] = useState(venue?.phone ?? "");
  const [vatPercentage, setVatPercentage] = useState((venue?.vat_percentage ?? 15).toString());
  const [tipPercentage, setTipPercentage] = useState((venue?.tip_percentage ?? 10).toString());
  const [loyaltyPointsPerRand, setLoyaltyPointsPerRand] = useState((venue?.loyalty_points_per_rand ?? 1).toString());
  const [loyaltyRewardThreshold, setLoyaltyRewardThreshold] = useState((venue?.loyalty_reward_threshold ?? 500).toString());
  const [loyaltyRewardValue, setLoyaltyRewardValue] = useState((venue?.loyalty_reward_value ?? 50).toString());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState(venue?.logo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [accountLabel, setAccountLabel] = useState(venue?.zendio_account_label ?? null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(
    searchParams.get("whatsapp") === "error" ? "Could not complete the WhatsApp connection. Try again." : null
  );
  const whatsappJustConnected = searchParams.get("whatsapp") === "connected";

  async function handleSaveVenue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      let uploadedLogoUrl = logoUrl ?? undefined;
      if (logoFile) {
        const supabase = createClient();
        const path = `venue-logo/${crypto.randomUUID()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage.from("menu-photos").upload(path, logoFile);
        if (uploadError) throw new Error(uploadError.message);
        uploadedLogoUrl = supabase.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
        setLogoUrl(uploadedLogoUrl);
      }

      const result = await saveVenueSettings({
        name,
        address,
        phone,
        logoUrl: uploadedLogoUrl,
        vatPercentage: Number(vatPercentage) || 0,
        tipPercentage: Number(tipPercentage) || 0,
        loyaltyPointsPerRand: Number(loyaltyPointsPerRand) || 0,
        loyaltyRewardThreshold: Number(loyaltyRewardThreshold) || 0,
        loyaltyRewardValue: Number(loyaltyRewardValue) || 0,
      });
      if (!result.success) throw new Error(result.error ?? "Could not save venue details");

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectWhatsApp() {
    setConnecting(true);
    setConnectError(null);
    const result = await getWhatsAppConnectUrl();
    if (!result.success || !result.data) {
      setConnecting(false);
      setConnectError(result.error ?? "Could not start the WhatsApp connection");
      return;
    }
    window.location.href = result.data.authUrl;
  }

  async function handleRecheckStatus() {
    setConnecting(true);
    setConnectError(null);
    const result = await syncZendioWhatsAppAccount();
    setConnecting(false);
    if (!result.success) {
      setConnectError(result.error ?? "Could not detect a connected account");
      return;
    }
    setAccountLabel(result.data!.label);
  }

  return (
    <div>
      <PageHeader title="Settings" description="Venue details and connected services." />

      <div className="flex flex-col gap-6">
        <form onSubmit={handleSaveVenue} className="card flex flex-col gap-4 p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Venue Details</h2>

          {error && (
            <p className="rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
          )}
          {saved && (
            <p className="rounded-lg bg-[var(--success-50)] px-3 py-2 text-sm text-[var(--success-600)]">
              Saved!
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="label">Venue name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </label>
            <label className="text-sm">
              <span className="label">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="label">Address / location</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="label">Logo</span>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- simple settings preview thumbnail
                  <img src={logoUrl} alt="Venue logo" className="h-12 w-12 rounded-lg border border-[var(--border)] object-cover" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  className="block flex-1 text-sm text-[var(--foreground-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--gray-100)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--foreground)]"
                />
              </div>
            </label>
            <label className="text-sm">
              <span className="label">VAT / tax percentage</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={vatPercentage}
                onChange={(e) => setVatPercentage(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Menu prices are treated as VAT-inclusive — this only shows the tax breakdown on receipts.
              </p>
            </label>
            <label className="text-sm">
              <span className="label">Suggested tip percentage</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tipPercentage}
                onChange={(e) => setTipPercentage(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Shown as a reference on receipts — never changes what&apos;s charged.
              </p>
            </label>
            <div className="sm:col-span-2 border-t border-[var(--border)] pt-4">
              <h3 className="text-sm font-bold text-[var(--foreground)]">Loyalty rules</h3>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Points are awarded automatically when staff marks an order paid.
              </p>
            </div>
            <label className="text-sm">
              <span className="label">Points earned per R1</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={loyaltyPointsPerRand}
                onChange={(e) => setLoyaltyPointsPerRand(e.target.value)}
                className="input"
              />
            </label>
            <label className="text-sm">
              <span className="label">Reward points threshold</span>
              <input
                type="number"
                min={1}
                step="1"
                value={loyaltyRewardThreshold}
                onChange={(e) => setLoyaltyRewardThreshold(e.target.value)}
                className="input"
              />
            </label>
            <label className="text-sm">
              <span className="label">Reward value (R)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={loyaltyRewardValue}
                onChange={(e) => setLoyaltyRewardValue(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Example: {loyaltyRewardThreshold || "500"} points unlocks a {`R${loyaltyRewardValue || "50"}`} reward.
              </p>
            </label>
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto">
            {saving ? "Saving…" : "Save Venue Details"}
          </button>
        </form>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">WhatsApp Connection</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Connect your restaurant&apos;s WhatsApp Business Account to send order receipts and marketing broadcasts.
          </p>

          {whatsappJustConnected && (
            <p className="mt-3 rounded-lg bg-[var(--success-50)] px-3 py-2 text-sm text-[var(--success-600)]">
              WhatsApp connected!
            </p>
          )}
          {connectError && (
            <p className="mt-3 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">
              {connectError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {accountLabel ? accountLabel : "Not connected"}
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {accountLabel
                  ? "Connected via Zernio"
                  : "Click connect to link a WhatsApp Business number — no external dashboard needed."}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConnectWhatsApp} disabled={connecting} className="btn btn-primary">
                {connecting ? "Working…" : accountLabel ? "Reconnect WhatsApp" : "Connect WhatsApp"}
              </button>
              {accountLabel && (
                <button onClick={handleRecheckStatus} disabled={connecting} className="btn btn-secondary">
                  Re-check Status
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
