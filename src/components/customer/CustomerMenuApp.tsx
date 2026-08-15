"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { MenuCategory, MenuCategoryGroup, MenuItem, TableRow } from "@/types/database";
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
import { CartIcon, ReceiptIcon, WarningIcon } from "./Icon";

const FINGERPRINT_KEY = "tf_customer_id";
const NAME_KEY = "tf_customer_name";

interface CustomerMenuAppProps {
  table: TableRow;
  categories: MenuCategory[];
  items: MenuItem[];
  groups: MenuCategoryGroup[];
  venueName: string;
  venueLogoUrl: string | null;
}

function CartButton({ onOpen }: { onOpen: () => void }) {
  const { totalItems, totalAmount } = useCart();
  return (
    <button
      onClick={onOpen}
      className="relative flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5"
      aria-label="View your order"
    >
      <span className="text-base"><CartIcon className="h-4 w-4" /></span>
      {totalItems > 0 && (
        <span className="text-xs font-bold text-neutral-900">{formatCurrency(totalAmount)}</span>
      )}
      {totalItems > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {totalItems}
        </span>
      )}
    </button>
  );
}

function OrdersButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onOpen}
      className="relative flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5"
      aria-label="View your orders"
    >
      <span className="text-base"><ReceiptIcon className="h-4 w-4" /></span>
      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
        {count}
      </span>
    </button>
  );
}

function CartFab({ onOpen }: { onOpen: () => void }) {
  const { totalItems, totalAmount } = useCart();
  if (totalItems === 0) return null;

  return (
    <button
      onClick={onOpen}
      className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-neutral-900 px-5 py-4 text-white shadow-xl"
    >
      <span className="text-sm font-semibold">{totalItems} item(s)</span>
      <span className="text-sm font-semibold">
        View Cart · {formatCurrency(totalAmount)}
      </span>
    </button>
  );
}

