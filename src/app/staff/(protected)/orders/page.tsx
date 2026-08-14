import { listOrderHistory } from "@/app/actions/orders";
import { OrderHistoryManager } from "@/components/admin/OrderHistoryManager";
import { requireStaffProfile } from "@/lib/get-staff-profile";

/** Waiter-facing order history — always scoped to the signed-in waiter's own orders. */
export default async function StaffOrdersPage() {
  const profile = await requireStaffProfile();
  const orders = await listOrderHistory({ waiterId: profile.id });

  return (
    <OrderHistoryManager
      initialOrders={orders as Parameters<typeof OrderHistoryManager>[0]["initialOrders"]}
      waiters={[]}
      lockedWaiterId={profile.id}
    />
  );
}
