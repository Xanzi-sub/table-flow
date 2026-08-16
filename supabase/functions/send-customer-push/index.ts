import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function accessToken() {
  const email = Deno.env.get("FCM_CLIENT_EMAIL")!;
  const key = await importPKCS8(Deno.env.get("FCM_PRIVATE_KEY")!.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(email).setSubject(email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("1h").sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  if (!response.ok) throw new Error("FCM authorization failed");
  return (await response.json()).access_token as string;
}

Deno.serve(async (request) => {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(URL, SERVICE);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { orderId } = await request.json();
    const { data: order } = await admin.from("orders").select("customer_session_id").eq("id", orderId).single();
    const { data: staff } = await admin.from("staff_profiles").select("id").eq("id", user.id).maybeSingle();
    if (!order || (order.customer_session_id !== user.id && !staff)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { data: notification } = await admin.from("customer_notifications").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!notification) return Response.json({ delivered: 0 });
    const { data: devices } = await admin.from("customer_devices").select("id,push_token").eq("customer_session_id", notification.customer_session_id).eq("is_active", true);
    if (!devices?.length) return Response.json({ delivered: 0 });
    const token = await accessToken();
    const project = Deno.env.get("FCM_PROJECT_ID")!;
    let delivered = 0;
    for (const device of devices) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: device.push_token, data: { title: notification.title, body: notification.body, route: notification.route, notificationId: notification.id }, webpush: { headers: { Urgency: "high" } } } }) });
      if (response.ok) delivered += 1;
      else await admin.from("customer_devices").update({ is_active: false }).eq("id", device.id);
    }
    return Response.json({ delivered });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return Response.json({ error: "Push delivery failed" }, { status: 500 });
  }
});
