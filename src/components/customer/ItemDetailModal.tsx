"use client";

import { useState } from "react";
import Image from "next/image";
import type { MenuItem } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { calculateItemOfferTotal, useCart } from "@/context/CartContext";
import { PlateIcon } from "./Icon";

export function ItemDetailModal({
  item,
  recommendations,
  onClose,
}: {
  item: MenuItem;
  recommendations: MenuItem[];
  onClose: () => void;
}) {
  const { addItem, getItemOffer } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  function handleAdd() {
    addItem(item, quantity, notes.trim());
    onClose();
  }

  const offer = getItemOffer(item);
  const effectivePrice =
    offer?.discountType === "percentage" && quantity >= offer.applicableQuantity
      ? offer.unitPrice
      : item.price;
  const total = calculateItemOfferTotal(item, offer, quantity);

  return (
    <div className="fixed inset-0 z-50 h-dvh overflow-hidden bg-[#171614]/60 backdrop-blur-[5px]">
      <div className="flex h-full min-h-0 items-end justify-center sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-detail-title"
          className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#faf9f7] shadow-[0_-20px_70px_rgba(0,0,0,0.2)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[520px] sm:rounded-[30px]"
        >
          {/* Image */}
          <div className="relative h-[260px] shrink-0 bg-[#eeeae4] sm:h-[300px]">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, 520px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#c5beb4]">
                <PlateIcon className="h-14 w-14" />
              </div>
            )}

            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#faf9f7] to-transparent" />

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close item"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/60 active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-4 sm:px-7 sm:pb-5">
            <div className="relative">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <h2
                    id="item-detail-title"
                    className="text-[25px] font-semibold leading-tight tracking-[-0.035em] text-[#171614]"
                  >
                    {item.name}
                  </h2>

                  {item.description && (
                    <p className="mt-2 text-[14px] leading-[1.55] text-[#77736d]">
                      {item.description}
                    </p>
                  )}
                </div>

                <span className="shrink-0 pt-1 text-[15px] font-semibold text-[#171614]">
                  {formatCurrency(effectivePrice)}
                  {offer && (
                    <span className="ml-2 text-[11px] font-normal text-[#aaa49b] line-through">{formatCurrency(item.price)}</span>
                  )}
                </span>
              </div>

              {offer && (
                <div className="mt-3 rounded-[13px] bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                  {offer.discountType === "quantity_deal"
                    ? `${offer.specialName}: buy ${offer.buyQuantity}, pay for ${offer.payQuantity}`
                    : offer.discountType === "fixed_price"
                      ? `${offer.specialName}: ${offer.applicableQuantity} for ${formatCurrency(offer.unitPrice)}`
                      : `${offer.specialName}: ${offer.unitPrice < item.price ? `${formatCurrency(offer.unitPrice)} each` : "discount"} from quantity ${offer.applicableQuantity}`}
                </div>
              )}

              {/* Notes */}
              <div className="mt-7">
                <label
                  htmlFor="item-notes"
                  className="text-[12px] font-semibold text-[#45413c]"
                >
                  Special instructions
                  <span className="ml-1 font-normal text-[#aaa49b]">
                    Optional
                  </span>
                </label>

                <textarea
                  id="item-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. no onions, extra sauce..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-[15px] border border-[#ddd8d0] bg-white px-4 py-3 text-[14px] leading-relaxed text-[#171614] outline-none transition placeholder:text-[#aaa49b] focus:border-[#171614] focus:ring-4 focus:ring-black/[0.04]"
                />
              </div>

              {recommendations.length > 0 && (
                <div className="mt-7 border-t border-[#e7e2da] pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#99938a]">
                    Goes well with this
                  </p>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {recommendations.map((recommendation) => (
                      <button
                        key={recommendation.id}
                        type="button"
                        onClick={() => addItem(recommendation, 1, "")}
                        className="flex min-w-[180px] items-center justify-between gap-3 rounded-[14px] border border-[#e7e2da] bg-white p-3 text-left transition active:scale-[0.98]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-[#171614]">
                            {recommendation.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#77736d]">
                            {formatCurrency(recommendation.price)}
                          </span>
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-500)] text-base text-white">
                          +
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-[#aaa49b]">
                    Suggested from items guests at this venue actually order together.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom action */}
          <div className="shrink-0 border-t border-[#e7e2da] bg-[#faf9f7] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-[max(20px,env(safe-area-inset-bottom))] sm:pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-[50px] items-center rounded-full border border-[#d9d4cc] bg-white px-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-[#45413c] transition hover:bg-[#f2eee8] active:scale-90"
                >
                  −
                </button>

                <span className="w-8 text-center text-[14px] font-semibold text-[#171614]">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-[#45413c] transition hover:bg-[#f2eee8] active:scale-90"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent-500)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(23,76,58,0.18)] transition hover:bg-[var(--accent-600)] active:scale-[0.985]"
              >
                Add to order
                <span className="text-white/60">·</span>
                {formatCurrency(total)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}