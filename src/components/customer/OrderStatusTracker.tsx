"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/types/database";
import { requestTableService } from "@/app/actions/orders";
import { formatCurrency, formatDateTime, formatStaffName } from "@/lib/utils";
import { OrderFeedbackForm } from "./OrderFeedbackForm";

const STEPS: OrderStatus[] = ["pending", "preparing", "served", "completed"];
const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  specialName: string | null;
  bundleId: string | null;
}

// Receipt is drawn at 3x this logical width then downscaled via CSS, so it
// stays crisp on high-DPI phone screens instead of looking soft/blurry.
const RECEIPT_WIDTH = 380;
const SCALE = 3;

/** Draws a proper itemized receipt: subtotal, VAT breakdown, suggested tip, waiter, payment status. */
function drawReceipt(
  canvas: HTMLCanvasElement,
  venueName: string,
  tableNumber: number | null,
  waiterName: string | null,
  vatPercentage: number,
  tipPercentage: number,
  order: Order,
  lines: ReceiptLine[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const lineHeight = 22;
  const bundleCount = new Set(lines.map((line) => line.bundleId).filter(Boolean)).size;
  const height = 400 + lines.length * lineHeight + bundleCount * 18;

  canvas.width = RECEIPT_WIDTH * SCALE;
  canvas.height = height * SCALE;
  canvas.style.width = `${RECEIPT_WIDTH}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(SCALE, SCALE);

  const ink = "#14161d";
  const muted = "#6b7385";
  const border = "#dfe2e8";
  const dashed = () => {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(RECEIPT_WIDTH - 20, y);
    ctx.stroke();
    ctx.restore();
  };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, height);
  ctx.strokeStyle = border;
  ctx.strokeRect(0.5, 0.5, RECEIPT_WIDTH - 1, height - 1);

  let y = 36;
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(venueName || "TableFlow", RECEIPT_WIDTH / 2, y);

  y += 20;
  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = muted;
  ctx.fillText(
    `Order #${order.id.slice(0, 8).toUpperCase()}${tableNumber ? ` · Table ${tableNumber}` : ""}`,
    RECEIPT_WIDTH / 2,
    y
  );
  y += 16;
  ctx.fillText(formatDateTime(order.created_at), RECEIPT_WIDTH / 2, y);
  if (waiterName) {
    y += 16;
    ctx.fillText(`Served by ${formatStaffName(waiterName, "Restaurant team")}`, RECEIPT_WIDTH / 2, y);
  }

  y += 18;
  dashed();
  y += 24;

  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  const shownBundles = new Set<string>();
  for (const line of lines) {
    if (line.bundleId && line.specialName && !shownBundles.has(line.bundleId)) {
      ctx.textAlign = "left";
      ctx.fillStyle = muted;
      ctx.font = "700 10px system-ui, -apple-system, sans-serif";
      ctx.fillText(line.specialName.toUpperCase(), 20, y);
      y += 18;
      shownBundles.add(line.bundleId);
      ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    }
    const label = `${line.quantity}x ${line.name}${!line.bundleId && line.specialName ? ` · ${line.specialName}` : ""}`;
    const price = formatCurrency(line.unitPrice * line.quantity);
    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    ctx.fillText(label, 20, y, RECEIPT_WIDTH - 110);
    ctx.textAlign = "right";
    ctx.fillStyle = muted;
    ctx.fillText(price, RECEIPT_WIDTH - 20, y);
    y += lineHeight;
  }

  y += 4;
  dashed();
  y += 22;

  const vatAmount = order.total_amount - order.total_amount / (1 + vatPercentage / 100);
  const subtotal = order.total_amount - vatAmount;
  const suggestedTip = order.total_amount * (tipPercentage / 100);

  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  const row = (label: string, value: string, boldValue = false) => {
    ctx.textAlign = "left";
    ctx.fillStyle = muted;
    ctx.fillText(label, 20, y);
    ctx.textAlign = "right";
    ctx.fillStyle = boldValue ? ink : muted;
    ctx.font = boldValue ? "700 11px system-ui, -apple-system, sans-serif" : "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText(value, RECEIPT_WIDTH - 20, y);
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    y += 18;
  };

  row("Subtotal", formatCurrency(subtotal));
  row(`VAT (${vatPercentage}%, incl.)`, formatCurrency(vatAmount));
  y += 6;
  dashed();
  y += 22;

  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
  ctx.fillText("Total", 20, y);
  ctx.textAlign = "right";
  ctx.fillText(formatCurrency(order.total_amount), RECEIPT_WIDTH - 20, y);
  y += 24;

  if (tipPercentage > 0) {
    row(`Suggested tip (${tipPercentage}%)`, formatCurrency(suggestedTip));
  }
  row("Payment method", order.payment_method ? order.payment_method.replace("_", " ") : "—");
  row("Payment status", order.payment_status === "paid" ? "Paid" : "Unpaid");

  y += 6;
  dashed();
  y += 24;

  ctx.textAlign = "center";
  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = muted;
  ctx.fillText("Thank you for your order!", RECEIPT_WIDTH / 2, y);
}

