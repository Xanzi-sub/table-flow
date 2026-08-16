"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  ClipboardList,
  DollarSign,
  LayoutGrid,
  LogOut,
  Bell,
  Menu as MenuIcon,
  QrCode,
  Settings,
  Sparkles,
  Tag,
  Table2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { signOutStaff } from "@/app/actions/auth";
import { toggleCheckIn } from "@/app/actions/tables";
import { formatStaffName } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { StaffNotificationCentre } from "@/components/staff/StaffNotifications";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  section: "operations" | "management";
  icon: LucideIcon;
}

interface ToastState {
  type: "success" | "error";
  message: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/staff/dashboard", label: "Live Floor", roles: ["waiter", "manager", "admin"], section: "operations", icon: LayoutGrid },
  { href: "/staff/orders", label: "Orders", roles: ["waiter"], section: "operations", icon: ClipboardList },
  { href: "/staff/tips", label: "Tips", roles: ["waiter"], section: "operations", icon: DollarSign },
  { href: "/staff/notifications", label: "Notifications", roles: ["waiter", "manager", "admin"], section: "operations", icon: Bell },
  { href: "/admin/tables", label: "Tables & QR", roles: ["manager", "admin"], section: "operations", icon: Table2 },
  { href: "/admin/orders", label: "Orders", roles: ["manager", "admin"], section: "operations", icon: ClipboardList },
  { href: "/admin/customers", label: "Customers", roles: ["manager", "admin"], section: "operations", icon: Users },
  { href: "/admin/tips", label: "Tips Cashouts", roles: ["manager", "admin"], section: "operations", icon: DollarSign },
  { href: "/admin/menu", label: "Menu", roles: ["manager", "admin"], section: "management", icon: UtensilsCrossed },
  { href: "/admin/specials", label: "Specials", roles: ["manager", "admin"], section: "management", icon: Tag },
  { href: "/admin/menu-scan", label: "Menu Scan", roles: ["manager", "admin"], section: "management", icon: QrCode },
  { href: "/staff/marketing", label: "Marketing", roles: ["manager", "admin"], section: "management", icon: TrendingUp },
  { href: "/admin/analytics", label: "Intelligence", roles: ["manager", "admin"], section: "management", icon: Sparkles },
  { href: "/admin/staff", label: "Staff", roles: ["manager", "admin"], section: "management", icon: Users },
  { href: "/admin/settings", label: "Settings", roles: ["manager", "admin"], section: "management", icon: Settings },
];

const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map(({ href, label }) => [href, label])
);

