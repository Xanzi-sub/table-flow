import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

// Fixed locale/timezone so server-rendered and client-rendered output always
// match exactly — using the runtime's default locale causes hydration
// mismatches when the server (Node/ICU) and browser locales differ.
export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

export function formatStaffName(value: string | null | undefined, fallback = "Staff member") {
  const name = value?.trim();
  if (!name) return fallback;
  if (name.includes("@")) {
    const localPart = name.split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
    return localPart || fallback;
  }
  return name;
}
