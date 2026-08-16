import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Device { id: string; platform: "android" | "ios" | "web"; push_token: string }
interface StaffNotification { id: string; title: string; body: string; metadata: Record<string, unknown> }

async function googleAccessToken() {
  const email = Deno.env.get("FCM_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("FCM credentials are not configured");
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Could not authorize FCM");
  return (await response.json()).access_token as string;
}

async function sendAndroid(device: Device, notification: StaffNotification, accessToken: string) {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) throw new Error("FCM_PROJECT_ID is not configured");
  const route = typeof notification.metadata.route === "string" ? notification.metadata.route : "/staff/notifications";
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token: device.push_token,
      notification: { title: notification.title, body: notification.body },
      data: { route, notificationId: notification.id },
      android: { priority: "high", notification: { sound: "default", channel_id: "tableflow_alerts" } },
    } }),
  });
  return response.ok;
}

async function sendWeb(device: Device, notification: StaffNotification, accessToken: string) {
  const projectId = Deno.env.get("FCM_PROJECT_ID");
  if (!projectId) throw new Error("FCM_PROJECT_ID is not configured");
  const route = typeof notification.metadata.route === "string" ? notification.metadata.route : "/staff/notifications";
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token: device.push_token,
      data: {
        title: notification.title,
        body: notification.body,
        route,
        notificationId: notification.id,
      },
      webpush: {
        headers: { Urgency: "high" },
      },
    } }),
  });
  return response.ok;
}

async function apnsToken() {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) throw new Error("APNs credentials are not configured");
  const key = await importPKCS8(privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(key);
}

async function sendIos(device: Device, notification: StaffNotification, token: string) {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) throw new Error("APNS_BUNDLE_ID is not configured");
  const route = typeof notification.metadata.route === "string" ? notification.metadata.route : "/staff/notifications";
  const host = Deno.env.get("APNS_USE_SANDBOX") === "true" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const response = await fetch(`https://${host}/3/device/${encodeURIComponent(device.push_token)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify({
      aps: { alert: { title: notification.title, body: notification.body }, sound: "default", badge: 1 },
      route,
      notificationId: notification.id,
    }),
  });
  return response.ok;
}

Deno.serve(async (request) => {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { orderId, tableId, notificationType } = await request.json();
    if ((!orderId && !tableId) || !notificationType) return Response.json({ error: "Invalid request" }, { status: 400 });
    const { data: order } = orderId
      ? await admin.from("orders").select("customer_session_id, waiter_id").eq("id", orderId).single()
      : { data: null };
    const { data: staff } = await admin.from("staff_profiles").select("role").eq("id", user.id).maybeSingle();
    if ((orderId && !order) || (order && order.customer_session_id !== user.id && !staff) || (!orderId && !staff)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let notificationQuery = admin
      .from("staff_notifications")
      .select("id, recipient_staff_id, title, body, metadata")
      .in("type", notificationType === "table_assigned" ? ["table_assigned"] : [notificationType, "unassigned_order"])
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    notificationQuery = orderId ? notificationQuery.eq("order_id", orderId) : notificationQuery.eq("table_id", tableId);
    const { data: notifications } = await notificationQuery;
    if (!notifications?.length) return Response.json({ delivered: 0 });

    const recipients = [...new Set(notifications.map((item) => item.recipient_staff_id))];
    const { data: devices } = await admin.from("staff_devices").select("id, staff_id, platform, push_token").in("staff_id", recipients).eq("is_active", true);
    let fcmToken: string | null = null;
    let appleToken: string | null = null;
    let delivered = 0;

    for (const notification of notifications) {
      for (const device of (devices ?? []).filter((item) => item.staff_id === notification.recipient_staff_id) as Device[]) {
        try {
          const ok = device.platform === "android"
            ? await sendAndroid(device, notification, fcmToken ??= await googleAccessToken())
            : device.platform === "web"
              ? await sendWeb(device, notification, fcmToken ??= await googleAccessToken())
              : await sendIos(device, notification, appleToken ??= await apnsToken());
          if (ok) delivered += 1;
          else await admin.from("staff_devices").update({ is_active: false }).eq("id", device.id);
        } catch (error) {
          console.error("Push delivery failed", error instanceof Error ? error.message : error);
        }
      }
    }
    return Response.json({ delivered });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return Response.json({ error: "Push delivery failed" }, { status: 500 });
  }
});
