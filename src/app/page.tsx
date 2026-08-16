import Image from "next/image";
import Link from "next/link";

const floorTables = [
  { table: "04", total: "R420", state: "Ready", color: "bg-[#22A06B]" },
  { table: "08", total: "R860", state: "Preparing", color: "bg-[#E09F3E]" },
  { table: "12", total: "R1,240", state: "Ordering", color: "bg-[#2878FF]" },
  { table: "17", total: "R680", state: "Served", color: "bg-[#8490A3]" },
];

const capabilities = [
  ["01", "QR ordering", "Guests browse, customise and order from their phone without downloading an app."],
  ["02", "Live floor", "Every table, request, order and payment state stays visible to the team in real time."],
  ["03", "Menu control", "Update items, availability, specials and pricing once, then publish instantly."],
  ["04", "Guest intelligence", "Build useful customer profiles from real visits, preferences and order history."],
  ["05", "Loyalty & WhatsApp", "Reward repeat visits and send relevant follow-ups instead of generic broadcasts."],
  ["06", "Restaurant analytics", "See what sells, who returns and where service needs attention."],
];

const included = [
  "QR menu and table ordering",
  "Live floor and order management",
  "Menu, specials and staff management",
  "Customer profiles and loyalty",
  "WhatsApp marketing and receipts",
  "AI-assisted menu import",
  "Advanced analytics and reporting",
  "Priority support",
];

function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}

