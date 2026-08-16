export function safeInternalRedirect(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://tableflow.invalid");
    return parsed.origin === "https://tableflow.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
