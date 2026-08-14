"use client";

import { useState } from "react";
import Image from "next/image";
import type { MenuItem } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export function ItemDetailModal({
  item,
  onClose,
}: {
  item: MenuItem;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  function handleAdd() {
    addItem(item, quantity, notes.trim());
    onClose();
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/50 sm:rounded-[2rem]">
      <div className="max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="relative mb-4 h-40 w-full overflow-hidden rounded-2xl bg-neutral-100">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">
              🍽️
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-neutral-900">{item.name}</h2>
        {item.description && (
          <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
        )}
        <p className="mt-2 text-base font-semibold text-neutral-900">
          {formatCurrency(item.price)}
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note (e.g. no onions)"
          rows={2}
          className="mt-4 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-full border border-neutral-300 px-3 py-1.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="text-lg font-semibold text-neutral-700"
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="text-lg font-semibold text-neutral-700"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
          >
            Add · {formatCurrency(item.price * quantity)}
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-neutral-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
