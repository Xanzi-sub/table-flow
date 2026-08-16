"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type {
  MenuCategory,
  MenuCategoryGroup,
  MenuItem,
  MenuSpecial,
  TableRow,
} from "@/types/database";
import { CartProvider, useCart } from "@/context/CartContext";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { MobileContainer } from "./MobileContainer";
import { CategoryNav } from "./CategoryNav";
import { MenuItemCard } from "./MenuItemCard";
import { ItemDetailModal } from "./ItemDetailModal";
import { CartDrawer } from "./CartDrawer";
import { OrderStatusTracker } from "./OrderStatusTracker";
import { OrderHistoryModal } from "./OrderHistoryModal";
import { NamePrompt } from "./NamePrompt";
import { CustomerAppBridge } from "./CustomerAppBridge";
import {
  CartIcon,
  ReceiptIcon,
  WarningIcon,
} from "./Icon";

const FINGERPRINT_KEY = "tf_customer_id";
const NAME_KEY = "tf_customer_name";
const RECOVERY_SECRET_KEY = "tf_customer_recovery_secret";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deviceCredentials(reset = false) {
  if (reset) {
    localStorage.removeItem(FINGERPRINT_KEY);
    localStorage.removeItem(RECOVERY_SECRET_KEY);
    localStorage.removeItem(NAME_KEY);
  }
  const legacyId = localStorage.getItem(FINGERPRINT_KEY);
  const deviceId = legacyId && UUID_PATTERN.test(legacyId) ? legacyId : crypto.randomUUID();
  let secret = localStorage.getItem(RECOVERY_SECRET_KEY);
  if (!secret) {
    secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  localStorage.setItem(FINGERPRINT_KEY, deviceId);
  localStorage.setItem(RECOVERY_SECRET_KEY, secret);
  return { deviceId, secret, legacyCustomerId: legacyId && UUID_PATTERN.test(legacyId) ? legacyId : null };
}

interface CustomerMenuAppProps {
  table: TableRow;
  categories: MenuCategory[];
  items: MenuItem[];
  groups: MenuCategoryGroup[];
  venueName: string;
  venueLogoUrl: string | null;
  vatPercentage: number;
  tipPercentage: number;
  waiterName: string | null;
  recommendationsByItem: Record<string, MenuItem[]>;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  specials: MenuSpecial[];
}

/* -------------------------------------------------------------------------- */
/* Header actions                                                             */
/* -------------------------------------------------------------------------- */

function CartButton({ onOpen }: { onOpen: () => void }) {
  const { totalItems, totalAmount } = useCart();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View your order"
      className="
        relative flex h-10 items-center gap-2 rounded-full
        border border-neutral-200 bg-white px-3
        text-neutral-800 shadow-sm
        transition-all duration-200
        active:scale-95
      "
    >
      <CartIcon className="h-[17px] w-[17px]" />

      {totalItems > 0 && (
        <>
          <span className="text-xs font-bold">
            {formatCurrency(totalAmount)}
          </span>

          <span
            className="
              absolute -right-1.5 -top-1.5
              flex h-[18px] min-w-[18px] items-center justify-center
              rounded-full bg-neutral-900 px-1
              text-[10px] font-bold text-white
              ring-2 ring-white
            "
          >
            {totalItems}
          </span>
        </>
      )}
    </button>
  );
}

