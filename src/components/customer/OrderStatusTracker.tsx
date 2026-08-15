"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/types/database";
import { requestTableService } from "@/app/actions/orders";
import { formatCurrency, formatDateTime } from "@/lib/utils";

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
}

const RECEIPT_WIDTH = 480;

/** Draws a plain, printable receipt (venue, order #, itemized lines, total) as a PNG. */
function drawReceipt(
  canvas: HTMLCanvasElement,
  venueName: string,
  tableNumber: number | null,
  order: Order,
  lines: ReceiptLine[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const lineHeight = 26;
  const height = 260 + lines.length * lineHeight;
  canvas.width = RECEIPT_WIDTH;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, RECEIPT_WIDTH, height);
  ctx.strokeStyle = "#dfe2e8";
  ctx.strokeRect(1, 1, RECEIPT_WIDTH - 2, height - 2);

  ctx.textAlign = "center";
  ctx.fillStyle = "#14161d";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(venueName || "TableFlow", RECEIPT_WIDTH / 2, 50);

  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#6b7385";
  ctx.fillText(
    `Order #${order.id.slice(0, 8).toUpperCase()}${tableNumber ? ` · Table ${tableNumber}` : ""}`,
    RECEIPT_WIDTH / 2,
    76
  );
  ctx.fillText(formatDateTime(order.created_at), RECEIPT_WIDTH / 2, 96);

  ctx.beginPath();
  ctx.moveTo(30, 116);
  ctx.lineTo(RECEIPT_WIDTH - 30, 116);
  ctx.strokeStyle = "#dfe2e8";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#14161d";
  ctx.font = "600 15px system-ui, -apple-system, sans-serif";
  let y = 148;
  for (const line of lines) {
    const label = `${line.quantity}x ${line.name}`;
    const price = formatCurrency(line.unitPrice * line.quantity);
    ctx.textAlign = "left";
    ctx.fillText(label, 30, y, RECEIPT_WIDTH - 140);
    ctx.textAlign = "right";
    ctx.fillText(price, RECEIPT_WIDTH - 30, y);
    y += lineHeight;
  }

  ctx.beginPath();
  ctx.moveTo(30, y + 6);
  ctx.lineTo(RECEIPT_WIDTH - 30, y + 6);
  ctx.strokeStyle = "#dfe2e8";
  ctx.stroke();

  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Total", 30, y + 40);
  ctx.textAlign = "right";
  ctx.fillText(formatCurrency(order.total_amount), RECEIPT_WIDTH - 30, y + 40);

  ctx.textAlign = "center";
  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#6b7385";
  ctx.fillText("Thank you for your order!", RECEIPT_WIDTH / 2, y + 80);
}

export function OrderStatusTracker({
  orderId,
  tableId,
  venueName,
  tableNumber,
  onClose,
}: {
  orderId: string;
  tableId: string;
  venueName: string;
  tableNumber: number | null;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [requested, setRequested] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()
      .then(({ data }) => data && setOrder(data));

    supabase
      .from("order_items")
      .select("quantity, unit_price, menu_items(name)")
      .eq("order_id", orderId)
      .then(({ data }) => {
        type Row = { quantity: number; unit_price: number; menu_items: { name: string } | { name: string }[] | null };
        const rows = (data ?? []) as Row[];
        setLines(
          rows.map((row) => ({
            name: Array.isArray(row.menu_items) ? row.menu_items[0]?.name ?? "Item" : row.menu_items?.name ?? "Item",
            quantity: row.quantity,
            unitPrice: row.unit_price,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    if (order && lines.length > 0 && canvasRef.current) {
      drawReceipt(canvasRef.current, venueName, tableNumber, order, lines);
    }
  }, [order, lines, venueName, tableNumber]);

  const activeIndex = order ? STEPS.indexOf(order.status) : 0;

  async function handleRequest() {
    setRequested(true);
    await requestTableService(tableId);
  }

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
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50 sm:rounded-[2rem]">
      <div className="max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Order Status</h2>
            <p className="text-xs text-neutral-400">
              Order #{orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex items-start justify-between">
          {STEPS.filter((s) => s !== "cancelled").map((step, i) => (
            <div key={step} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <div
                  className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                    i <= activeIndex ? "bg-emerald-500" : "bg-neutral-200"
                  }`}
                />
              )}
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i < activeIndex
                    ? "bg-emerald-500 text-white"
                    : i === activeIndex
                    ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                    : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {i < activeIndex ? "✓" : i + 1}
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-neutral-500">
                {LABELS[step]}
              </p>
            </div>
          ))}
        </div>

        {order && (
          <div className="mt-6 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
            <span className="text-sm font-medium text-neutral-500">Total</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-neutral-900">
                {formatCurrency(order.total_amount)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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

        {order && lines.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 p-4">
            <canvas ref={canvasRef} className="w-full max-w-[260px] rounded-lg" />
            <button
              onClick={handleDownloadReceipt}
              className="w-full rounded-xl border border-neutral-900 py-2.5 text-sm font-semibold text-neutral-900"
            >
              Download Receipt
            </button>
          </div>
        )}

        <button
          onClick={handleRequest}
          disabled={requested}
          className="mt-4 w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {requested ? "Waiter has been notified ✓" : "Request Waiter / Speedpoint"}
        </button>
      </div>
    </div>
  );
}