function MenuBrowser({
  categories,
  items,
  groups,
  onSelectItem,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  groups: MenuCategoryGroup[];
  onSelectItem: (item: MenuItem) => void;
}) {
  const groupedByGroup = useMemo(() => {
    const sections = [...groups, { id: "__ungrouped__", name: "", sort_order: Infinity, is_active: true, created_at: "" }];
    return sections
      .map((group) => ({
        group,
        categories: categories.filter(
          (c) => (c.group_id ?? "__ungrouped__") === group.id
        ),
      }))
      .filter((g) => g.categories.length > 0);
  }, [categories, groups]);

  // Group tabs SWITCH the visible section entirely — they don't scroll to an
  // anchor within one long page. Category pills scroll within the active
  // group's (much shorter) content instead.
  const [activeGroupId, setActiveGroupId] = useState<string>(
    groupedByGroup[0]?.group.id ?? "__ungrouped__"
  );
  const activeGroupCategories = useMemo(
    () => groupedByGroup.find((g) => g.group.id === activeGroupId)?.categories ?? [],
    [groupedByGroup, activeGroupId]
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    activeGroupCategories[0]?.id ?? null
  );

  function selectGroup(groupId: string) {
    setActiveGroupId(groupId);
    const firstCategory = groupedByGroup.find((g) => g.group.id === groupId)?.categories[0];
    setActiveCategoryId(firstCategory?.id ?? null);
  }

  function scrollToCategory(id: string) {
    setActiveCategoryId(id);
    document
      .getElementById(`category-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {groupedByGroup.length > 1 && (
        <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-4 pt-3">
          {groupedByGroup.map(({ group }) => (
            <button
              key={group.id}
              onClick={() => selectGroup(group.id)}
              className={`shrink-0 border-b-2 px-1 pb-2 text-sm font-bold transition-colors ${
                activeGroupId === group.id
                  ? "border-amber-500 text-neutral-900"
                  : "border-transparent text-neutral-400"
              }`}
            >
              {group.name || "More"}
            </button>
          ))}
        </nav>
      )}
      <CategoryNav
        categories={activeGroupCategories}
        activeId={activeCategoryId}
        onSelect={scrollToCategory}
      />
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {activeGroupCategories.map((category) => {
          const catItems = items.filter((i) => i.category_id === category.id);
          return (
            <section key={category.id} id={`category-${category.id}`} className="mb-7 scroll-mt-24">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-neutral-900">
                  {category.name}
                </h2>
                <span className="text-xs font-medium text-neutral-400">
                  {catItems.length} item{catItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {catItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} onSelect={onSelectItem} />
                ))}
                {catItems.length === 0 && (
                  <p className="text-sm text-neutral-400">Nothing here yet.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function MenuAppContent({ table, categories, items, groups, venueName, venueLogoUrl }: CustomerMenuAppProps) {
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

  // Phone/OTP verification is skipped for now. Every visitor gets a silent
  // anonymous Supabase session (still satisfies customer_session_id =
  // auth.uid() RLS policies), cached in localStorage as their "fingerprint"
  // id so returning visitors on the same browser/device are recognized
  // automatically instead of being asked for their name again.
  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let userId = session?.user?.id ?? null;
      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          setSessionError(
            error?.message === "Anonymous sign-ins are disabled"
              ? "Ordering isn't set up yet for this venue (anonymous sign-ins are disabled in Supabase Auth). Please tell staff."
              : "Could not start your session. Please refresh and try again."
          );
          return;
        }
        userId = data.user.id;
      }

      localStorage.setItem(FINGERPRINT_KEY, userId);
      const cachedName = localStorage.getItem(NAME_KEY);

      // Restore order history from the DB (source of truth) instead of
      // in-memory state, which a page refresh would otherwise wipe — the
      // anon session itself already persists across reloads via Supabase's
      // own localStorage, so this just re-queries what that session ordered.
      const { data: pastOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("customer_session_id", userId)
        .eq("table_id", table.id)
        .order("created_at", { ascending: false });
      if (pastOrders) setOrderIds(pastOrders.map((o) => o.id));

      if (cachedName) {
        setIdentity({ userId, customerId: userId, name: cachedName });
      } else {
        setIdentity({ userId, customerId: userId, name: "" });
        setAwaitingName(true);
      }
    }

    establishSession();
  }, [table.id]);

  async function handleNameSubmit(name: string) {
    if (!identity) return;
    localStorage.setItem(NAME_KEY, name);
    const supabase = createClient();
    await supabase.from("customer_profiles").upsert({ id: identity.userId, full_name: name });
    setIdentity({ ...identity, name });
    setAwaitingName(false);
  }

  return (
    <MobileContainer>
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {venueLogoUrl ? (
            <Image
              src={venueLogoUrl}
              alt={venueName}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-lg border border-neutral-200 object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white">
              {venueName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-900">{venueName}</p>
            <p className="text-xs text-neutral-400">
              Table {table.table_number ?? "—"}
              {table.section ? ` · ${table.section}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OrdersButton count={orderIds.length} onOpen={() => setHistoryOpen(true)} />
          <CartButton onOpen={() => setCartOpen(true)} />
        </div>
      </header>

      <MenuBrowser
        categories={categories}
        items={items}
        groups={groups}
        onSelectItem={setSelectedItem}
      />

      {identity && !awaitingName && <CartFab onOpen={() => setCartOpen(true)} />}

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {identity && !awaitingName && cartOpen && (
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          tableId={table.id}
          customerSessionId={identity.userId}
          customerId={identity.customerId}
          onOrderSubmitted={(orderId) => {
            setCartOpen(false);
            setOrderIds((prev) => [orderId, ...prev]);
            setViewingOrderId(orderId);
          }}
        />
      )}

      {viewingOrderId && (
        <OrderStatusTracker
          orderId={viewingOrderId}
          tableId={table.id}
          venueName={venueName}
          tableNumber={table.table_number}
          onClose={() => setViewingOrderId(null)}
        />
      )}

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

      {awaitingName && <NamePrompt onSubmit={handleNameSubmit} />}

      {sessionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 sm:rounded-[2rem]">
          <div className="rounded-2xl bg-white p-5 text-center shadow-2xl">
            <WarningIcon className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-2 text-sm font-medium text-neutral-700">{sessionError}</p>
          </div>
        </div>
      )}
    </MobileContainer>
  );
}

export function CustomerMenuApp(props: CustomerMenuAppProps) {
  return (
    <CartProvider>
      <MenuAppContent {...props} />
    </CartProvider>
  );
}
