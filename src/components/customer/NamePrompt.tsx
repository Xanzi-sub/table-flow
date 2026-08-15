"use client";

import { useState } from "react";

/** Lightweight guest-identity prompt — replaces phone/OTP verification for now. */
export function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm sm:rounded-[2rem]">
      <div className="rounded-t-3xl bg-white p-6 shadow-2xl">
        <h1 className="text-xl font-bold text-neutral-900">Welcome</h1>
        <p className="mt-1 text-sm text-neutral-500">
          What&apos;s your name? We&apos;ll use it for your order.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onSubmit(name.trim());
            }}
          />
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim()}
            className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
