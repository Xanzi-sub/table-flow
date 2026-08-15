import Image from "next/image";
import Link from "next/link";

const tables = [
  { id: "T04", guests: 2, amount: "R420", status: "Ready", tone: "green" },
  { id: "T08", guests: 4, amount: "R860", status: "Preparing", tone: "amber" },
  { id: "T12", guests: 4, amount: "R1,240", status: "Ordering", tone: "blue" },
  { id: "T17", guests: 3, amount: "R680", status: "Served", tone: "gray" },
  { id: "T21", guests: 6, amount: "R1,860", status: "Ready", tone: "green" },
];

const kitchen = [
  {
    order: "#1048",
    table: "T12",
    items: "4 items",
    station: "Hot kitchen",
    time: "08:42",
    status: "Preparing",
  },
  {
    order: "#1047",
    table: "T08",
    items: "6 items",
    station: "Grill",
    time: "08:39",
    status: "Preparing",
  },
  {
    order: "#1046",
    table: "T21",
    items: "3 items",
    station: "Bar",
    time: "08:37",
    status: "Ready",
  },
];

const modules = [
  {
    number: "01",
    title: "Table & order management",
    description:
      "Keep every table, order, payment and service state in one operational view.",
  },
  {
    number: "02",
    title: "Kitchen operations",
    description:
      "Send orders to the right preparation station and give the floor a live view of what's ready.",
  },
  {
    number: "03",
    title: "Guest relationships",
    description:
      "Turn completed visits into useful guest history and relevant follow-up conversations.",
  },
];

