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
  section?: "operations" | "management";
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/staff/dashboard",
    label: "Live Floor",
    roles: ["waiter", "manager", "admin"],
    section: "operations",
  },
  {
    href: "/staff/orders",
    label: "Orders",
    roles: ["waiter"],
    section: "operations",
  },
  {
    href: "/staff/tips",
    label: "Tips",
    roles: ["waiter"],
    section: "operations",
  },
  {
    href: "/admin/tables",
    label: "Tables & QR",
    roles: ["manager", "admin"],
    section: "operations",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    roles: ["manager", "admin"],
    section: "operations",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    roles: ["manager", "admin"],
    section: "operations",
  },
  {
    href: "/admin/tips",
    label: "Tips Cashouts",
    roles: ["manager", "admin"],
    section: "operations",
  },
  {
    href: "/admin/menu",
    label: "Menu",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/admin/specials",
    label: "Specials",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/admin/menu-scan",
    label: "Menu Scan",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/staff/marketing",
    label: "Marketing",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/admin/analytics",
    label: "Intelligence",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/admin/staff",
    label: "Staff",
    roles: ["manager", "admin"],
    section: "management",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    roles: ["manager", "admin"],
    section: "management",
  },
];

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

type IconName =
  | "floor"
  | "orders"
  | "tables"
  | "customers"
  | "tips"
  | "menu"
  | "scan"
  | "marketing"
  | "analytics"
  | "staff"
  | "settings"
  | "close"
  | "chevron"
  | "logout";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "floor":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "orders":
      return (
        <svg {...common}>
          <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      );

    case "tables":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <path d="M4 10h16M10 5v14M14 5v14" />
        </svg>
      );

    case "customers":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" />
        </svg>
      );

    case "tips":
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="5" />
          <circle cx="15" cy="15" r="5" />
          <path d="M8 9h.01M15 15h.01" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <path d="M5 4h14M5 8h14M5 12h9M5 16h14M5 20h14" />
        </svg>
      );

    case "scan":
      return (
        <svg {...common}>
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
      );

    case "marketing":
      return (
        <svg {...common}>
          <path d="m4 13 7-7 9 9-7 7-9-9Z" />
          <path d="m13 7 4-4 4 4-4 4" />
          <path d="M7 17h.01" />
        </svg>
      );

    case "analytics":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="m7 15 3-4 3 2 5-7" />
        </svg>
      );

    case "staff":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c.5-3.3 2.3-5 5.5-5s5 1.7 5.5 5" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 15c2.2.2 3.7 1.8 4 4" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.6-1H6v-2.4h.1a1.7 1.7 0 0 0 1.6-1A1.7 1.7 0 0 0 8.1 9L8 8.9l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4V6a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 9l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.4H21a1.7 1.7 0 0 0-1.6.6Z" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
          <path d="M14 8l4 4-4 4M18 12H9" />
        </svg>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Navigation icon mapping                                                    */
/* -------------------------------------------------------------------------- */

