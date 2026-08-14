"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { UserRole } from "@/types/database";
import { signOutStaff } from "@/app/actions/auth";
import { toggleCheckIn } from "@/app/actions/tables";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", roles: ["waiter", "manager", "admin"] },
  { href: "/staff/orders", label: "Order History", roles: ["waiter"] },
  { href: "/admin/tables", label: "Tables & QR", roles: ["manager", "admin"] },
  { href: "/admin/orders", label: "Order History", roles: ["manager", "admin"] },
  { href: "/admin/customers", label: "Customers", roles: ["manager", "admin"] },
  { href: "/admin/menu", label: "Menu", roles: ["manager", "admin"] },
  { href: "/admin/menu-scan", label: "Menu Scan", roles: ["manager", "admin"] },
  { href: "/staff/marketing", label: "Marketing", roles: ["manager", "admin"] },
  { href: "/admin/analytics", label: "Analytics", roles: ["manager", "admin"] },
  { href: "/admin/staff", label: "Staff", roles: ["manager", "admin"] },
  { href: "/admin/settings", label: "Settings", roles: ["manager", "admin"] },
];

export function StaffShell({
  role,
  fullName,
  staffId,
  isCheckedIn,
  venueName,
  venueLogoUrl,
  children,
}: {
  role: UserRole;
  fullName: string;
  staffId: string;
  isCheckedIn: boolean;
  venueName?: string | null;
  venueLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const [navOpen, setNavOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState(isCheckedIn);
  const [togglingDuty, setTogglingDuty] = useState(false);

  async function handleDutyToggle() {
    const next = !checkedIn;
    setTogglingDuty(true);
    setCheckedIn(next);
    const result = await toggleCheckIn(staffId, next);
    setTogglingDuty(false);
    if (!result.success) setCheckedIn(!next);
  }

  // Exact match or a real sub-path (next char is "/") — plain startsWith()
  // wrongly matched "/admin/menu-scan" against the "/admin/menu" link too.
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials = (fullName || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5">
            {venueLogoUrl ? (
              <Image
                src={venueLogoUrl}
                alt={venueName ?? "Venue logo"}
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border)] object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gray-900)] text-xs font-bold text-white">
                {(venueName ?? "TF").slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold text-[var(--foreground)]">
                {venueName ?? "TableFlow"}
              </span>
              {venueName && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                  TableFlow
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {role === "waiter" && (
              <button
                onClick={handleDutyToggle}
                disabled={togglingDuty}
                className={`btn !text-xs sm:!text-sm ${checkedIn ? "btn-primary" : "btn-secondary"}`}
              >
                <span className={`h-2 w-2 rounded-full ${checkedIn ? "bg-white" : "bg-[var(--gray-400)]"}`} />
                {checkedIn ? "On Duty" : "Off Duty"}
              </button>
            )}
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gray-100)] text-xs font-bold text-[var(--gray-700)]">
                {initials}
              </span>
              <span className="text-sm text-[var(--foreground-muted)]">
                {fullName} · <span className="capitalize text-[var(--foreground)]">{role}</span>
              </span>
            </div>
            <form action={signOutStaff} className="hidden xl:block">
              <button className="btn btn-secondary">Sign out</button>
            </form>
            <button
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Toggle navigation"
              className="btn btn-secondary !px-2.5 xl:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                {navOpen ? (
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <nav className="hidden items-center gap-0.5 overflow-x-auto border-t border-[var(--border)] px-4 py-1.5 sm:px-6 lg:px-10 xl:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-[var(--accent-50)] text-[var(--accent-700)]"
                  : "text-[var(--gray-600)] hover:bg-[var(--gray-100)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {navOpen && (
          <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 xl:hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isActive(item.href)
                    ? "bg-[var(--accent-50)] text-[var(--accent-700)]"
                    : "text-[var(--gray-600)] hover:bg-[var(--gray-100)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="text-sm text-[var(--foreground-muted)]">
                {fullName} · <span className="capitalize text-[var(--foreground)]">{role}</span>
              </span>
              <form action={signOutStaff}>
                <button className="btn btn-secondary">Sign out</button>
              </form>
            </div>
          </nav>
        )}
      </header>
      <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
