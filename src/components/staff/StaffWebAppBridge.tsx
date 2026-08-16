"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, MonitorSmartphone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { playAlertSound } from "@/components/staff/StaffNotifications";

const INSTALL_DISMISSED_KEY = "tableflow-install-dismissed";
const WEB_DEVICE_KEY = "tableflow-web-device-id";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function browserDeviceId() {
  const existing = window.localStorage.getItem(WEB_DEVICE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(WEB_DEVICE_KEY, created);
  return created;
}

export function StaffWebAppBridge({ staffId, venueId }: { staffId: string; venueId?: string | null }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [working, setWorking] = useState(false);

  const registerWebPush = useCallback(async () => {
    if (Capacitor.isNativePlatform() || !("serviceWorker" in navigator) || !("Notification" in window)) return;
    setWorking(true);
    try {
      playAlertSound();
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        setShowPushPrompt(false);
        return;
      }

      const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
      ]);
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };
      if (!firebaseConfig.apiKey || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const token = await getToken(getMessaging(app), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return;
      const supabase = createClient();
      await supabase.from("staff_devices").upsert(
        {
          staff_id: staffId,
          venue_id: venueId ?? null,
          platform: "web",
          push_token: token,
          device_identifier: browserDeviceId(),
          app_version: "web",
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "staff_id,device_identifier" }
      );
      setShowPushPrompt(false);
    } finally {
      setWorking(false);
    }
  }, [staffId, venueId]);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    void navigator.serviceWorker?.register("/firebase-messaging-sw.js", { scope: "/" }).catch(() => {});

    const dismissedAt = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY) ?? 0);
    const canShow = Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      if (canShow) setShowInstall(true);
    };
    const handleInstalled = () => {
      setShowInstall(false);
      setInstallPrompt(null);
      window.localStorage.removeItem(INSTALL_DISMISSED_KEY);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    if (isIos && canShow) setShowIosHelp(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !("Notification" in window)) return;
    const configured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
    if (!configured) return;
    if (Notification.permission === "default") setShowPushPrompt(true);
    if (Notification.permission === "granted") void registerWebPush();
  }, [registerWebPush]);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setShowInstall(false);
    setInstallPrompt(null);
  }

  function dismissInstall() {
    setShowInstall(false);
    setShowIosHelp(false);
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  }

  return (
    <>
      {(showInstall || showIosHelp) && (
        <div className="fixed inset-x-4 bottom-20 z-[85] mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-2xl sm:bottom-5">
          <button onClick={dismissInstall} aria-label="Dismiss install prompt" className="absolute right-3 top-3 text-slate-400"><X className="h-4 w-4" /></button>
          <div className="flex gap-3 pr-5">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-slate-900">Install TableFlow</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {showIosHelp
                  ? "In Safari, tap Share, then Add to Home Screen."
                  : "Install the staff app for faster access and a full-screen phone experience."}
              </p>
              {!showIosHelp && <button onClick={install} className="btn btn-primary mt-3">Install app</button>}
            </div>
          </div>
        </div>
      )}

      {showPushPrompt && !showInstall && !showIosHelp && (
        <div className="fixed inset-x-4 bottom-20 z-[84] mx-auto max-w-md rounded-lg border border-blue-200 bg-white p-4 shadow-xl sm:bottom-5">
          <div className="flex gap-3">
            <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-slate-900">Enable browser alerts</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Receive new-order and customer-request notifications on this computer or phone, even when TableFlow is in the background.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={registerWebPush} disabled={working} className="btn btn-primary">{working ? "Enabling..." : "Enable alerts"}</button>
                <button onClick={() => setShowPushPrompt(false)} className="btn btn-secondary">Not now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