export function OrderStatusTracker({
  orderId,
  tableId,
  venueName,
  tableNumber,
  vatPercentage,
  tipPercentage,
  waiterName,
  customerId,
  loyaltyPoints,
  loyaltyRewardThreshold,
  loyaltyRewardValue,
  onPointsChanged,
  onClose,
}: {
  orderId: string;
  tableId: string;
  venueName: string;
  tableNumber: number | null;
  vatPercentage: number;
  tipPercentage: number;
  waiterName: string | null;
  customerId: string | null;
  loyaltyPoints: number;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  onPointsChanged: (points: number) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [requesting, setRequesting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadOrder() {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (active && data) setOrder(data);
    }

    void loadOrder();
    supabase
      .from("order_items")
      .select("quantity, unit_price, special_name, bundle_id, menu_items(name)")
      .eq("order_id", orderId)
      .then(({ data }) => {
        if (!active) return;
        type Row = {
          quantity: number;
          unit_price: number;
          special_name: string | null;
          bundle_id: string | null;
          menu_items: { name: string } | { name: string }[] | null;
        };
        const rows = (data ?? []) as Row[];
        setLines(
          rows.map((row) => ({
            name: Array.isArray(row.menu_items) ? row.menu_items[0]?.name ?? "Item" : row.menu_items?.name ?? "Item",
            quantity: row.quantity,
            unitPrice: row.unit_price,
            specialName: row.special_name,
            bundleId: row.bundle_id,
          }))
        );
      });

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => setOrder(payload.new as Order)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void loadOrder();
      });

    const fallback = window.setInterval(loadOrder, 3000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadOrder();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(fallback);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    if (order && lines.length > 0 && canvasRef.current) {
      drawReceipt(canvasRef.current, venueName, tableNumber, waiterName, vatPercentage, tipPercentage, order, lines);
    }
  }, [order, lines, venueName, tableNumber, waiterName, vatPercentage, tipPercentage]);

  const activeIndex = order ? STEPS.indexOf(order.status) : 0;
  const loyaltyProgress = loyaltyRewardThreshold > 0
    ? Math.min(100, Math.round((loyaltyPoints / loyaltyRewardThreshold) * 100))
    : 0;
  const requested = requesting;

  useEffect(() => {
    if (order?.payment_status === "paid") setRequesting(false);
  }, [order?.payment_status]);

  async function handleRequest() {
    setRequesting(true);
    await requestTableService(tableId);
  }

  useEffect(() => {
    if (!customerId || order?.payment_status !== "paid") return;
    const supabase = createClient();
    supabase
      .from("customer_profiles")
      .select("loyalty_points")
      .eq("id", customerId)
      .single()
      .then(({ data }) => {
        if (data) onPointsChanged(data.loyalty_points);
      });
  }, [customerId, order?.payment_status, onPointsChanged]);

  function handleDownloadReceipt() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${orderId.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-40 h-dvh overflow-hidden bg-[#171614]/60 backdrop-blur-[5px]">
      <div className="flex h-full min-h-0 items-end justify-center sm:items-center sm:p-6">
        <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#faf9f7] shadow-[0_-20px_70px_rgba(0,0,0,0.2)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[480px] sm:rounded-[30px]">
          <div className="flex items-center justify-between border-b border-[#e7e2da] px-5 py-5 sm:px-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#99938a]">
                Order #{orderId.slice(0, 8).toUpperCase()}
              </p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#171614]">Order Status</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eeeae4] text-[#5f5a53] transition hover:bg-[#e4dfd7] active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            <div className="flex items-start justify-between">
              {STEPS.filter((s) => s !== "cancelled").map((step, i) => (
                <div key={step} className="relative flex flex-1 flex-col items-center">
                  {i > 0 && (
                    <div
                      className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                        i <= activeIndex ? "bg-emerald-500" : "bg-[#e7e2da]"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      i < activeIndex
                        ? "bg-emerald-500 text-white"
                        : i === activeIndex
                        ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                        : "bg-[#eeeae4] text-[#99938a]"
                    }`}
                  >
                    {i < activeIndex ? "✓" : i + 1}
                  </div>
                  <p className="mt-2 text-center text-[11px] font-medium text-[#77736d]">
                    {LABELS[step]}
                  </p>
                </div>
              ))}
            </div>

            {order && (
              <div className="mt-6 flex items-center justify-between rounded-[16px] bg-[#eeeae4] px-4 py-3">
                <span className="text-[13px] font-medium text-[#77736d]">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-[#171614]">
                    {formatCurrency(order.total_amount)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      order.payment_status === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {order.payment_status === "paid" ? "Paid ✓" : "Unpaid"}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-[16px] border border-[#e7e2da] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#99938a]">
                    Loyalty wallet
                  </p>
                  <p className="mt-1 text-[18px] font-bold text-[#171614]">{loyaltyPoints} points</p>
                </div>
                <span className="rounded-full bg-[#eeeae4] px-3 py-1 text-[11px] font-semibold text-[#5f5a53]">
                  {loyaltyPoints >= loyaltyRewardThreshold
                    ? `${formatCurrency(loyaltyRewardValue)} reward ready`
                    : `${Math.max(0, loyaltyRewardThreshold - loyaltyPoints)} to reward`}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eeeae4]">
                <div
                  className="h-full rounded-full bg-[#171614] transition-[width] duration-500"
                  style={{ width: `${loyaltyProgress}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-[#99938a]">
                {loyaltyRewardThreshold} points unlocks a {formatCurrency(loyaltyRewardValue)} reward.
              </p>
            </div>

            {order?.status === "completed" && customerId && (
              <OrderFeedbackForm
                orderId={order.id}
              />
            )}

            {order && lines.length > 0 && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[16px] border border-[#e7e2da] bg-white p-4">
                <canvas ref={canvasRef} className="w-full max-w-[300px] rounded-lg" />
                <button
                  onClick={handleDownloadReceipt}
                  className="w-full rounded-[13px] border border-[#171614] py-2.5 text-[13px] font-semibold text-[#171614] transition active:scale-[0.99]"
                >
                  Download Receipt
                </button>
              </div>
            )}

            <button
              onClick={handleRequest}
              disabled={requested}
              className="mt-4 w-full rounded-[13px] bg-[#171614] py-3 text-[13px] font-semibold text-white transition-all hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requested ? "Waiter has been notified ✓" : "Request Waiter / Speedpoint"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