function StatusDot({ tone }: { tone: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    gray: "bg-gray-400",
  };

  return <span className={`h-2 w-2 rounded-full ${colors[tone]}`} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#111318]">
      {/* Navigation */}
      <header className="border-b border-[#E4E6EA] bg-white">
        <div className="mx-auto flex h-[140px] max-w-[1280px] items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
           <Image
                     src="/images/table-flow-logo.png"
                     alt="TableFlow"
                     width={2172}
                     height={724}
                     priority
                     className="h-28 w-auto"
                   />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#platform"
              className="text-[13px] font-medium text-[#626873] transition-colors hover:text-[#111318]"
            >
              Platform
            </Link>
            <Link
              href="#operations"
              className="text-[13px] font-medium text-[#626873] transition-colors hover:text-[#111318]"
            >
              Operations
            </Link>
            <Link
              href="#guests"
              className="text-[13px] font-medium text-[#626873] transition-colors hover:text-[#111318]"
            >
              Guest experience
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/staff/login"
              className="hidden text-[13px] font-medium text-[#626873] hover:text-[#111318] sm:block"
            >
              Staff sign in
            </Link>

            <Link
              href="/signup"
              className="rounded-[5px] bg-[#111318] px-4 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[#E4E6EA] bg-white">
        <div className="mx-auto max-w-[1280px] px-6 pb-16 pt-16 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="grid items-end gap-12 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="max-w-[540px]">
              <div className="mb-5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D737D]">
                  Restaurant operations platform
                </span>
              </div>

              <h1 className="max-w-[570px] text-[42px] font-semibold leading-[1.06] tracking-[-0.045em] text-[#111318] sm:text-[52px]">
                Run the restaurant from one connected system.
              </h1>

              <p className="mt-6 max-w-[490px] text-[16px] leading-7 text-[#646A74]">
                TableFlow connects ordering, tables, kitchen operations and
                guest relationships in one system built for the pace of a
                real restaurant.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-[5px] bg-[#111318] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Set up your venue
                </Link>

                <Link
                  href="/staff/login"
                  className="inline-flex h-11 items-center justify-center rounded-[5px] border border-[#D9DCE1] bg-white px-5 text-[13px] font-semibold text-[#242831] transition-colors hover:bg-[#F7F8FA]"
                >
                  Staff sign in
                </Link>
              </div>

              <div className="mt-9 flex items-center gap-6 text-[11px] text-[#858B95]">
                <span>QR ordering</span>
                <span className="h-3 w-px bg-[#D9DCE1]" />
                <span>Kitchen routing</span>
                <span className="h-3 w-px bg-[#D9DCE1]" />
                <span>Guest history</span>
              </div>
            </div>

            {/* Product preview */}
            <div className="overflow-hidden rounded-[8px] border border-[#DCDFE4] bg-[#F5F6F8] shadow-[0_12px_40px_rgba(17,19,24,0.08)]">
              {/* Application header */}
              <div className="flex h-12 items-center justify-between border-b border-[#DFE2E6] bg-white px-4">
                <div className="flex items-center gap-5">
                  <span className="text-[11px] font-semibold text-[#171A20]">
                    Overview
                  </span>
                  <span className="text-[11px] text-[#8A909A]">Floor</span>
                  <span className="text-[11px] text-[#8A909A]">Kitchen</span>
                  <span className="text-[11px] text-[#8A909A]">Guests</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-[#727883]">
                    Live
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[1.05fr_0.95fr] gap-px bg-[#DFE2E6]">
                {/* Floor */}
                <div className="bg-[#F8F9FA] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-semibold">
                        Main floor
                      </div>
                      <div className="mt-0.5 text-[9px] text-[#8A9099]">
                        24 tables · 68 guests
                      </div>
                    </div>

                    <span className="rounded-[3px] border border-[#DDE0E5] bg-white px-2 py-1 text-[9px] text-[#6E747E]">
                      Live floor
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {tables.map((table) => (
                      <div
                        key={table.id}
                        className="rounded-[5px] border border-[#E0E3E7] bg-white p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold">
                            {table.id}
                          </span>
                          <StatusDot tone={table.tone} />
                        </div>

                        <div className="mt-5 text-[12px] font-semibold">
                          {table.amount}
                        </div>

                        <div className="mt-1 text-[9px] text-[#8B919A]">
                          {table.guests} guests
                        </div>

                        <div className="mt-2 text-[8px] text-[#737983]">
                          {table.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kitchen */}
                <div className="bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-semibold">
                        Kitchen
                      </div>
                      <div className="mt-0.5 text-[9px] text-[#8A9099]">
                        3 active tickets
                      </div>
                    </div>

                    <span className="font-mono text-[9px] text-[#8A9099]">
                      19:53
                    </span>
                  </div>

                  <div className="space-y-2">
                    {kitchen.map((order) => (
                      <div
                        key={order.order}
                        className="rounded-[5px] border border-[#E4E6EA] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold">
                            {order.order}
                          </span>
                          <span
                            className={`text-[9px] font-medium ${
                              order.status === "Ready"
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-[#565C66]">
                            {order.table} · {order.items}
                          </span>
                          <span className="text-[9px] text-[#999EA6]">
                            {order.time}
                          </span>
                        </div>

                        <div className="mt-2 text-[9px] text-[#8A9099]">
                          {order.station}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom metrics */}
              <div className="grid grid-cols-4 divide-x divide-[#DFE2E6] border-t border-[#DFE2E6] bg-white">
                {[
                  ["Active tables", "18"],
                  ["Open orders", "11"],
                  ["Kitchen queue", "03"],
                  ["Today", "R24,860"],
                ].map(([label, value]) => (
                  <div key={label} className="px-4 py-3">
                    <div className="text-[8px] uppercase tracking-[0.1em] text-[#969BA4]">
                      {label}
                    </div>
                    <div className="mt-1 text-[13px] font-semibold tracking-[-0.01em]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform statement */}
      <section id="platform" className="border-b border-[#E4E6EA] bg-[#F7F8FA]">
        <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A9099]">
                One operational layer
              </div>
            </div>

            <div>
              <h2 className="max-w-[760px] text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[#15181E] sm:text-[36px]">
                Every part of service works from the same operational picture.
              </h2>

              <p className="mt-5 max-w-[680px] text-[15px] leading-7 text-[#686E78]">
                TableFlow keeps the restaurant synchronized as an order moves
                from guest to kitchen to table — while preserving the
                information needed to bring that guest back.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="operations" className="border-b border-[#E4E6EA] bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8 lg:py-20">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A9099]">
                Platform capabilities
              </div>

              <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.03em]">
                Built around how restaurants actually operate.
              </h2>
            </div>
          </div>

          <div className="grid border-t border-[#E2E4E8] md:grid-cols-3 md:divide-x md:divide-[#E2E4E8]">
            {modules.map((module) => (
              <div
                key={module.number}
                className="border-b border-[#E2E4E8] px-1 py-8 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"
              >
                <div className="font-mono text-[10px] font-semibold text-[#8B919B]">
                  {module.number}
                </div>

                <h3 className="mt-7 text-[16px] font-semibold tracking-[-0.015em]">
                  {module.title}
                </h3>

                <p className="mt-3 max-w-[310px] text-[13px] leading-6 text-[#6D737D]">
                  {module.description}
                </p>

                <div className="mt-7 h-px w-8 bg-[#CBD0D7]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guest experience */}
      <section id="guests" className="border-b border-[#E4E6EA] bg-[#F7F8FA]">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A9099]">
              Guest experience
            </div>

            <h2 className="mt-4 max-w-[480px] text-[30px] font-semibold leading-tight tracking-[-0.035em]">
              The visit ends. The relationship doesn`t.
            </h2>

            <p className="mt-5 max-w-[470px] text-[14px] leading-7 text-[#686E78]">
              Build a useful history of guest visits, orders and preferences,
              then use it to create more relevant follow-up experiences.
            </p>

            <Link
              href="/signup"
              className="mt-7 inline-flex text-[13px] font-semibold text-[#1F55D8] hover:text-[#1645B7]"
            >
              Explore TableFlow →
            </Link>
          </div>

          <div className="rounded-[7px] border border-[#DDE0E5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E2E4E8] px-5 py-4">
              <div>
                <div className="text-[12px] font-semibold">
                  Guest profile
                </div>
                <div className="mt-1 text-[9px] text-[#8C929B]">
                  Recent visit activity
                </div>
              </div>

              <span className="rounded-[3px] bg-[#F2F4F7] px-2 py-1 text-[9px] text-[#6D737D]">
                Returning guest
              </span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[#E2E4E8] border-b border-[#E2E4E8]">
              <div className="p-5">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[#959AA3]">
                  Visits
                </div>
                <div className="mt-2 text-[20px] font-semibold">12</div>
              </div>

              <div className="p-5">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[#959AA3]">
                  Avg. spend
                </div>
                <div className="mt-2 text-[20px] font-semibold">R840</div>
              </div>

              <div className="p-5">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[#959AA3]">
                  Last visit
                </div>
                <div className="mt-2 text-[20px] font-semibold">6d</div>
              </div>
            </div>

            <div className="divide-y divide-[#ECEEF1]">
              {[
                ["08 Aug", "Table 14", "R920"],
                ["02 Aug", "Table 08", "R760"],
                ["28 Jul", "Table 11", "R1,040"],
              ].map(([date, table, amount]) => (
                <div
                  key={date}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-5">
                    <span className="font-mono text-[9px] text-[#8C929B]">
                      {date}
                    </span>
                    <span className="text-[11px] font-medium">{table}</span>
                  </div>

                  <span className="font-mono text-[10px] text-[#666C75]">
                    {amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#111318]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 px-6 py-14 sm:flex-row sm:items-center lg:px-8">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7F858F]">
              TableFlow
            </div>

            <h2 className="mt-3 text-[25px] font-semibold tracking-[-0.03em] text-white">
              A better operating layer for modern restaurants.
            </h2>
          </div>

          <Link
            href="/signup"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-[5px] bg-white px-5 text-[13px] font-semibold text-[#111318] transition-opacity hover:opacity-90"
          >
            Set up your venue
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="text-[10px] text-[#858B95]">
            © 2026 TableFlow. Restaurant operations platform.
          </span>

          <div className="flex gap-6">
            <Link
              href="/staff/login"
              className="text-[10px] font-medium text-[#666C75] hover:text-[#111318]"
            >
              Staff sign in
            </Link>

            <Link
              href="/signup"
              className="text-[10px] font-medium text-[#666C75] hover:text-[#111318]"
            >
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}