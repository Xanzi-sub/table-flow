import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests. Please try again later.");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

function digestIdentifier(identifier: string) {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("Rate limiting is not configured");
  return createHash("sha256").update(`${pepper}:${identifier}`).digest("hex");
}

export async function enforceRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: input.scope,
    p_identifier_hash: digestIdentifier(input.identifier.trim().toLowerCase()),
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error || !data?.[0]) throw new Error("Rate limiting is temporarily unavailable");
  const result = data[0];
  if (!result.allowed) throw new RateLimitError(result.retry_after_seconds);
  return result;
}

export async function getRequestIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export function getRequestIpFromHeaders(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export function trustedSiteOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  return origin === trustedSiteOrigin(request);
}

export async function readJsonBody<T>(
  request: Request,
  maxBytes = 32_768,
  requireTrustedOrigin = true
): Promise<T> {
  if (requireTrustedOrigin && !hasTrustedOrigin(request)) throw new Error("Untrusted request origin");
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") throw new Error("Content-Type must be application/json");

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Request body is too large");

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("Request body is too large");
  return JSON.parse(text) as T;
}

