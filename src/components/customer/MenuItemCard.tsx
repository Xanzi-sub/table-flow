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

  function handleQuickAdd(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    addItem(item, 1, "");
  }

  return (
    <article
      className="group flex w-full cursor-pointer gap-4 py-5 text-left transition-opacity active:opacity-75"
      onClick={() => onSelect(item)}
    >
      {/* Food image */}
      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[18px] bg-[#f1eee9]">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="104px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <PlateIcon className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* Information */}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="pr-2 text-[15px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#171614]">
            {item.name}
          </h3>
        </div>

        {item.description && (
          <p className="mt-1.5 line-clamp-2 max-w-[270px] text-[13px] leading-[1.45] text-[#77736d]">
            {item.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#171614]">
            {formatCurrency(item.price)}
          </span>

          <button
            type="button"
            aria-label={`Add ${item.name} to your order`}
            onClick={handleQuickAdd}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#171614] text-white shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition-all duration-200 hover:scale-105 hover:bg-black active:scale-90"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}