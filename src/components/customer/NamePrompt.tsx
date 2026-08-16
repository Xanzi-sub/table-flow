"use client";

import { useEffect, useState } from "react";

export function NamePrompt({
  onSubmit,
}: {
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.getElementById("guest-name")?.focus();
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  function submit() {
    const trimmed = name.trim();

    if (!trimmed) return;

    onSubmit(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[100] h-dvh overflow-hidden bg-[#171614]/55 backdrop-blur-[6px]">
      <div className="flex h-full min-h-0 items-end justify-center sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-welcome-title"
          className="max-h-[92dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-t-[30px] bg-[#faf9f7] shadow-[0_-20px_70px_rgba(0,0,0,0.18)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[430px] sm:rounded-[30px]"
        >
          {/* Decorative top area */}
          <div className="relative h-24 overflow-hidden bg-[#eee9e1]">
            <div className="absolute -right-8 -top-14 h-40 w-40 rounded-full bg-[#ddd4c7]" />
            <div className="absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#e5ddd2]" />

            <div className="absolute bottom-5 left-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-[#171614] shadow-sm backdrop-blur">
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>

          <div className="px-4 pb-5 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847b]">
                Welcome
              </p>

              <h1
                id="guest-welcome-title"
                className="mt-2 text-[28px] font-semibold leading-[1.05] tracking-[-0.035em] text-[#171614]"
              >
                Let`s get your
                <br />
                order started.
              </h1>

              <p className="mt-3 max-w-[340px] text-[14px] leading-relaxed text-[#77736d]">
                Tell us your name so the restaurant knows who the order is for.
              </p>
            </div>

            <label
              htmlFor="guest-name"
              className="mb-2 block text-[12px] font-medium text-[#55514b]"
            >
              First name
            </label>

            <input
              id="guest-name"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-[54px] w-full rounded-[15px] border border-[#ddd8d0] bg-white px-4 text-[15px] text-[#171614] outline-none transition placeholder:text-[#aaa49b] focus:border-[#171614] focus:ring-4 focus:ring-black/[0.04]"
            />

            <button
              type="button"
              onClick={submit}
              disabled={!name.trim()}
              className="mt-3 flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] bg-[var(--accent-500)] text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(23,76,58,0.16)] transition-all hover:bg-[var(--accent-600)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-[#aaa49b]">
              No account or password required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}