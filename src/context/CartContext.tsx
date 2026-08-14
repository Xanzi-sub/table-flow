"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { MenuItem } from "@/types/database";

const CART_STORAGE_KEY = "tf_cart";

export interface CartLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (item: MenuItem, quantity: number, notes: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore an in-progress cart after a refresh — lost cart contents were a
  // real complaint, since this previously only lived in React state.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) setLines(JSON.parse(stored));
    } catch {
      // Corrupt/old cache — ignore and start with an empty cart.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const addItem = useCallback(
    (item: MenuItem, quantity: number, notes: string) => {
      setLines((prev) => {
        const existing = prev.find(
          (l) => l.item.id === item.id && l.notes === notes
        );
        if (existing) {
          return prev.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + quantity } : l
          );
        }
        return [...prev, { item, quantity, notes }];
      });
    },
    []
  );

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.item.id !== menuItemId)
        : prev.map((l) =>
            l.item.id === menuItemId ? { ...l, quantity } : l
          )
    );
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setLines((prev) => prev.filter((l) => l.item.id !== menuItemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalItems = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.item.price, 0),
    [lines]
  );

  return (
    <CartContext.Provider
      value={{
        lines,
        addItem,
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
