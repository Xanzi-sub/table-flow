"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MenuItem, MenuSpecial } from "@/types/database";

const CART_STORAGE_KEY = "tf_cart";

export interface CartLine {
  lineId: string;
  item: MenuItem;
  quantity: number;
  notes: string;
  unitPrice: number;
  specialId?: string;
  specialName?: string;
  kind: "item" | "combo";
  comboItems?: MenuItem[];
}

export interface ItemOffer {
  specialId: string;
  specialName: string;
  unitPrice: number;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (item: MenuItem, quantity: number, notes: string) => void;
  addCombo: (special: MenuSpecial, items: MenuItem[]) => void;
  getItemOffer: (item: MenuItem) => ItemOffer | null;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children, specials }: { children: React.ReactNode; specials: MenuSpecial[] }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore an in-progress cart after a refresh — lost cart contents were a
  // real complaint, since this previously only lived in React state.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CartLine>[];
        setLines(
          parsed.map((line) => ({
            lineId: line.lineId ?? `item:${line.item!.id}:${line.notes ?? ""}`,
            item: line.item!,
            quantity: line.quantity ?? 1,
            notes: line.notes ?? "",
            unitPrice: line.unitPrice ?? line.item!.price,
            specialId: line.specialId,
            specialName: line.specialName,
            kind: line.kind ?? "item",
            comboItems: line.comboItems,
          }))
        );
      }
    } catch {
      // Corrupt/old cache — ignore and start with an empty cart.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const getItemOffer = useCallback(
    (item: MenuItem): ItemOffer | null => {
      const offers = specials
        .filter((special) => special.kind === "item_discount" && special.item_ids.includes(item.id))
        .map((special) => ({
          specialId: special.id,
          specialName: special.name,
          unitPrice:
            special.discount_type === "percentage"
              ? Math.max(0, item.price * (1 - special.discount_value / 100))
              : Math.min(item.price, special.discount_value),
        }))
        .sort((first, second) => first.unitPrice - second.unitPrice);
      if (!offers[0]) return null;
      return { ...offers[0], unitPrice: Math.round(offers[0].unitPrice * 100) / 100 };
    },
    [specials]
  );

  useEffect(() => {
    if (!hydrated) return;
    setLines((current) =>
      current.flatMap<CartLine>((line) => {
        if (line.kind === "combo") {
          const special = line.specialId ? specials.find((entry) => entry.id === line.specialId) : null;
          if (!special || special.kind !== "combo") return [];
          return [{ ...line, unitPrice: special.discount_value, specialName: special.name }];
        }

        const offer = getItemOffer(line.item);
        return [
          {
            ...line,
            unitPrice: offer?.unitPrice ?? line.item.price,
            specialId: offer?.specialId,
            specialName: offer?.specialName,
          },
        ];
      })
    );
  }, [getItemOffer, hydrated, specials]);

  const addItem = useCallback(
    (item: MenuItem, quantity: number, notes: string) => {
      const offer = getItemOffer(item);
      const lineId = `item:${item.id}:${notes}`;
      setLines((prev) => {
        const existing = prev.find((line) => line.lineId === lineId);
        if (existing) {
          return prev.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + quantity } : l
          );
        }
        return [
          ...prev,
          {
            lineId,
            item,
            quantity,
            notes,
            unitPrice: offer?.unitPrice ?? item.price,
            specialId: offer?.specialId,
            specialName: offer?.specialName,
            kind: "item" as const,
          },
        ];
      });
    },
    [getItemOffer]
  );

  const addCombo = useCallback((special: MenuSpecial, items: MenuItem[]) => {
    if (!items[0]) return;
    const lineId = `combo:${special.id}`;
    setLines((prev) => {
      const existing = prev.find((line) => line.lineId === lineId);
      if (existing) {
        return prev.map((line) => (line.lineId === lineId ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          lineId,
          item: items[0],
          quantity: 1,
          notes: "",
          unitPrice: special.discount_value,
          specialId: special.id,
          specialName: special.name,
          kind: "combo" as const,
          comboItems: items,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.lineId !== lineId)
        : prev.map((l) =>
            l.lineId === lineId ? { ...l, quantity } : l
          )
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((line) => line.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalItems = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines]
  );

  return (
    <CartContext.Provider
      value={{
        lines,
        addItem,
        addCombo,
        getItemOffer,
        updateQuantity,
        removeItem,
        clear,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
