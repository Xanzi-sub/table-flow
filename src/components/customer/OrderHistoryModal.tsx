"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/database";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  preparing: "bg-blue-100 text-blue-700",
  served: "bg-emerald-100 text-emerald-700",
  completed: "bg-[#eeeae4] text-[#77736d]",
  cancelled: "bg-red-100 text-red-700",
};

export function OrderHistoryModal({
  orderIds,
  onSelectOrder,
  onClose,
}: {
  orderIds: string[];
  onSelectOrder: (orderId: string) => void;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("orders")
      .select("*")
      .in("id", orderIds)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
  }, [orderIds]);

  return (
    <div className="fixed inset-0 z-40 h-dvh overflow-hidden bg-[#171614]/60 backdrop-blur-[5px]">
      <div className="flex h-full min-h-0 items-end justify-center sm:items-center sm:p-6">
        <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#faf9f7] shadow-[0_-20px_70px_rgba(0,0,0,0.2)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[480px] sm:rounded-[30px]">
          <div className="flex items-center justify-between border-b border-[#e7e2da] px-5 py-5 sm:px-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#99938a]">
                This visit
              </p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#171614]">
                Your Orders
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close your orders"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eeeae4] text-[#5f5a53] transition hover:bg-[#e4dfd7] active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-2.5">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className="flex items-center justify-between rounded-[16px] border border-[#e7e2da] bg-white p-3.5 text-left transition active:bg-[#f5f2ee]"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[#171614]">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#99938a]">{formatDateTime(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#171614]">
                      {formatCurrency(order.total_amount)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                </button>
              ))}
              {orders.length === 0 && (
                <p className="py-6 text-center text-[13px] text-[#99938a]">Loading…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
