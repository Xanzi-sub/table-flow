import { listCustomers } from "@/app/actions/customers";
import { CustomerManager } from "@/components/admin/CustomerManager";

export default async function AdminCustomersPage() {
  const customers = await listCustomers();
  return <CustomerManager initialCustomers={customers} />;
}
