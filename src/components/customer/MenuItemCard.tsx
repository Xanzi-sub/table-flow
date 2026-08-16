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
  const { addItem, getItemOffer } = useCart();
  const offer = getItemOffer(item);

  function handleQuickAdd(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    addItem(item, 1, "");
  }

  return (
    <article
      className="group flex min-h-[100px] w-full cursor-pointer gap-3 border-b border-neutral-100 py-2.5 text-left transition-opacity last:border-b-0 active:opacity-75 sm:gap-4 sm:py-3"
      onClick={() => onSelect(item)}
    >
      {/* Food image */}
      <div className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[14px] bg-[#f1eee9] sm:h-[92px] sm:w-[92px]">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 639px) 82px, 92px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <PlateIcon className="h-7 w-7" />
          </div>
        )}
      </div>

      {/* Information */}
      <div className="min-w-0 flex-1">
        {offer && (
          <span className="mb-1 inline-flex max-w-full truncate rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-amber-800">
            {offer.discountType === "quantity_deal"
              ? `${offer.specialName} · Buy ${offer.buyQuantity}, pay ${offer.payQuantity}`
              : offer.discountType === "fixed_price"
                ? `${offer.specialName} · ${offer.applicableQuantity} for ${formatCurrency(offer.unitPrice)}`
                : `${offer.specialName} · From ${offer.applicableQuantity}`}
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 pr-1 text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#171614] sm:text-[15px]">
            {item.name}
          </h3>
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-1 max-w-[270px] text-[11px] leading-[1.35] text-[#77736d] sm:line-clamp-2 sm:text-[12px]">
            {item.description}
          </p>
        )}

        <div className="mt-1.5 flex items-end justify-between gap-2 sm:mt-2">
          <span>
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[#171614] sm:text-[14px]">
              {formatCurrency(offer?.unitPrice ?? item.price)}
            </span>
            {offer && offer.discountType === "percentage" && (
              <span className="ml-2 text-[11px] text-[#aaa49b] line-through">{formatCurrency(item.price)}</span>
            )}
          </span>

          <button
            type="button"
            aria-label={`Add ${item.name} to your order`}
            onClick={handleQuickAdd}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-500)] text-white shadow-[0_3px_10px_rgba(23,76,58,0.18)] transition-all duration-200 hover:scale-105 hover:bg-[var(--accent-600)] active:scale-90 sm:h-9 sm:w-9"
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