export default function Home() {
  return (
    <main
      className="min-h-screen overflow-hidden bg-[#F7F8F4] text-[#141712]"
      style={{
        "--landing-ink": "#141712",
        "--landing-muted": "#667066",
        "--landing-line": "#DDE1D8",
        "--landing-green": "#174C3A",
        "--landing-lime": "#CDEB69",
        fontFamily: 'Aptos, "Segoe UI", sans-serif',
      } as React.CSSProperties}
    >
      <style>{`
        @keyframes landing-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
        .landing-rise { animation: landing-rise .65s ease-out both; }
        .landing-rise-delay { animation: landing-rise .65s .14s ease-out both; }
        .landing-live { animation: landing-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .landing-rise, .landing-rise-delay, .landing-live { animation: none; }
        }
      `}</style>

      <header className="relative z-20 border-b border-[var(--landing-line)] bg-[#F7F8F4]/95">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Link href="/" aria-label="TableFlow home">
            <Image src="/images/table-flow-logo.png" alt="TableFlow" width={2172} height={724} priority className="h-8 w-auto sm:h-9" />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            <Link href="#platform" className="text-sm font-medium text-[var(--landing-muted)] hover:text-[var(--landing-ink)]">Platform</Link>
            <Link href="#growth" className="text-sm font-medium text-[var(--landing-muted)] hover:text-[var(--landing-ink)]">Guest growth</Link>
            <Link href="#pricing" className="text-sm font-medium text-[var(--landing-muted)] hover:text-[var(--landing-ink)]">Pricing</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/staff/login" className="hidden text-sm font-semibold text-[var(--landing-muted)] hover:text-[var(--landing-ink)] sm:block">Sign in</Link>
            <Link href="/signup" className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[var(--landing-ink)] px-4 text-sm font-bold text-white hover:bg-[var(--landing-green)]">
              Get started <ArrowIcon />
            </Link>
          </div>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="relative border-b border-[var(--landing-line)] bg-[#F7F8F4]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#DDE1D840_1px,transparent_1px),linear-gradient(to_bottom,#DDE1D830_1px,transparent_1px)] bg-[size:80px_80px]" />
        <div className="relative mx-auto grid max-w-[1240px] gap-6 px-5 pb-8 pt-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-10 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="landing-rise max-w-[570px]">
            <div className="mb-5 flex items-center gap-2.5 text-xs font-bold uppercase text-[var(--landing-green)]">
              <span className="landing-live h-2 w-2 rounded-full bg-[#2A9D68]" />
              Restaurant operations, connected
            </div>
            <h1 className="text-[40px] font-bold leading-[1.02] text-[var(--landing-ink)] sm:text-[58px]">From first scan to next visit.</h1>
            <p className="mt-5 max-w-[520px] text-[17px] leading-7 text-[var(--landing-muted)]">
              TableFlow brings QR ordering, staff operations, loyalty, marketing and restaurant intelligence into one calm, connected system.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-[5px] bg-[var(--landing-green)] px-6 text-sm font-bold text-white hover:bg-[#103D2E]">
                Set up your venue <ArrowIcon />
              </Link>
              <Link href="#pricing" className="hidden h-12 items-center justify-center rounded-[5px] border border-[#BDC4B9] bg-white px-6 text-sm font-bold text-[var(--landing-ink)] hover:bg-[#EEF1EA] sm:inline-flex">
                See transparent pricing
              </Link>
            </div>
            <p className="mt-5 hidden text-xs font-medium text-[#7B847A] sm:block">Built for South African restaurants · No per-order fees</p>
          </div>

          <div className="landing-rise-delay min-w-0 overflow-hidden rounded-[7px] border border-[#C8CEC3] bg-[#EDF0E9] shadow-[0_24px_70px_rgba(28,48,38,0.14)]">
            <div className="flex h-11 items-center justify-between border-b border-[#D7DBD2] bg-white px-4">
              <div className="flex items-center gap-4 text-[10px] font-semibold text-[#8A9188]">
                <span className="text-[#1A1D18]">Live floor</span><span>Orders</span><span>Guests</span>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#287C58]"><span className="landing-live h-1.5 w-1.5 rounded-full bg-[#2A9D68]" /> LIVE</span>
            </div>

            <div className="grid sm:min-h-[290px] sm:grid-cols-[1.05fr_0.95fr]">
              <div className="border-b border-[#D7DBD2] p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="mb-3 flex items-end justify-between">
                  <div><p className="text-xs font-bold">Main floor</p><p className="mt-0.5 text-[9px] text-[#81887E]">18 active · 42 guests</p></div>
                  <p className="text-[9px] text-[#81887E]">19:53</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {floorTables.map((item) => (
                    <div key={item.table} className="rounded-[5px] border border-[#DDE1D9] bg-white p-2.5 sm:p-3">
                      <div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold">T{item.table}</span><span className={`h-2 w-2 rounded-full ${item.color}`} /></div>
                      <p className="mt-2 text-sm font-bold sm:mt-4">{item.total}</p><p className="mt-1 text-[9px] text-[#737B71]">{item.state}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden bg-white p-4 sm:block">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-bold">Order #1048</p><p className="mt-0.5 text-[9px] text-[#81887E]">Table 12 · 4 guests</p></div>
                  <span className="rounded-[3px] bg-[#FFF2D8] px-2 py-1 text-[9px] font-bold text-[#9B641B]">Preparing</span>
                </div>
                <div className="mt-4 space-y-3 border-y border-[#E5E8E1] py-3">
                  {[["2×", "Smash burger", "R290"], ["1×", "Garden bowl", "R135"], ["3×", "House soda", "R126"]].map(([quantity, name, amount]) => (
                    <div key={name} className="grid grid-cols-[24px_1fr_auto] text-[10px]"><span className="font-mono text-[#858C83]">{quantity}</span><span className="font-semibold">{name}</span><span className="font-mono text-[#697167]">{amount}</span></div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-[#737B71]">Order total</span><span className="text-sm font-bold">R551</span></div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EBEEE8]"><div className="h-full w-[72%] rounded-full bg-[var(--landing-green)]" /></div>
                <p className="mt-2 text-[9px] text-[#858C83]">Kitchen progress · 8 min</p>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[#D7DBD2] border-t border-[#D7DBD2] bg-white">
              {[["OPEN ORDERS", "11"], ["AVG. TICKET", "R684"], ["TODAY", "R24,860"]].map(([label, value]) => (
                <div key={label} className="px-3 py-2.5 sm:py-3"><p className="text-[8px] font-bold text-[#8A9188]">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Connected flow */}
      <section className="border-b border-[var(--landing-line)] bg-[var(--landing-green)] text-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--landing-lime)]">One connected flow</p>
              <h2 className="mt-4 max-w-[420px] text-[32px] font-bold leading-tight sm:text-[40px]">One order becomes better service and a reason to return.</h2>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[6px] border border-white/15 bg-white/15 sm:grid-cols-2">
              {[["01", "Guest orders", "Scan, browse and order without waiting."], ["02", "Team delivers", "Kitchen and floor share one live view."], ["03", "Data becomes useful", "Every visit builds a richer guest profile."], ["04", "The guest returns", "Loyalty and relevant WhatsApp follow-ups."]].map(([number, title, copy]) => (
                <div key={number} className="bg-[var(--landing-green)] p-6"><span className="font-mono text-xs text-[var(--landing-lime)]">{number}</span><h3 className="mt-8 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{copy}</p></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Platform */}
      <section id="platform" className="border-b border-[var(--landing-line)] bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase text-[var(--landing-green)]">The platform</p><h2 className="mt-3 max-w-[650px] text-[34px] font-bold leading-tight sm:text-[44px]">Everything service needs. Nothing it doesn&apos;t.</h2></div>
            <p className="max-w-[390px] text-sm leading-6 text-[var(--landing-muted)]">One system replaces the disconnected tools that slow the floor down and leave guest data unused.</p>
          </div>
          <div className="mt-12 grid border-l border-t border-[var(--landing-line)] md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(([number, title, copy]) => (
              <article key={number} className="min-h-[210px] border-b border-r border-[var(--landing-line)] p-6 sm:p-7">
                <span className="font-mono text-xs font-bold text-[#8B9488]">{number}</span><h3 className="mt-9 text-lg font-bold">{title}</h3><p className="mt-3 max-w-[310px] text-sm leading-6 text-[var(--landing-muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Guest growth */}
      <section id="growth" className="border-b border-[var(--landing-line)] bg-[#EEF1EA]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div className="max-w-[520px]">
            <p className="text-xs font-bold uppercase text-[var(--landing-green)]">Beyond the transaction</p>
            <h2 className="mt-3 text-[34px] font-bold leading-tight sm:text-[44px]">Know who comes back. Give them a reason to.</h2>
            <p className="mt-5 text-[16px] leading-7 text-[var(--landing-muted)]">TableFlow turns completed orders into customer intelligence: visit history, spend, preferences, feedback and loyalty progress your team can actually use.</p>
            <div className="mt-7 grid grid-cols-2 gap-5 border-t border-[#CFD5CA] pt-6">
              <div><p className="text-2xl font-bold text-[var(--landing-green)]">12</p><p className="mt-1 text-xs text-[var(--landing-muted)]">Visits recognised</p></div>
              <div><p className="text-2xl font-bold text-[var(--landing-green)]">R840</p><p className="mt-1 text-xs text-[var(--landing-muted)]">Average spend</p></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[7px] border border-[#CCD2C7] bg-white shadow-[0_18px_50px_rgba(34,55,43,0.10)]">
            <div className="flex items-center justify-between border-b border-[#E1E5DD] px-5 py-4">
              <div><p className="text-sm font-bold">Guest profile</p><p className="mt-0.5 text-[10px] text-[#81887E]">Lerato M. · returning guest</p></div>
              <span className="rounded-[3px] bg-[#E7F4EA] px-2 py-1 text-[9px] font-bold text-[#27744F]">LOYALTY ACTIVE</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#E1E5DD] border-b border-[#E1E5DD]">
              {[["VISITS", "12"], ["POINTS", "460"], ["LAST VISIT", "6d"]].map(([label, value]) => (
                <div key={label} className="p-5"><p className="text-[8px] font-bold text-[#8B9288]">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>
              ))}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between"><p className="text-xs font-bold">Recent visits</p><p className="text-[9px] text-[#81887E]">LIFETIME · R10,080</p></div>
              <div className="mt-3 divide-y divide-[#ECEFE9] border-y border-[#ECEFE9]">
                {[["08 AUG", "Table 14", "4 guests", "R920"], ["02 AUG", "Table 08", "2 guests", "R760"], ["28 JUL", "Table 11", "5 guests", "R1,040"]].map(([date, table, guests, amount]) => (
                  <div key={date} className="grid grid-cols-[58px_1fr_auto] items-center py-3 text-[10px]"><span className="font-mono text-[#8A9188]">{date}</span><span className="font-semibold">{table} <span className="font-normal text-[#8A9188]">· {guests}</span></span><span className="font-mono">{amount}</span></div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[4px] bg-[#F1F5E4] p-3"><p className="text-[10px] font-semibold text-[#49543C]">40 points until next reward</p><span className="text-xs font-bold text-[var(--landing-green)]">92%</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Pricing */}
      <section id="pricing" className="border-b border-[var(--landing-line)] bg-white">
        <div className="mx-auto max-w-[1080px] px-5 py-16 lg:px-8 lg:py-24">
          <div className="text-center">
            <p className="text-xs font-bold uppercase text-[var(--landing-green)]">Simple pricing</p>
            <h2 className="mt-3 text-[34px] font-bold leading-tight sm:text-[44px]">One venue. One complete plan.</h2>
            <p className="mx-auto mt-4 max-w-[580px] text-[15px] leading-7 text-[var(--landing-muted)]">Predictable software pricing with no per-order fee and no percentage of your restaurant&apos;s revenue.</p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[7px] border border-[#C9CFC5] bg-[#F9FAF7] shadow-[0_22px_60px_rgba(32,49,39,0.09)]">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-[var(--landing-green)] p-7 text-white sm:p-10">
                <p className="text-xs font-bold uppercase text-[var(--landing-lime)]">TableFlow complete</p>
                <div className="mt-6 flex items-end gap-2"><span className="text-[52px] font-bold leading-none">R899</span><span className="pb-1 text-sm text-white/65">/ month</span></div>
                <p className="mt-3 text-sm text-white/65">Everything your venue needs to run TableFlow.</p>
                <div className="mt-8 border-t border-white/15 pt-6"><p className="text-sm font-bold">Prefer annual billing?</p><p className="mt-2 text-2xl font-bold">R8,990 / year</p><p className="mt-1 text-xs text-[var(--landing-lime)]">Save R1,798 · roughly two months free</p></div>
                <div className="mt-8 rounded-[5px] border border-white/15 bg-white/5 p-4"><p className="text-xs font-bold uppercase text-white/55">Setup & onboarding</p><p className="mt-2 text-xl font-bold">R2,500 once-off</p><p className="mt-2 text-xs leading-5 text-white/60">Configuration, menu import, QR setup, branding, staff accounts and training.</p></div>
              </div>

              <div className="p-7 sm:p-10">
                <p className="text-sm font-bold">Everything is included</p>
                <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {included.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm leading-5 text-[#525B51]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E1EEDC] text-[11px] font-bold text-[var(--landing-green)]">✓</span><span>{item}</span></div>
                  ))}
                </div>
                <Link href="/signup" className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[5px] bg-[var(--landing-ink)] px-6 text-sm font-bold text-white hover:bg-[var(--landing-green)]">Start with TableFlow <ArrowIcon /></Link>
                <p className="mt-3 text-center text-[11px] text-[#858D82]">Third-party WhatsApp usage may be billed separately.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 rounded-[6px] border border-[#D9DFC7] bg-[#F5F8E9] p-5 sm:flex-row sm:items-center">
            <div><p className="text-sm font-bold text-[var(--landing-green)]">Founding Venue offer</p><p className="mt-1 text-xs leading-5 text-[#687060]">For a limited number of early restaurant partners, with feedback and reference participation.</p></div>
            <p className="shrink-0 text-sm font-bold">R1,500 setup · R599/month for 12 months</p>
          </div>
        </div>
      </section>

      {/* 6. Closing CTA */}
      <section className="bg-[#D5EE75]">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 px-5 py-14 sm:flex-row sm:items-center lg:px-8 lg:py-16">
          <div><p className="text-xs font-bold uppercase text-[#49602B]">Your restaurant, in flow</p><h2 className="mt-3 max-w-[680px] text-[30px] font-bold leading-tight text-[#17200F] sm:text-[40px]">Better service tonight. Stronger guest relationships tomorrow.</h2></div>
          <Link href="/signup" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[5px] bg-[#142518] px-6 text-sm font-bold text-white hover:bg-[#203B27]">Set up your venue <ArrowIcon /></Link>
        </div>
      </section>

      <footer className="bg-[#111611] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Image src="/images/table-flow-logo.png" alt="TableFlow" width={2172} height={724} className="h-7 w-auto brightness-0 invert" />
          <p className="text-xs text-white/45">© 2026 TableFlow · Restaurant operations and guest growth</p>
          <div className="flex gap-5 text-xs font-semibold text-white/65"><Link href="#pricing" className="hover:text-white">Pricing</Link><Link href="/staff/login" className="hover:text-white">Staff sign in</Link></div>
        </div>
      </footer>
    </main>
  );
}