function Toast({ type, message }: ToastState) {
  const success = type === "success";
  const Icon = success ? Check : AlertCircle;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-md border px-4 py-3 shadow-lg ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

function UserAvatar({ displayName, compact = false }: { displayName: string; compact?: boolean }) {
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-label={displayName}
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 ${
        compact ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[10px]"
      }`}
    >
      {initials}
    </span>
  );
}

function DutyToggle({
  staffId,
  isCheckedIn,
  compact = false,
  onStatusChange,
}: {
  staffId: string;
  isCheckedIn: boolean;
  compact?: boolean;
  onStatusChange: (toast: ToastState) => void;
}) {
  const [checkedIn, setCheckedIn] = useState(isCheckedIn);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !checkedIn;
    setCheckedIn(next);
    startTransition(async () => {
      const result = await toggleCheckIn(staffId, next);
      if (!result.success) {
        setCheckedIn(!next);
        onStatusChange({ type: "error", message: "Failed to update duty status" });
        return;
      }
      onStatusChange({ type: "success", message: next ? "You're now on duty" : "You're now off duty" });
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <span className={`h-2 w-2 rounded-full ${checkedIn ? "bg-emerald-500" : "bg-slate-400"}`} />
        {pending ? "Updating" : checkedIn ? "On duty" : "Off duty"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${checkedIn ? "bg-emerald-500" : "bg-slate-400"}`} />
        <div>
          <p className="text-xs font-semibold text-slate-700">{checkedIn ? "On duty" : "Off duty"}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{checkedIn ? "Receiving tables" : "Not receiving tables"}</p>
        </div>
      </div>
      <span className="text-[11px] text-slate-500">{pending ? "..." : "Change"}</span>
    </button>
  );
}

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
    <nav aria-label={label}>
      <h2 className="mb-2 px-3 text-[11px] font-bold uppercase text-slate-400">{label}</h2>
      <div className="space-y-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"}`} />
              <span className="flex-1">{item.label}</span>
              {active && <span className="h-2 w-2 rounded-full bg-blue-700" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function VenueIdentity({ venueName, venueLogoUrl, mobile = false }: { venueName?: string | null; venueLogoUrl?: string | null; mobile?: boolean }) {
  const size = mobile ? 34 : 38;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {venueLogoUrl ? (
        <Image src={venueLogoUrl} alt={venueName ?? "Venue logo"} width={size} height={size} className={`${mobile ? "h-[34px] w-[34px]" : "h-[38px] w-[38px]"} shrink-0 rounded-md border border-slate-200 object-cover`} priority={!mobile} />
      ) : (
        <span className={`${mobile ? "h-[34px] w-[34px]" : "h-[38px] w-[38px]"} flex shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white`}>
          {(venueName ?? "TF").slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{venueName ?? "TableFlow"}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-400">Restaurant operations</p>
      </div>
    </div>
  );
}

export function StaffShell({
  role,
  fullName,
  staffId,
  isCheckedIn,
  venueName,
  venueLogoUrl,
  venueId,
  children,
}: {
  role: UserRole;
  fullName: string;
  staffId: string;
  isCheckedIn: boolean;
  venueName?: string | null;
  venueLogoUrl?: string | null;
  venueId?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const displayName = formatStaffName(fullName);
  const items = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role]);
  const operations = useMemo(() => items.filter((item) => item.section === "operations"), [items]);
  const management = useMemo(() => items.filter((item) => item.section === "management"), [items]);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );

  const pageTitle = useMemo(() => {
    const match = Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
    return match?.[1] ?? "TableFlow";
  }, [pathname]);

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const navigation = (onNavigate?: () => void) => (
    <div className="space-y-7">
      {operations.length > 0 && <NavigationGroup label="Operations" items={operations} isActive={isActive} onNavigate={onNavigate} />}
      {management.length > 0 && <NavigationGroup label="Management" items={management} isActive={isActive} onNavigate={onNavigate} />}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 xl:flex-row">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-200 bg-white xl:flex">
        <div className="flex h-[72px] items-center border-b border-slate-200 px-5">
          <VenueIdentity venueName={venueName} venueLogoUrl={venueLogoUrl} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">{navigation()}</div>
        <div className="flex justify-center border-t border-slate-200 py-3">
          <Image src="/images/table-flow-logo.png" alt="TableFlow" width={2172} height={724} className="h-16 w-auto opacity-70" />
        </div>
        <div className="space-y-3 border-t border-slate-200 p-4">
          {role === "waiter" && <DutyToggle staffId={staffId} isCheckedIn={isCheckedIn} onStatusChange={showToast} />}
          <div className="flex items-center gap-3 px-2 py-2">
            <UserAvatar displayName={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">{displayName}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-500">{role}</p>
            </div>
            <form action={signOutStaff}>
              <button type="submit" aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 xl:hidden">
        <VenueIdentity venueName={venueName} venueLogoUrl={venueLogoUrl} mobile />
        <div className="flex items-center gap-2">
          <StaffNotificationCentre staffId={staffId} venueId={venueId} compact />
          {role === "waiter" && <DutyToggle staffId={staffId} isCheckedIn={isCheckedIn} compact onStatusChange={showToast} />}
          <button type="button" onClick={() => setNavOpen(true)} aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
            <MenuIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {navOpen && (
        <>
          <button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/35 xl:hidden" />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[90vw] flex-col border-r border-slate-200 bg-white xl:hidden">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-xs font-bold uppercase text-slate-500">Navigation</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">{navigation(() => setNavOpen(false))}</div>
            <div className="flex justify-center border-t border-slate-200 py-3">
              <Image src="/images/table-flow-logo.png" alt="TableFlow" width={2172} height={724} className="h-16 w-auto opacity-70" />
            </div>
            <div className="space-y-3 border-t border-slate-200 p-4">
              <div className="flex items-center gap-3"><UserAvatar displayName={displayName} /><div className="min-w-0"><p className="truncate text-xs font-bold">{displayName}</p><p className="text-xs capitalize text-slate-500">{role}</p></div></div>
              <form action={signOutStaff}><button type="submit" className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button></form>
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col xl:pl-72">
        <div className="hidden h-[72px] items-center justify-between border-b border-slate-200 bg-white px-7 xl:flex">
          <div><p className="text-[11px] font-bold uppercase text-slate-400">{venueName ?? "TableFlow"}</p><p className="mt-1 text-sm font-bold text-slate-900">{pageTitle}</p></div>
          <div className="flex items-center gap-4">
            {role === "waiter" && <DutyToggle staffId={staffId} isCheckedIn={isCheckedIn} compact onStatusChange={showToast} />}
            <div className="h-5 w-px bg-slate-200" />
            <StaffNotificationCentre staffId={staffId} venueId={venueId} compact />
            <UserAvatar displayName={displayName} compact />
            <div className="text-right"><p className="text-xs font-bold">{displayName}</p><p className="text-xs capitalize text-slate-500">{role}</p></div>
            <form action={signOutStaff}><button type="submit" className="text-xs font-semibold text-slate-500 hover:text-slate-900">Sign out</button></form>
          </div>
        </div>
        <main className="app-content w-full flex-1 overflow-x-hidden px-4 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-6 lg:px-7 lg:py-7">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Mobile primary navigation">
        {[
          { href: "/staff/dashboard", label: "Floor", icon: LayoutGrid },
          { href: role === "waiter" ? "/staff/orders" : "/admin/orders", label: "Orders", icon: ClipboardList },
          { href: "/staff/notifications", label: "Alerts", icon: Bell },
          { href: role === "waiter" ? "/staff/tips" : "/admin/settings", label: role === "waiter" ? "Profile" : "Settings", icon: role === "waiter" ? Users : Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return <Link key={item.href} href={item.href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold ${active ? "text-blue-700" : "text-slate-500"}`}><Icon className="h-5 w-5" />{item.label}</Link>;
        })}
      </nav>

      {toast && <Toast {...toast} />}
    </div>
  );
}