function getNavIcon(label: string): IconName {
  switch (label) {
    case "Live Floor":
      return "floor";
    case "Orders":
      return "orders";
    case "Tables & QR":
      return "tables";
    case "Customers":
      return "customers";
    case "Tips":
    case "Tips Cashouts":
      return "tips";
    case "Menu":
    case "Specials":
      return "menu";
    case "Menu Scan":
      return "scan";
    case "Marketing":
      return "marketing";
    case "Analytics":
    case "Intelligence":
      return "analytics";
    case "Staff":
      return "staff";
    case "Settings":
      return "settings";
    default:
      return "floor";
  }
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                       */
/* -------------------------------------------------------------------------- */

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

    if (!result.success) {
      setCheckedIn(!next);
    }
  }

  // Exact match or a real sub-path (next char is "/") — plain startsWith()
  // wrongly matched "/admin/menu-scan" against the "/admin/menu" link too.
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials = (fullName || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const operations = items.filter((item) => item.section === "operations");
  const management = items.filter((item) => item.section === "management");

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F8] text-[#171A20] xl:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar                                                     */}
      {/* ------------------------------------------------------------------ */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-[#DFE2E6] bg-[#FFFFFF] xl:flex">
        {/* Brand */}
        <div className="flex h-[68px] items-center border-b border-[#E5E7EA] px-5">
          <div className="flex min-w-0 items-center gap-3">
            {venueLogoUrl ? (
              <Image
                src={venueLogoUrl}
                alt={venueName ?? "Venue logo"}
                width={34}
                height={34}
                className="h-[34px] w-[34px] shrink-0 rounded-[6px] border border-[#DDE1E5] object-cover"
              />
            ) : (
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[6px] bg-[#171A20] text-[10px] font-bold tracking-wide text-white">
                {(venueName ?? "TF").slice(0, 2).toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[#171A20]">
                {venueName ?? "TableFlow"}
              </div>

              <div className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.12em] text-[#949AA3]">
                Point of Sale
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          {operations.length > 0 && (
            <NavigationGroup label="Operations" items={operations} isActive={isActive} />
          )}

          {management.length > 0 && (
            <div className="mt-7">
              <NavigationGroup label="Management" items={management} isActive={isActive} />
            </div>
          )}
        </div>

        {/* Brand logo */}
        <div className="flex justify-center border-t border-[#E3E5E8] py-4">
          <Image
            src="/images/table-flow-logo.png"
            alt="TableFlow"
            width={2172}
            height={724}
            className="h-16 w-auto opacity-70"
          />
        </div>

        {/* Bottom user area */}
        <div className="border-t border-[#E3E5E8] p-3">
          {role === "waiter" && (
            <button
              onClick={handleDutyToggle}
              disabled={togglingDuty}
              className="mb-2 flex w-full items-center justify-between border border-[#E0E3E7] bg-[#FAFBFC] px-3 py-2.5 text-left transition-colors hover:bg-[#F4F5F7] disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${checkedIn ? "bg-emerald-500" : "bg-[#B7BCC4]"}`} />

                <div>
                  <div className="text-[10px] font-semibold text-[#353A42]">
                    {checkedIn ? "On duty" : "Off duty"}
                  </div>

                  <div className="mt-0.5 text-[8px] text-[#959BA4]">
                    {checkedIn ? "Receiving tables" : "Not receiving tables"}
                  </div>
                </div>
              </div>

              <span className="text-[9px] text-[#8C929B]">{togglingDuty ? "..." : "Change"}</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF0F3] text-[9px] font-bold text-[#515862]">
              {initials}
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-semibold text-[#30353D]">{fullName}</div>

              <div className="mt-0.5 text-[8px] capitalize text-[#969BA4]">{role}</div>
            </div>

            <form action={signOutStaff}>
              <button
                type="submit"
                title="Sign out"
                className="flex h-7 w-7 items-center justify-center text-[#9298A1] transition-colors hover:bg-[#F1F2F4] hover:text-[#30353D]"
              >
                <Icon name="logout" size={14} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile / tablet top header                                          */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-30 flex h-[64px] w-full items-center justify-between border-b border-[#DFE2E6] bg-white px-4 xl:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          {venueLogoUrl ? (
            <Image
              src={venueLogoUrl}
              alt={venueName ?? "Venue logo"}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-[6px] border border-[#DDE1E5] object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#171A20] text-[9px] font-bold text-white">
              {(venueName ?? "TF").slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-[#171A20]">
              {venueName ?? "TableFlow"}
            </div>

            <div className="text-[8px] uppercase tracking-[0.1em] text-[#969BA4]">Point of Sale</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === "waiter" && (
            <button
              onClick={handleDutyToggle}
              disabled={togglingDuty}
              className="flex h-8 items-center gap-2 border border-[#DDE1E5] bg-white px-2.5 text-[9px] font-semibold"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${checkedIn ? "bg-emerald-500" : "bg-[#B7BCC4]"}`} />

              {checkedIn ? "On duty" : "Off duty"}
            </button>
          )}

          <button
            onClick={() => setNavOpen((value) => !value)}
            aria-label="Toggle navigation"
            className="flex h-8 w-8 items-center justify-center border border-[#DDE1E5] bg-white text-[#555C66]"
          >
            {navOpen ? (
              <Icon name="close" size={16} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile navigation overlay                                           */}
      {/* ------------------------------------------------------------------ */}

      {navOpen && (
        <>
          <button
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 xl:hidden"
          />

          <aside className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#DFE2E6] bg-white xl:hidden">
            <div className="flex h-[64px] items-center justify-between border-b border-[#E3E5E8] px-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777D86]">
                Navigation
              </span>

              <button
                onClick={() => setNavOpen(false)}
                className="flex h-7 w-7 items-center justify-center text-[#777D86]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-5">
              {operations.length > 0 && (
                <NavigationGroup
                  label="Operations"
                  items={operations}
                  isActive={isActive}
                  onNavigate={() => setNavOpen(false)}
                />
              )}

              {management.length > 0 && (
                <div className="mt-7">
                  <NavigationGroup
                    label="Management"
                    items={management}
                    isActive={isActive}
                    onNavigate={() => setNavOpen(false)}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-center border-t border-[#E3E5E8] py-4">
              <Image
                src="/images/table-flow-logo.png"
                alt="TableFlow"
                width={2172}
                height={724}
                className="h-16 w-auto opacity-70"
              />
            </div>

            <div className="border-t border-[#E3E5E8] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF0F3] text-[9px] font-bold text-[#515862]">
                  {initials}
                </span>

                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold text-[#30353D]">{fullName}</div>

                  <div className="mt-0.5 text-[8px] capitalize text-[#969BA4]">{role}</div>
                </div>
              </div>

              <form action={signOutStaff}>
                <button
                  type="submit"
                  className="flex h-9 w-full items-center justify-center gap-2 border border-[#DDE1E5] bg-white text-[9px] font-semibold text-[#555C66] hover:bg-[#F5F6F8]"
                >
                  <Icon name="logout" size={14} />
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main application area                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col xl:pl-[236px]">
        {/* Desktop utility header */}
        <div className="hidden h-[64px] items-center justify-between border-b border-[#DFE2E6] bg-white px-7 xl:flex">
          <div>
            <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#9A9FA7]">
              {venueName ?? "TableFlow"}
            </div>

            <div className="mt-0.5 text-[11px] font-semibold text-[#3A3F47]">{getPageTitle(pathname)}</div>
          </div>

          <div className="flex items-center gap-4">
            {role === "waiter" && (
              <button
                onClick={handleDutyToggle}
                disabled={togglingDuty}
                className="flex items-center gap-2 border border-[#DDE1E5] bg-white px-3 py-2 text-[9px] font-semibold text-[#555C66] transition-colors hover:bg-[#F5F6F8]"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${checkedIn ? "bg-emerald-500" : "bg-[#B7BCC4]"}`} />

                {checkedIn ? "On duty" : "Off duty"}
              </button>
            )}

            <div className="h-5 w-px bg-[#E1E3E6]" />

            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF0F3] text-[8px] font-bold text-[#515862]">
                {initials}
              </span>

              <div className="leading-none">
                <div className="text-[9px] font-semibold text-[#3A3F47]">{fullName}</div>

                <div className="mt-1 text-[7px] capitalize text-[#969BA4]">{role}</div>
              </div>
            </div>

            <form action={signOutStaff}>
              <button type="submit" className="text-[9px] font-medium text-[#858B95] transition-colors hover:text-[#171A20]">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <main className="w-full flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation group                                                            */
/* -------------------------------------------------------------------------- */

function NavigationGroup({
  label,
  items,
  isActive,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 px-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#A0A5AD]">{label}</div>

      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href);
          const iconName = getNavIcon(item.label);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex h-[36px] items-center gap-2.5 px-2.5 text-[10px] font-medium transition-colors ${
                active
                  ? "bg-[#EEF2FF] text-[#2454D6]"
                  : "text-[#626973] hover:bg-[#F5F6F8] hover:text-[#30353D]"
              }`}
            >
              <span className={active ? "text-[#2454D6]" : "text-[#9298A1] group-hover:text-[#555C66]"}>
                <Icon name={iconName} size={15} />
              </span>

              <span className="flex-1">{item.label}</span>

              {active && <span className="h-1.5 w-1.5 rounded-full bg-[#2F5CFF]" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page title                                                                  */
/* -------------------------------------------------------------------------- */

function getPageTitle(pathname: string) {
  if (pathname === "/staff/dashboard") return "Live Floor";
  if (pathname.startsWith("/staff/orders")) return "Orders";
  if (pathname.startsWith("/staff/tips")) return "Tips";
  if (pathname.startsWith("/admin/tables")) return "Tables & QR";
  if (pathname.startsWith("/admin/orders")) return "Orders";
  if (pathname.startsWith("/admin/customers")) return "Customers";
  if (pathname.startsWith("/admin/tips")) return "Tips Cashouts";
  if (pathname.startsWith("/admin/menu-scan")) return "Menu Scan";
  if (pathname.startsWith("/admin/specials")) return "Specials";
  if (pathname.startsWith("/admin/menu")) return "Menu";
  if (pathname.startsWith("/staff/marketing")) return "Marketing";
  if (pathname.startsWith("/admin/analytics")) return "Intelligence";
  if (pathname.startsWith("/admin/staff")) return "Staff";
  if (pathname.startsWith("/admin/settings")) return "Settings";

  return "TableFlow";
}
