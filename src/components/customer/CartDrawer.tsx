"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import { submitOrder } from "@/app/actions/orders";
import { TrashIcon } from "./Icon";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  customerSessionId: string;
  customerId: string | null;
  loyaltyPoints: number;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  onPointsChanged: (points: number) => void;
  onOrderSubmitted: (orderId: string) => void;
}

export function CartDrawer({
  open,
  onClose,
  tableId,
  customerSessionId,
  customerId,
  loyaltyPoints,
  loyaltyRewardThreshold,
  loyaltyRewardValue,
  onPointsChanged,
  onOrderSubmitted,
}: CartDrawerProps) {
  const {
    lines,
    updateQuantity,
    removeItem,
    totalAmount,
    totalItems,
    getLineTotal,
    clear,
  } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyLoyalty, setApplyLoyalty] = useState(false);
  const requestId = useRef<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await submitOrder({
      requestId: requestId.current,
        tableId,
        customerSessionId,
        customerId: customerId ?? undefined,
        items: lines.map((l) => ({
          kind: l.kind,
          menuItemId: l.kind === "item" ? l.item.id : undefined,
          specialId: l.specialId,
          quantity: l.quantity,
          notes: l.notes || undefined,
        })),
        loyaltyPointsToUse: applyLoyalty ? redeemablePoints : 0,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? "Could not place your order");
        return;
      }

      clear();
      requestId.current = null;
      if (result.data.loyaltyPointsRedeemed > 0) {
        onPointsChanged(Math.max(0, loyaltyPoints - result.data.loyaltyPointsRedeemed));
      }
      onOrderSubmitted(result.data.orderId);
    } catch {
      setError("The order request was interrupted. Please check your orders before trying again.");
    } finally {
      setSubmitting(false);
    }
  }

  const regularAmount = lines.reduce((sum, line) => {
    const regularUnit =
      line.kind === "combo"
        ? (line.comboItems ?? []).reduce((itemSum, item) => itemSum + item.price, 0)
        : line.item.price;
    return sum + regularUnit * line.quantity;
  }, 0);
  const savings = Math.max(0, regularAmount - totalAmount);
  const availableRewardUnits =
    loyaltyRewardThreshold > 0 ? Math.floor(loyaltyPoints / loyaltyRewardThreshold) : 0;
  const usableRewardUnits =
    loyaltyRewardValue > 0 ? Math.min(availableRewardUnits, Math.floor(totalAmount / loyaltyRewardValue)) : 0;
  const redeemablePoints = usableRewardUnits * loyaltyRewardThreshold;
  const loyaltyDiscount = applyLoyalty ? usableRewardUnits * loyaltyRewardValue : 0;
  const finalAmount = Math.max(0, totalAmount - loyaltyDiscount);

  return (
    <div className="fixed inset-0 z-50 h-dvh overflow-hidden bg-[#171614]/60 backdrop-blur-[5px]">
      <div className="flex h-full min-h-0 items-end justify-center sm:items-center sm:p-6">
        <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#faf9f7] shadow-[0_-20px_70px_rgba(0,0,0,0.2)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[540px] sm:rounded-[30px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e7e2da] px-5 py-5 sm:px-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#99938a]">
                Ready when you are
              </p>

              <h2 className="mt-1 text-[23px] font-semibold tracking-[-0.03em] text-[#171614]">
                Your order
                {totalItems > 0 && (
                  <span className="ml-2 text-[14px] font-medium text-[#99938a]">
                    {totalItems} {totalItems === 1 ? "item" : "items"}
                  </span>
                )}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close your order"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eeeae4] text-[#5f5a53] transition hover:bg-[#e4dfd7] active:scale-95"
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

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eeeae4] text-[#858078]">
                <svg
                  width="27"
                  height="27"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 8h12l-1 12H7L6 8Z" />
                  <path d="M9 8a3 3 0 0 1 6 0" />
                </svg>
              </div>

              <h3 className="mt-5 text-[17px] font-semibold text-[#171614]">
                Your order is empty
              </h3>

              <p className="mt-2 max-w-[270px] text-[13px] leading-relaxed text-[#8a847b]">
                Browse the menu and add something delicious.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-full bg-[var(--accent-500)] px-6 py-3 text-[13px] font-semibold text-white"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <>
              {/* Items */}
              <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 sm:px-7">
                <div className="divide-y divide-[#e7e2da]">
                  {lines.map((line) => (
                    <div
                      key={line.lineId}
                      className="flex gap-3.5 py-5"
                    >
                      {/* Image */}
                      <div className="relative h-[66px] w-[66px] shrink-0 overflow-hidden rounded-[13px] bg-[#eeeae4]">
                        {line.item.image_url ? (
                          <Image
                            src={line.item.image_url}
                            alt={line.item.name}
                            fill
                            sizes="66px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#c2bbb1]">
                            <svg
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="8" />
                              <path d="M8 12h8" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Item */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#171614]">
                              {line.specialName ?? line.item.name}
                            </p>

                            {line.specialName && (
                              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                                {line.kind === "combo"
                                  ? "Paired combo"
                                  : line.specialDiscountType === "quantity_deal"
                                    ? `Buy ${line.buyQuantity}, pay ${line.payQuantity}`
                                    : line.specialDiscountType === "fixed_price"
                                      ? `${line.applicableQuantity} for ${formatCurrency(line.unitPrice)}`
                                      : `Discount from quantity ${line.applicableQuantity}`}
                              </p>
                            )}

                            {line.kind === "combo" && line.comboItems && (
                              <p className="mt-1 line-clamp-2 text-[11px] text-[#99938a]">
                                {line.comboItems.map((item) => item.name).join(" + ")}
                              </p>
                            )}

                            {line.notes && (
                              <p className="mt-1 truncate text-[11px] text-[#99938a]">
                                {line.notes}
                              </p>
                            )}
                          </div>

                          <p className="shrink-0 text-[14px] font-semibold text-[#171614]">
                            {formatCurrency(
                              getLineTotal(line)
                            )}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex h-8 items-center rounded-full border border-[#d9d4cc] bg-white px-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  line.lineId,
                                  line.quantity - 1
                                )
                              }
                              aria-label={`Decrease ${line.item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] text-[#55514b] hover:bg-[#f1ede7] active:scale-90"
                            >
                              −
                            </button>

                            <span className="w-7 text-center text-[12px] font-semibold text-[#171614]">
                              {line.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  line.lineId,
                                  line.quantity + 1
                                )
                              }
                              aria-label={`Increase ${line.item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] text-[#55514b] hover:bg-[#f1ede7] active:scale-90"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(line.lineId)}
                            aria-label={`Remove ${line.specialName ?? line.item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#aaa49b] transition hover:bg-red-50 hover:text-red-500"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom summary */}
              <div className="shrink-0 border-t border-[#e7e2da] bg-[#faf9f7] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 sm:px-7">
                {error && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-[13px] bg-red-50 px-3.5 py-3 text-[12px] leading-relaxed text-red-700">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                    </svg>

                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[13px] text-[#77736d]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(regularAmount)}</span>
                </div>

                {savings > 0 && (
                  <div className="mt-2 flex items-center justify-between text-[13px] font-semibold text-emerald-700">
                    <span>Special savings</span>
                    <span>−{formatCurrency(savings)}</span>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[13px] text-[#77736d]">
                  <span>VAT</span>
                  <span className="text-[#99938a]">Included</span>
                </div>

                <label className={`mt-3 flex items-center justify-between gap-3 rounded-[13px] border p-3 ${
                  usableRewardUnits > 0 ? "cursor-pointer border-[#d9d4cc] bg-white" : "border-[#e7e2da] bg-[#f3f0eb] opacity-60"
                }`}>
                  <span>
                    <span className="block text-[12px] font-semibold text-[#171614]">Apply loyalty reward</span>
                    <span className="mt-0.5 block text-[10px] text-[#99938a]">
                      {usableRewardUnits > 0
                        ? `Use ${redeemablePoints} points for ${formatCurrency(usableRewardUnits * loyaltyRewardValue)} off`
                        : `${loyaltyPoints} points · ${loyaltyRewardThreshold} needed per reward`}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={applyLoyalty}
                    disabled={usableRewardUnits === 0}
                    onChange={(event) => setApplyLoyalty(event.target.checked)}
                  />
                </label>

                {loyaltyDiscount > 0 && (
                  <div className="mt-2 flex items-center justify-between text-[13px] font-semibold text-emerald-700">
                    <span>Loyalty reward</span>
                    <span>−{formatCurrency(loyaltyDiscount)}</span>
                  </div>
                )}

                <div className="mt-4 flex items-end justify-between border-t border-[#e7e2da] pt-4">
                  <span className="text-[14px] font-semibold text-[#171614]">
                    Total
                  </span>

                  <span className="text-[22px] font-semibold tracking-[-0.03em] text-[#171614]">
                    {formatCurrency(finalAmount)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="mt-4 flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-500)] text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(23,76,58,0.18)] transition hover:bg-[var(--accent-600)] active:scale-[0.985] disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="opacity-30"
                        />
                        <path
                          d="M21 12a9 9 0 0 1-9 9"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Placing order…
                    </>
                  ) : (
                    <>
                      Place order
                      <span className="text-white/50">·</span>
                      {formatCurrency(finalAmount)}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}