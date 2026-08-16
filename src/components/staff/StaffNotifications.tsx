"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { PushNotifications } from "@capacitor/push-notifications";
import { Bell, BellRing, CheckCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { StaffNotification } from "@/types/database";

const SOUND_KEY = "tableflow-alert-sound";

function notificationRoute(notification: StaffNotification) {
  const route = notification.metadata?.route;
  return typeof route === "string" && route.startsWith("/") ? route : "/staff/notifications";
}

function playAlertSound() {
  if (typeof window === "undefined" || window.localStorage.getItem(SOUND_KEY) === "off") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const notes = [880, 1174, 880];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + index * 0.16 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.16 + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.16);
    oscillator.stop(context.currentTime + index * 0.16 + 0.14);
  });
  window.setTimeout(() => void context.close(), 800);
}

function NativePushBridge({ staffId, venueId }: { staffId: string; venueId?: string | null }) {
  const [showPermission, setShowPermission] = useState(false);
  const [registering, setRegistering] = useState(false);

  const register = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    setRegistering(true);
    const permission = await PushNotifications.checkPermissions();
    const granted = permission.receive === "granted"
      ? permission
      : await PushNotifications.requestPermissions();
    if (granted.receive !== "granted") {
      setShowPermission(false);
      setRegistering(false);
      return;
    }
    if (Capacitor.getPlatform() === "android") {
      await PushNotifications.createChannel({
        id: "tableflow_alerts",
        name: "TableFlow alerts",
        description: "New orders, waiter calls and bill requests",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
      });
    }
    await PushNotifications.register();
    setShowPermission(false);
    setRegistering(false);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const permission = await PushNotifications.checkPermissions();
      if (!disposed) setShowPermission(permission.receive === "prompt");

      listeners.push(
        await PushNotifications.addListener("registration", async ({ value }) => {
          const [{ identifier }, app] = await Promise.all([Device.getId(), App.getInfo()]);
          const platform = Capacitor.getPlatform();
          if (platform !== "android" && platform !== "ios") return;
          const supabase = createClient();
          await supabase.from("staff_devices").upsert(
            {
              staff_id: staffId,
              venue_id: venueId ?? null,
              platform,
              push_token: value,
              device_identifier: identifier,
              app_version: app.version,
              is_active: true,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "staff_id,device_identifier" }
          );
        })
      );
      listeners.push(
        await PushNotifications.addListener("registrationError", () => setShowPermission(true))
      );
      listeners.push(
        await PushNotifications.addListener("pushNotificationReceived", () => playAlertSound())
      );
      listeners.push(
        await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const route = notification.data?.route;
          window.location.assign(typeof route === "string" && route.startsWith("/") ? route : "/staff/notifications");
        })
      );
      if (permission.receive === "granted") {
        if (Capacitor.getPlatform() === "android") {
          await PushNotifications.createChannel({
            id: "tableflow_alerts",
            name: "TableFlow alerts",
            description: "New orders, waiter calls and bill requests",
            importance: 5,
            visibility: 1,
            sound: "default",
            vibration: true,
          });
        }
        await PushNotifications.register();
      }
    })();

    return () => {
      disposed = true;
      listeners.forEach((listener) => void listener.remove());
    };
  }, [staffId, venueId]);

  if (!showPermission) return null;
  return (
    <div className="fixed inset-x-4 bottom-20 z-[80] mx-auto max-w-md rounded-lg border border-blue-200 bg-white p-4 shadow-xl">
      <div className="flex gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-bold text-slate-900">Enable staff alerts</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Stay on top of new orders and customer requests even when TableFlow isn&apos;t open.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={register} disabled={registering} className="btn btn-primary">{registering ? "Enabling..." : "Enable notifications"}</button>
            <button onClick={() => setShowPermission(false)} className="btn btn-secondary">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffNotificationCentre({
  staffId,
  venueId,
  compact = false,
}: {
  staffId: string;
  venueId?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const initialized = useRef(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("staff_notifications")
      .select("*")
      .eq("recipient_staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications(data ?? []);
  }, [staffId]);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem(SOUND_KEY) !== "off");
    void load().then(() => { initialized.current = true; });
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-notifications-${staffId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications", filter: `recipient_staff_id=eq.${staffId}` },
        (payload) => {
          const incoming = payload.new as StaffNotification;
          setNotifications((current) => [incoming, ...current.filter((item) => item.id !== incoming.id)]);
          if (initialized.current) playAlertSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "staff_notifications", filter: `recipient_staff_id=eq.${staffId}` },
        () => void load()
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, staffId]);

  async function markRead(notification: StaffNotification) {
    if (!notification.read_at) {
      await createClient().from("staff_notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    }
    setOpen(false);
    router.push(notificationRoute(notification));
  }

  async function markAllRead() {
    await createClient().from("staff_notifications").update({ read_at: new Date().toISOString() }).eq("recipient_staff_id", staffId).is("read_at", null);
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) playAlertSound();
  }

  const unread = notifications.filter((item) => !item.read_at).length;
  const list = compact ? notifications.slice(0, 8) : notifications;

  return (
    <>
      <NativePushBridge staffId={staffId} venueId={venueId} />
      {compact ? (
        <div className="relative">
          <button onClick={() => setOpen((value) => !value)} aria-label={`Notifications, ${unread} unread`} className="relative flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
          </button>
          {open && (
            <div className="fixed inset-x-3 top-[70px] z-[65] max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px]">
              <NotificationList notifications={list} unread={unread} soundEnabled={soundEnabled} onRead={markRead} onMarkAll={markAllRead} onToggleSound={toggleSound} />
              <button onClick={() => { setOpen(false); router.push("/staff/notifications"); }} className="w-full border-t border-slate-200 px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50">View all notifications</button>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <NotificationList notifications={list} unread={unread} soundEnabled={soundEnabled} onRead={markRead} onMarkAll={markAllRead} onToggleSound={toggleSound} />
        </div>
      )}
    </>
  );
}

function NotificationList({ notifications, unread, soundEnabled, onRead, onMarkAll, onToggleSound }: {
  notifications: StaffNotification[];
  unread: number;
  soundEnabled: boolean;
  onRead: (notification: StaffNotification) => void;
  onMarkAll: () => void;
  onToggleSound: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-blue-600" /><p className="text-sm font-bold">Notifications</p>{unread > 0 && <span className="badge badge-accent">{unread} unread</span>}</div>
        <div className="flex gap-2"><button onClick={onToggleSound} className="text-[11px] font-semibold text-slate-500">Sound {soundEnabled ? "on" : "off"}</button>{unread > 0 && <button onClick={onMarkAll} title="Mark all read" className="text-blue-700"><CheckCheck className="h-4 w-4" /></button>}</div>
      </div>
      <div className="divide-y divide-slate-100">
        {notifications.map((notification) => (
          <button key={notification.id} onClick={() => onRead(notification)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${notification.read_at ? "bg-white" : "bg-blue-50/60"}`}>
            <div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-slate-300" : "bg-blue-600"}`} /><div className="min-w-0"><p className="text-sm font-bold text-slate-900">{notification.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{notification.body}</p><p className="mt-1 text-[10px] text-slate-400">{formatDateTime(notification.created_at)}</p></div></div>
          </button>
        ))}
        {notifications.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No notifications yet.</p>}
      </div>
    </>
  );
}
