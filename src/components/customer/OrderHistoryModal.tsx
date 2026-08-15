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
  completed: "bg-neutral-200 text-neutral-600",
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
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50 sm:rounded-[2rem]">
      <div className="max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">Your Orders</h2>
          <button onClick={onClose} className="text-sm text-neutral-400">
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-left active:bg-neutral-50"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-neutral-400">{formatDateTime(order.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">
                  {formatCurrency(order.total_amount)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
            </button>
          ))}
          {orders.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
