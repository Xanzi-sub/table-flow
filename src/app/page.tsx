import Link from "next/link";

const capabilities = [
  { label: "QR table ordering", detail: "Guests order from their phone, no app install" },
  { label: "Kitchen & floor ops", detail: "Live order routing, table status, staff roles" },
  { label: "WhatsApp loyalty", detail: "Automated re-engagement tied to visit history" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-background">
      {/* Top bar — establishes this as a product, not a marketing stunt */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
            TF
          </div>
          <span className="text-sm font-semibold tracking-tight text-gray-900">
            TableFlow
          </span>
        </div>
        <Link
          href="/staff/login"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Staff sign in
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="w-full max-w-2xl text-center">
          <span className="badge badge-accent">Restaurant operations platform</span>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Run the floor, the kitchen,
            <br className="hidden sm:block" /> and repeat visits — in one system
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-500">
            QR-code table ordering, staff operations, and WhatsApp loyalty,
            built for venues that can&apos;t afford downtime.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-primary w-full px-6 py-3 text-sm sm:w-auto">
              Set up your venue
            </Link>
            <Link href="/staff/login" className="btn btn-secondary w-full px-6 py-3 text-sm sm:w-auto">
              Staff &amp; admin login
            </Link>
          </div>
        </div>

        {/* Capability strip — grounds the abstract hero in what staff actually touch */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {capabilities.map((c) => (
            <div key={c.label} className="card p-5 text-left">
              <p className="text-sm font-semibold text-gray-900">{c.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-border px-6 py-5 text-center text-xs text-gray-400 sm:px-10">
        TableFlow &middot; Built for restaurant floors, not app stores
      </footer>
    </main>
  );
}