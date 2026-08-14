"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import { submitOrder } from "@/app/actions/orders";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  customerSessionId: string;
  customerId: string | null;
  onOrderSubmitted: (orderId: string) => void;
}

export function CartDrawer({
  open,
  onClose,
  tableId,
  customerSessionId,
  customerId,
  onOrderSubmitted,
}: CartDrawerProps) {
  const { lines, updateQuantity, removeItem, totalAmount, totalItems, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await submitOrder({
      tableId,
      customerSessionId,
      customerId: customerId ?? undefined,
      items: lines.map((l) => ({
        menuItemId: l.item.id,
        quantity: l.quantity,
        notes: l.notes || undefined,
        unitPrice: l.item.price,
      })),
    });

    setSubmitting(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "Could not submit order");
      return;
    }

    clear();
    onOrderSubmitted(result.data.orderId);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/50 sm:rounded-[2rem]">
      <div className="flex max-h-[85%] flex-col rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            Your Order {totalItems > 0 && <span className="text-neutral-400">({totalItems})</span>}
          </h2>
          <button onClick={onClose} className="text-sm text-neutral-400">
            Close
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="mt-8 text-center text-sm text-neutral-400">
            Your cart is empty
          </p>
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto">
            {lines.map((line) => (
              <div
                key={`${line.item.id}-${line.notes}`}
                className="flex items-center gap-3 border-b border-neutral-100 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">
                    {line.item.name}
                  </p>
                  {line.notes && (
                    <p className="truncate text-xs text-neutral-400">{line.notes}</p>
                  )}
                  <p className="text-sm text-neutral-500">
                    {formatCurrency(line.item.price * line.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-neutral-300 px-2 py-1">
                  <button
                    onClick={() =>
                      updateQuantity(line.item.id, line.quantity - 1)
                    }
                    className="flex h-6 w-6 items-center justify-center font-semibold text-neutral-700"
                    aria-label={`Decrease ${line.item.name} quantity`}
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm">{line.quantity}</span>
                  <button
                    onClick={() =>
                      updateQuantity(line.item.id, line.quantity + 1)
                    }
                    className="flex h-6 w-6 items-center justify-center font-semibold text-neutral-700"
                    aria-label={`Increase ${line.item.name} quantity`}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(line.item.id)}
                  aria-label={`Remove ${line.item.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between font-semibold text-neutral-900">
          <span>Total</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={lines.length === 0 || submitting}
          className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit to Kitchen"}
        </button>
      </div>
    </div>
  );
}
