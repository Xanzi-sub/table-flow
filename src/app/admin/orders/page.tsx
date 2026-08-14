import { listOrderHistory } from "@/app/actions/orders";
import { listStaff } from "@/app/actions/staff";
import { OrderHistoryManager } from "@/components/admin/OrderHistoryManager";

export default async function AdminOrdersPage() {
  const [orders, staff] = await Promise.all([listOrderHistory(), listStaff()]);
  const waiters = staff.filter((s) => s.role === "waiter" || s.role === "manager" || s.role === "admin");

  return (
    <OrderHistoryManager
      initialOrders={orders as Parameters<typeof OrderHistoryManager>[0]["initialOrders"]}
      waiters={waiters.map((w) => ({ id: w.id, full_name: w.full_name }))}
    />
  );
}