function OrdersButton({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View your orders"
      className="
        relative flex h-10 w-10 items-center justify-center
        rounded-full border border-neutral-200
        bg-white text-neutral-700 shadow-sm
        transition-all duration-200
        active:scale-95
      "
    >
      <ReceiptIcon className="h-[17px] w-[17px]" />

      <span
        className="
          absolute -right-1.5 -top-1.5
          flex h-[18px] min-w-[18px] items-center justify-center
          rounded-full bg-neutral-900 px-1
          text-[10px] font-bold text-white
          ring-2 ring-white
        "
      >
        {count}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating cart                                                             */
/* -------------------------------------------------------------------------- */

function CartFab({ onOpen }: { onOpen: () => void }) {
  const { totalItems, totalAmount } = useCart();

  if (totalItems === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4">
      <button
        type="button"
        onClick={onOpen}
        className="
          pointer-events-auto mx-auto flex w-full max-w-md
          items-center justify-between
          rounded-2xl bg-neutral-950 px-4 py-3.5
          text-white shadow-[0_12px_40px_rgba(0,0,0,0.22)]
          ring-1 ring-black/5
          transition-all duration-200
          active:scale-[0.985]
        "
      >
        <div className="flex items-center gap-3">
          <span
            className="
              flex h-9 w-9 items-center justify-center
              rounded-xl bg-white/10
            "
          >
            <CartIcon className="h-4 w-4" />
          </span>

          <div className="text-left">
            <p className="text-xs font-medium text-white/60">
              Your order
            </p>
            <p className="text-sm font-bold">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">
            {formatCurrency(totalAmount)}
          </span>

          <span className="text-white/50">→</span>
        </div>
      </button>
    </div>
  );
}

function SpecialsRail({ specials, items }: { specials: MenuSpecial[]; items: MenuItem[] }) {
  const { addCombo, addItem } = useCart();
  const [expanded, setExpanded] = useState(false);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  if (specials.length === 0) return null;

  function ruleLabel(special: MenuSpecial) {
    if (special.kind === "combo") return formatCurrency(special.discount_value);
    if (special.discount_type === "quantity_deal") {
      return `Buy ${special.buy_quantity}, pay ${special.pay_quantity}`;
    }
    if (special.discount_type === "fixed_price") {
      return `${special.applicable_quantity} for ${formatCurrency(special.discount_value)}`;
    }
    return `${special.discount_value}% off from ${special.applicable_quantity}`;
  }

  return (
    <section className="shrink-0 border-b border-[#dce5d7] bg-[#f2f8ec]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="active-specials"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2.5 text-left sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-500)] text-[11px] font-bold text-white">
            {specials.length}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-700)]">
              {specials.length === 1 ? "Special available" : "Specials available"}
            </p>
            <p className="truncate text-[13px] font-bold text-[#171614]">
              {expanded ? "Offers right now" : specials[0].name}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-[var(--accent-700)]">
          {expanded ? "Hide offers" : "View offers"}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {expanded && <div id="active-specials" className="flex gap-3 overflow-x-auto border-t border-[#dce5d7] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        {specials.map((special) => {
          const specialItems = special.item_ids
            .map((id) => itemMap.get(id))
            .filter((item): item is MenuItem => Boolean(item));
          const regularTotal = specialItems.reduce((sum, item) => sum + item.price, 0);
          const isCombo = special.kind === "combo";
          const canQuickAdd = isCombo ? specialItems.length >= 2 : specialItems.length === 1;
          return (
            <article key={special.id} className="min-w-[270px] rounded-[18px] border border-[#e2dbd1] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="rounded-full bg-[var(--accent-500)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                    {isCombo ? "Combo" : "Special"}
                  </span>
                  <h3 className="mt-2 truncate text-[14px] font-bold text-[#171614]">{special.name}</h3>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#77736d]">
                    {special.description || specialItems.map((item) => item.name).join(isCombo ? " + " : ", ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="max-w-[110px] text-[13px] font-bold text-[#171614]">{ruleLabel(special)}</p>
                  {isCombo && regularTotal > special.discount_value && (
                    <p className="text-[10px] text-[#aaa49b] line-through">{formatCurrency(regularTotal)}</p>
                  )}
                </div>
              </div>
              {canQuickAdd ? (
                <button
                  type="button"
                  onClick={() =>
                    isCombo
                      ? addCombo(special, specialItems)
                      : addItem(specialItems[0], special.applicable_quantity, "")
                  }
                  className="mt-3 w-full rounded-full bg-[var(--accent-500)] py-2 text-[11px] font-semibold text-white hover:bg-[var(--accent-600)]"
                >
                  {isCombo ? "Add combo" : `Add ${special.applicable_quantity}`}
                </button>
              ) : (
                <p className="mt-3 text-[10px] text-[#99938a]">Available on {specialItems.length} menu items below.</p>
              )}
            </article>
          );
        })}
      </div>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Menu browser                                                              */
/* -------------------------------------------------------------------------- */

function MenuBrowser({
  categories,
  items,
  groups,
  specials,
  onSelectItem,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  groups: MenuCategoryGroup[];
  specials: MenuSpecial[];
  onSelectItem: (item: MenuItem) => void;
}) {
  const groupedByGroup = useMemo(() => {
    const sections = [
      ...groups,
      {
        id: "__ungrouped__",
        name: "",
        sort_order: Infinity,
        is_active: true,
        created_at: "",
      },
    ];

    return sections
      .map((group) => ({
        group,
        categories: categories.filter(
          (category) =>
            (category.group_id ?? "__ungrouped__") === group.id
        ),
      }))
      .filter((group) => group.categories.length > 0);
  }, [categories, groups]);

  const [activeGroupId, setActiveGroupId] = useState(
    groupedByGroup[0]?.group.id ?? "__ungrouped__"
  );

  const activeGroupCategories = useMemo(
    () =>
      groupedByGroup.find(
        (group) => group.group.id === activeGroupId
      )?.categories ?? [],
    [groupedByGroup, activeGroupId]
  );

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    activeGroupCategories[0]?.id ?? null
  );

  useEffect(() => {
    if (
      activeGroupId &&
      !groupedByGroup.some(
        (group) => group.group.id === activeGroupId
      )
    ) {
      const first = groupedByGroup[0];

      if (first) {
        setActiveGroupId(first.group.id);
        setActiveCategoryId(first.categories[0]?.id ?? null);
      }
    }
  }, [activeGroupId, groupedByGroup]);

  useEffect(() => {
    if (!activeCategoryId && activeGroupCategories.length > 0) {
      setActiveCategoryId(activeGroupCategories[0].id);
    }
  }, [activeCategoryId, activeGroupCategories]);

  function selectGroup(groupId: string) {
    setActiveGroupId(groupId);

    const firstCategory = groupedByGroup.find(
      (group) => group.group.id === groupId
    )?.categories[0];

    setActiveCategoryId(firstCategory?.id ?? null);
  }

  function scrollToCategory(id: string) {
    setActiveCategoryId(id);

    requestAnimationFrame(() => {
      document
        .getElementById(`category-${id}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafaf9]">
      <SpecialsRail specials={specials} items={items} />
      {/* Group navigation */}
      {groupedByGroup.length > 1 && (
        <div className="shrink-0 border-b border-neutral-200/80 bg-white">
          <nav
            className="
              flex gap-5 overflow-x-auto px-3 pt-1 sm:gap-6 sm:px-5
              scrollbar-none
            "
          >
            {groupedByGroup.map(({ group }) => {
              const active = activeGroupId === group.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(group.id)}
                  className={`
                    relative shrink-0 py-3.5
                    text-sm font-semibold
                    transition-colors duration-200
                    ${
                      active
                        ? "text-neutral-950"
                        : "text-neutral-400"
                    }
                  `}
                >
                  {group.name || "More"}

                  {active && (
                    <span
                      className="
                        absolute inset-x-0 -bottom-px
                        h-0.5 rounded-full bg-neutral-950
                      "
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Category navigation */}
      <div className="shrink-0 border-b border-neutral-200/70 bg-white">
        <CategoryNav
          categories={activeGroupCategories}
          activeId={activeCategoryId}
          onSelect={scrollToCategory}
        />
      </div>

      {/* Menu */}
      <div
        className="
          min-h-0 flex-1 overflow-y-auto
          px-3 pb-32 pt-4 sm:px-4 sm:pt-5
          overscroll-contain
        "
      >
        {activeGroupCategories.map((category) => {
          const catItems = items.filter(
            (item) => item.category_id === category.id
          );

          return (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="mb-6 scroll-mt-24 last:mb-4 sm:mb-8"
            >
              <div className="mb-2 flex items-end justify-between px-0.5 sm:mb-3">
                <div>
                  <h2 className="text-[17px] font-bold tracking-[-0.02em] text-neutral-950 sm:text-[19px]">
                    {category.name}
                  </h2>

                  {catItems.length > 0 && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {catItems.length}{" "}
                      {catItems.length === 1 ? "item" : "items"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                {catItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onSelect={onSelectItem}
                  />
                ))}

                {catItems.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm text-neutral-400">
                      Nothing available in this category.
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {activeGroupCategories.length === 0 && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">
                Menu coming soon
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                There are no items available right now.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main application                                                           */
/* -------------------------------------------------------------------------- */

function MenuAppContent({
  table,
  categories,
  items,
  groups,
  venueName,
  venueLogoUrl,
  vatPercentage,
  tipPercentage,
  waiterName,
  recommendationsByItem,
  loyaltyRewardThreshold,
  loyaltyRewardValue,
  specials,
}: CustomerMenuAppProps) {
  const [identity, setIdentity] = useState<{
    userId: string;
    customerId: string | null;
    name: string;
  } | null>(null);

  const [awaitingName, setAwaitingName] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      setInitializing(true);
      setSessionError(null);

      try {
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        let userId = existingUser?.id ?? null;
        const hadStaffSession = Boolean(existingUser && !existingUser.is_anonymous);

        if (!userId || hadStaffSession) {
          await supabase.auth.signOut().catch(() => {});
          const { data, error } =
            await supabase.auth.signInAnonymously();

          if (error || !data.user) {
            setSessionError(
              error?.message === "Anonymous sign-ins are disabled"
                ? "Ordering isn't set up yet for this venue. Please tell a member of staff."
                : "We couldn't start your session. Please refresh and try again."
            );

            return;
          }

          userId = data.user.id;
        }
        const credentials = deviceCredentials(hadStaffSession);
        const cachedName = localStorage.getItem(NAME_KEY);

        const { data: recovered, error: recoveryError } = await supabase.rpc("recover_customer_device", {
          p_device_id: credentials.deviceId,
          p_recovery_secret: credentials.secret,
          p_full_name: cachedName,
          p_legacy_customer_id: credentials.legacyCustomerId,
        });
        let profile = recovered as {
          customer_id: string;
          full_name: string | null;
          loyalty_points: number;
        } | null;
        if (recoveryError || !profile) {
          const freshCredentials = deviceCredentials(true);
          const { data: fresh, error: freshError } = await supabase.rpc("start_fresh_customer_device", {
            p_device_id: freshCredentials.deviceId,
            p_recovery_secret: freshCredentials.secret,
          });
          if (freshError || !fresh) {
            setSessionError("We couldn't start a fresh customer profile. Please close this page and scan the table QR code again.");
            return;
          }
          profile = fresh as typeof profile;
          setOrderIds([]);
          setLoyaltyPoints(0);
          setIdentity({ userId, customerId: userId, name: "" });
          setAwaitingName(true);
          return;
        }

        const { data: pastOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_session_id", userId)
          .order("created_at", { ascending: false });

        if (pastOrders) {
          setOrderIds(pastOrders.map((order) => order.id));
        }
        setLoyaltyPoints(profile.loyalty_points ?? 0);

        const recoveredName = profile.full_name?.trim() || cachedName?.trim() || "";
        if (recoveredName) {
          localStorage.setItem(NAME_KEY, recoveredName);
          setIdentity({
            userId,
            customerId: profile.customer_id,
            name: recoveredName,
          });
        } else {
          setIdentity({
            userId,
            customerId: profile.customer_id,
            name: "",
          });

          setAwaitingName(true);
        }
      } catch {
        setSessionError(
          "Something went wrong while getting things ready. Please refresh and try again."
        );
      } finally {
        setInitializing(false);
      }
    }

    establishSession();
  }, [table.id]);

  async function handleNameSubmit(name: string) {
    if (!identity) return;

    const cleanName = name.trim();

    if (!cleanName) return;

    const supabase = createClient();
    const credentials = deviceCredentials();
    const { data: recovered, error } = await supabase.rpc("recover_customer_device", {
      p_device_id: credentials.deviceId,
      p_recovery_secret: credentials.secret,
      p_full_name: cleanName,
      p_legacy_customer_id: credentials.legacyCustomerId,
    });
    if (error || !recovered) {
      setSessionError("We couldn't save your name. Please try again.");
      return;
    }
    localStorage.setItem(NAME_KEY, cleanName);

    setIdentity({
      ...identity,
      customerId: identity.userId,
      name: cleanName,
    });

    setAwaitingName(false);
  }

  return (
    <MobileContainer>
      {identity && <CustomerAppBridge customerSessionId={identity.userId} />}
      <div className="relative flex h-full flex-col overflow-hidden bg-[#fafaf9]">
        {/* ---------------------------------------------------------------- */}
        {/* Venue header                                                     */}
        {/* ---------------------------------------------------------------- */}

        <header
          className="
            relative z-20 shrink-0
            border-b border-neutral-200/80
            bg-white
          "
        >
          <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              {venueLogoUrl ? (
                <div
                  className="
                    relative h-10 w-10 shrink-0
                    overflow-hidden rounded-xl
                    bg-neutral-100
                    ring-1 ring-black/[0.06]
                  "
                >
                  <Image
                    src={venueLogoUrl}
                    alt={venueName}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className="
                    flex h-10 w-10 shrink-0
                    items-center justify-center
                    rounded-xl bg-neutral-950
                    text-xs font-bold tracking-tight text-white
                  "
                >
                  {venueName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold tracking-[-0.01em] text-neutral-950">
                  {venueName}
                </p>

                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  <p className="truncate text-[11px] font-medium text-neutral-400">
                    Table {table.table_number ?? "—"}
                    {table.section ? ` · ${table.section}` : ""}
                  </p>
                </div>
                {identity && !awaitingName && (
                  <p className="mt-1 text-[10px] font-semibold text-[#8a847b]">
                    {loyaltyPoints} loyalty points
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <OrdersButton
                count={orderIds.length}
                onOpen={() => setHistoryOpen(true)}
              />

              <CartButton onOpen={() => setCartOpen(true)} />
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Menu                                                             */}
        {/* ---------------------------------------------------------------- */}

        {initializing ? (
          <div className="flex flex-1 flex-col bg-[#fafaf9]">
            <div className="flex gap-4 border-b border-neutral-200/70 bg-white px-3 py-3 sm:gap-5 sm:px-5 sm:py-3.5">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-4 w-16 animate-pulse rounded-full bg-neutral-100"
                />
              ))}
            </div>

            <div className="space-y-3 px-3 pt-5 sm:px-4 sm:pt-6">
              <div className="h-6 w-28 animate-pulse rounded-lg bg-neutral-200" />

              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="
                    flex h-24 animate-pulse
                    gap-3 rounded-2xl
                    bg-white p-3
                  "
                >
                  <div className="h-full w-20 shrink-0 rounded-xl bg-neutral-100" />

                  <div className="flex flex-1 flex-col justify-center gap-2">
                    <div className="h-4 w-2/3 rounded bg-neutral-100" />
                    <div className="h-3 w-full rounded bg-neutral-100" />
                    <div className="h-3 w-1/3 rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <MenuBrowser
            categories={categories}
            items={items}
            groups={groups}
            specials={specials}
            onSelectItem={setSelectedItem}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Floating cart                                                    */}
        {/* ---------------------------------------------------------------- */}

        {identity && !awaitingName && (
          <CartFab onOpen={() => setCartOpen(true)} />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Item detail                                                       */}
        {/* ---------------------------------------------------------------- */}

        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            recommendations={recommendationsByItem[selectedItem.id] ?? []}
            onClose={() => setSelectedItem(null)}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Cart                                                              */}
        {/* ---------------------------------------------------------------- */}

        {identity && !awaitingName && cartOpen && (
          <CartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            tableId={table.id}
            customerSessionId={identity.userId}
            customerId={identity.customerId}
            loyaltyPoints={loyaltyPoints}
            loyaltyRewardThreshold={loyaltyRewardThreshold}
            loyaltyRewardValue={loyaltyRewardValue}
            onPointsChanged={setLoyaltyPoints}
            onOrderSubmitted={(orderId) => {
              setCartOpen(false);
              setOrderIds((prev) => [orderId, ...prev]);
              setViewingOrderId(orderId);
            }}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Order tracker                                                    */}
        {/* ---------------------------------------------------------------- */}

        {viewingOrderId && (
          <OrderStatusTracker
            orderId={viewingOrderId}
            tableId={table.id}
            venueName={venueName}
            tableNumber={table.table_number}
            vatPercentage={vatPercentage}
            tipPercentage={tipPercentage}
            waiterName={waiterName}
            customerId={identity?.customerId ?? null}
            loyaltyPoints={loyaltyPoints}
            loyaltyRewardThreshold={loyaltyRewardThreshold}
            loyaltyRewardValue={loyaltyRewardValue}
            onPointsChanged={setLoyaltyPoints}
            onClose={() => setViewingOrderId(null)}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Order history                                                    */}
        {/* ---------------------------------------------------------------- */}

        {historyOpen && (
          <OrderHistoryModal
            orderIds={orderIds}
            onSelectOrder={(orderId) => {
              setHistoryOpen(false);
              setViewingOrderId(orderId);
            }}
            onClose={() => setHistoryOpen(false)}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Customer identity                                                */}
        {/* ---------------------------------------------------------------- */}

        {awaitingName && (
          <NamePrompt onSubmit={handleNameSubmit} />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Session error                                                    */}
        {/* ---------------------------------------------------------------- */}

        {sessionError && (
          <div
            className="
              fixed inset-0 z-[100]
              flex items-center justify-center
              bg-neutral-950/60 p-5
              backdrop-blur-sm
            "
          >
            <div
              className="
                w-full max-w-sm
                rounded-3xl bg-white
                p-6 text-center
                shadow-2xl
              "
            >
              <div
                className="
                  mx-auto flex h-12 w-12
                  items-center justify-center
                  rounded-2xl bg-amber-50
                "
              >
                <WarningIcon className="h-6 w-6 text-amber-600" />
              </div>

              <h2 className="mt-4 text-base font-bold text-neutral-950">
                Something went wrong
              </h2>

              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {sessionError}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="
                  mt-5 w-full rounded-xl
                  bg-neutral-950 py-3
                  text-sm font-bold text-white
                  transition-transform
                  active:scale-[0.98]
                "
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                  */
/* -------------------------------------------------------------------------- */

export function CustomerMenuApp(props: CustomerMenuAppProps) {
  return (
    <CartProvider specials={props.specials}>
      <MenuAppContent {...props} />
    </CartProvider>
  );
}