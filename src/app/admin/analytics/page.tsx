import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: orderItems }, { data: tables }, { data: waiters }, { data: menuItems }, { data: customers }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("payment_status", "paid"),
      supabase.from("order_items").select("*"),
      supabase.from("tables").select("id, table_number, section"),
      supabase.from("staff_profiles").select("id, full_name").eq("role", "waiter"),
      supabase.from("menu_items").select("id, name"),
      supabase.from("customer_profiles").select("id, loyalty_points, whatsapp_opt_in"),
    ]);

  const tableMap = new Map((tables ?? []).map((t) => [t.id, t]));
  const waiterMap = new Map((waiters ?? []).map((w) => [w.id, w.full_name]));
  const menuItemMap = new Map((menuItems ?? []).map((m) => [m.id, m.name]));

  const salesByTable = new Map<string, number>();
  const salesBySection = new Map<string, number>();
  const salesByWaiter = new Map<string, number>();

  for (const order of orders ?? []) {
    const table = tableMap.get(order.table_id);
    const tableLabel = table ? `Table ${table.table_number ?? "—"}` : "Unknown";
    salesByTable.set(tableLabel, (salesByTable.get(tableLabel) ?? 0) + order.total_amount);

    const section = table?.section ?? "Unassigned";
    salesBySection.set(section, (salesBySection.get(section) ?? 0) + order.total_amount);

    const waiterName = order.waiter_id
      ? waiterMap.get(order.waiter_id) ?? "Unknown"
      : "Unassigned";
    salesByWaiter.set(waiterName, (salesByWaiter.get(waiterName) ?? 0) + order.total_amount);
  }

  const salesByItem = new Map<string, number>();
  for (const line of orderItems ?? []) {
    const name = menuItemMap.get(line.menu_item_id) ?? "Unknown item";
    salesByItem.set(name, (salesByItem.get(name) ?? 0) + line.quantity);
  }

  const totalRevenue = (orders ?? []).reduce((sum, o) => sum + o.total_amount, 0);
  const totalLoyaltyPoints = (customers ?? []).reduce((s, c) => s + c.loyalty_points, 0);
  const optedInCount = (customers ?? []).filter((c) => c.whatsapp_opt_in).length;

  const topItems = [...salesByItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" description="Sales, loyalty and engagement at a glance." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <StatCard label="Paid Orders" value={(orders ?? []).length.toString()} />
        <StatCard label="Loyalty Points Issued" value={totalLoyaltyPoints.toString()} />
        <StatCard label="WhatsApp Opt-ins" value={optedInCount.toString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BarList title="Sales by Table" data={salesByTable} format={formatCurrency} />
        <BarList title="Sales by Section" data={salesBySection} format={formatCurrency} />
        <BarList title="Sales by Waiter" data={salesByWaiter} format={formatCurrency} />
      </div>

      <BarList
        title="Most Popular Items (units sold)"
        data={new Map(topItems)}
        format={(n) => n.toString()}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function BarList({
  title,
  data,
  format,
}: {
  title: string;
  data: Map<string, number>;
  format: (n: number) => string;
}) {
  const entries = [...data.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-bold text-[var(--foreground)]">{title}</h3>
      <div className="flex flex-col gap-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-[var(--gray-600)]">
              <span>{label}</span>
              <span className="font-semibold text-[var(--foreground)]">{format(value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[var(--gray-100)]">
              <div
                className="h-1.5 rounded-full bg-[var(--accent-500)]"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-xs text-[var(--foreground-muted)]">No data yet.</p>
        )}
      </div>
    </div>
  );
}
