"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getVenueSettings } from "./onboarding";
import { enforceRateLimit, RateLimitError } from "@/lib/security";
import type { ActionResult } from "./tables";

const ZENDIO_API_URL = process.env.ZENDIO_API_URL ?? "https://zernio.com/api/v1";

interface ZendioAccount {
  _id: string;
  platform: string;
  username?: string;
  name?: string;
}

interface ZendioProfile {
  _id: string;
  name: string;
  isDefault?: boolean;
}

async function requireZendioManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("staff_profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "waiter") return null;
  return user;
}

/** Finds or creates the Zernio "profile" that groups this venue's connected accounts. */
async function ensureZendioProfileId(apiKey: string): Promise<string> {
  const venue = await getVenueSettings();
  if (venue?.zendio_profile_id) return venue.zendio_profile_id;

  const venueName = venue?.name ?? "TableFlow Venue";

  const listResponse = await fetch(`${ZENDIO_API_URL}/profiles?name=${encodeURIComponent(venueName)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (listResponse.ok) {
    const body = await listResponse.json();
    const existing: ZendioProfile[] = body.profiles ?? [];
    if (existing[0]) {
      await saveZendioProfileId(existing[0]._id);
      return existing[0]._id;
    }
  }

  const createResponse = await fetch(`${ZENDIO_API_URL}/profiles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: venueName }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!createResponse.ok) {
    throw new Error(`Could not create a Zernio profile (HTTP ${createResponse.status})`);
  }

  const created = await createResponse.json();
  const profileId: string = created.profile?._id ?? created._id;
  await saveZendioProfileId(profileId);
  return profileId;
}

async function saveZendioProfileId(profileId: string) {
  const supabase = await createClient();
  const existing = await getVenueSettings();
  if (existing) {
    await supabase.from("venue_settings").update({ zendio_profile_id: profileId }).eq("id", existing.id);
  } else {
    await supabase.from("venue_settings").insert({ name: "My Venue", zendio_profile_id: profileId });
  }
}

/**
 * Starts the real Zernio/Meta WhatsApp Business Account connect flow from
 * inside our own Settings page: gets (or creates) a Zernio profile for this
 * venue, requests an authUrl for the "whatsapp" platform with our own
 * /api/zendio/callback as the redirect target, and returns it so the client
 * can navigate the browser there. No manual dashboard visit required.
 */
export async function getWhatsAppConnectUrl(): Promise<ActionResult<{ authUrl: string }>> {
  const user = await requireZendioManager();
  if (!user) return { success: false, error: "Unauthorized" };
  try {
    await enforceRateLimit({ scope: "zendio-connect", identifier: user.id, limit: 10, windowSeconds: 60 * 60 });
  } catch (error) {
    return { success: false, error: error instanceof RateLimitError ? error.message : "WhatsApp connection is temporarily unavailable" };
  }
  const apiKey = process.env.ZENDIO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "ZENDIO_API_KEY is not set in this deployment's environment.",
    };
  }

  let profileId: string;
  try {
    profileId = await ensureZendioProfileId(apiKey);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not prepare Zernio profile" };
  }

  const requestHeaders = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;
  const redirectUrl = `${origin}/api/zendio/callback`;

  const response = await fetch(
    `${ZENDIO_API_URL}/connect/whatsapp?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirectUrl)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }
  );

  if (!response.ok) {
    return { success: false, error: `Zernio API error (HTTP ${response.status}) requesting the connect URL.` };
  }

  const body = await response.json();
  const authUrl: string | undefined = body.authUrl ?? body.data?.authUrl;
  if (!authUrl) return { success: false, error: "Zernio did not return a connect URL." };

  return { success: true, data: { authUrl } };
}

/**
 * Auto-detects the WhatsApp account connected in the venue's Zernio/Zendio
 * dashboard and saves its id — a manual fallback for when the redirect flow
 * above can't be used (e.g. it was connected directly in the Zernio dashboard).
 */
export async function syncZendioWhatsAppAccount(): Promise<
  ActionResult<{ accountId: string; label: string }>
> {
  const user = await requireZendioManager();
  if (!user) return { success: false, error: "Unauthorized" };
  try {
    await enforceRateLimit({ scope: "zendio-sync", identifier: user.id, limit: 30, windowSeconds: 60 * 60 });
  } catch (error) {
    return { success: false, error: error instanceof RateLimitError ? error.message : "WhatsApp sync is temporarily unavailable" };
  }
  const apiKey = process.env.ZENDIO_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "ZENDIO_API_KEY is not set in this deployment's environment.",
    };
  }

  const response = await fetch(`${ZENDIO_API_URL}/accounts`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    return {
      success: false,
      error: `Zernio API error (HTTP ${response.status}) — check that ZENDIO_API_KEY is valid.`,
    };
  }

  const body = await response.json();
  const accounts: ZendioAccount[] = body.accounts ?? body.data?.accounts ?? [];
  const whatsapp = accounts.find((a) => a.platform === "whatsapp");

  if (!whatsapp) {
    return {
      success: false,
      error: "No WhatsApp account found yet. Use \"Connect WhatsApp\" in Settings first.",
    };
  }

  const label = whatsapp.name ?? whatsapp.username ?? "WhatsApp";
  const supabase = await createClient();
  const existing = await getVenueSettings();

  const { error } = existing
    ? await supabase
        .from("venue_settings")
        .update({ zendio_account_id: whatsapp._id, zendio_account_label: label })
        .eq("id", existing.id)
    : await supabase.from("venue_settings").insert({
        name: "My Venue",
        zendio_account_id: whatsapp._id,
        zendio_account_label: label,
      });

  if (error) return { success: false, error: error.message };

  revalidatePath("/staff/marketing");
  revalidatePath("/admin/settings");
  return { success: true, data: { accountId: whatsapp._id, label } };
}
