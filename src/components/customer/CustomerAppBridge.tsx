"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Download, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startContinuousAlertSound, stopAlertSound } from "@/components/staff/StaffNotifications";
import type { CustomerNotification } from "@/types/database";

const INSTALL_DISMISSED = "tableflow-customer-install-dismissed";
const DEVICE_ID = "tableflow-customer-device-id";

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
function deviceId() { const value = localStorage.getItem(DEVICE_ID) ?? crypto.randomUUID(); localStorage.setItem(DEVICE_ID, value); return value; }

export function CustomerAppBridge({ customerSessionId }: { customerSessionId: string }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestId = useRef<string | null>(null);

  const announce = useCallback((notification: CustomerNotification) => {
    setRinging(true);
    startContinuousAlertSound();
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState === "visible") {
      const notice = new Notification(notification.title, { body: notification.body, icon: "/icons/icon-192.webp", tag: notification.id, silent: false });
      notice.onclick = () => { stopAlertSound(); setRinging(false); window.focus(); };
    }
  }, []);

  const load = useCallback(async (announceNew = false) => {
    const { data } = await createClient().from("customer_notifications").select("*").eq("customer_session_id", customerSessionId).order("created_at", { ascending: false }).limit(20);
    const newest = data?.[0];
    if (announceNew && newest && !newest.read_at && latestId.current && newest.id !== latestId.current) announce(newest);
    latestId.current = newest?.id ?? null;
  }, [announce, customerSessionId]);

  const enableAlerts = useCallback(async () => {
    setError(null);
    window.localStorage.setItem("tableflow-alert-sound", "on");
    startContinuousAlertSound();
    window.setTimeout(() => { stopAlertSound(); setRinging(false); }, 700);
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) throw new Error();
      if (await Notification.requestPermission() !== "granted") { setShowAlerts(false); return; }
      const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
      const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
      if (!config.apiKey || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) throw new Error();
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      const token = await getToken(getMessaging(getApps()[0] ?? initializeApp(config)), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) throw new Error();
      const { error: registrationError } = await createClient().rpc("register_customer_device", { p_push_token: token, p_device_identifier: deviceId() });
      if (registrationError) throw registrationError;
      setShowAlerts(false);
    } catch { setError("Could not enable alerts on this device. Check browser notification permission and try again."); }
  }, []);

  useEffect(() => {
    void navigator.serviceWorker?.register("/firebase-messaging-sw.js", { scope: "/" }).catch(() => {});
    if (standalone()) return;
    const canPrompt = Date.now() - Number(localStorage.getItem(INSTALL_DISMISSED) ?? 0) > 7 * 86400000;
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); if (canPrompt) setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && canPrompt) setShowIosHelp(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") setShowAlerts(true);
    void load();
    const supabase = createClient();
    const channel = supabase.channel(`customer-notifications-${customerSessionId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_notifications", filter: `customer_session_id=eq.${customerSessionId}` }, (payload) => { const item = payload.new as CustomerNotification; latestId.current = item.id; announce(item); }).subscribe();
    const fallback = window.setInterval(() => void load(true), 5_000);
    return () => { window.clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [announce, customerSessionId, load]);

  function dismissInstall() { setShowInstall(false); setShowIosHelp(false); localStorage.setItem(INSTALL_DISMISSED, String(Date.now())); }
  async function install() { if (!installPrompt) return; await installPrompt.prompt(); if ((await installPrompt.userChoice).outcome === "accepted") setShowInstall(false); }
  function silence() { stopAlertSound(); setRinging(false); }

  return <>
    {ringing && <div className="fixed inset-x-3 bottom-5 z-[120] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-4 shadow-2xl"><div><p className="text-sm font-bold">Order update</p><p className="text-xs text-neutral-500">Open your order to view the new status.</p></div><button onClick={silence} className="rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-700">Stop sound</button></div>}
    {(showInstall || showIosHelp) && <div className="fixed inset-x-3 bottom-5 z-[115] mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl"><button onClick={dismissInstall} className="absolute right-3 top-3 text-neutral-400"><X className="h-4 w-4" /></button><div className="flex gap-3"><Download className="h-5 w-5 text-[var(--accent-500)]" /><div><p className="text-sm font-bold">Install this menu</p><p className="mt-1 text-xs text-neutral-500">{showIosHelp ? "In Safari tap Share, then Add to Home Screen." : "Install TableFlow for quick access and order updates."}</p>{!showIosHelp && <button onClick={install} className="mt-3 rounded-full bg-[var(--accent-500)] px-4 py-2 text-xs font-bold text-white">Install app</button>}</div></div></div>}
    {showAlerts && !showInstall && !showIosHelp && <div className="fixed inset-x-3 bottom-5 z-[114] mx-auto max-w-md rounded-2xl border border-[var(--accent-200)] bg-white p-4 shadow-xl"><div className="flex gap-3"><BellRing className="h-5 w-5 text-[var(--accent-500)]" /><div><p className="text-sm font-bold">Enable order alerts</p><p className="mt-1 text-xs text-neutral-500">Get notified when your order is preparing, served or completed.</p>{error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}<div className="mt-3 flex gap-2"><button onClick={enableAlerts} className="rounded-full bg-[var(--accent-500)] px-4 py-2 text-xs font-bold text-white">Enable alerts</button><button onClick={() => setShowAlerts(false)} className="px-3 text-xs font-semibold text-neutral-500">Not now</button></div></div></div></div>}
  </>;
}
