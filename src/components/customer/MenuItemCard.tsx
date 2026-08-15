"use client";

import Image from "next/image";
import type { MenuItem } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { PlateIcon } from "./Icon";

export function MenuItemCard({
  item,
  onSelect,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}) {
  const { addItem } = useCart();

  return (
    <button
      onClick={() => onSelect(item)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-shadow active:scale-[0.99] active:shadow-none"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-neutral-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <PlateIcon className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-neutral-900">{item.name}</p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-neutral-500">
            {item.description}
          </p>
        )}
        <p className="mt-1.5 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-900">
          {formatCurrency(item.price)}
        </p>
      </div>
      <span
        role="button"
        aria-label={`Quick add ${item.name}`}
        onClick={(e) => {
          e.stopPropagation();
          addItem(item, 1, "");
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white shadow-sm transition-transform active:scale-90"
      >
        +
      </span>
    </button>
  );
}
