// Shared shell for signup/login/onboarding forms: a branding panel that fills
// the left half on large screens (so POS/desktop displays aren't just a tiny
// card in empty space) plus a properly-sized form panel on the right.
import Image from "next/image";

export function AuthLayout({
  eyebrow,
  title,
  description,
  panelClassName = "max-w-md lg:max-w-lg",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#0c3327] lg:flex-row">
      <div className="flex flex-col justify-center px-6 py-10 lg:flex-1 lg:px-16 xl:px-24">
        <div className="mb-8 inline-flex w-fit rounded-lg bg-white px-3 py-2">
          <Image
            src="/images/table-flow-logo.png"
            alt="TableFlow"
            width={2172}
            height={724}
            className="h-14 w-auto"
          />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#cdeb69]">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-xl text-3xl font-bold text-white lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-base text-[#b8cec3] lg:text-lg">
          {description}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center border-t border-[#285b47] px-6 py-10 lg:border-l lg:border-t-0 lg:px-16">
        <div className={`w-full ${panelClassName}`}>{children}</div>
      </div>
    </main>
  );
}
