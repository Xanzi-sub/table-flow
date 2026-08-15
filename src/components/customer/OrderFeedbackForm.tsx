"use client";

import { useState } from "react";
import { submitOrderFeedback } from "@/app/actions/feedback";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  );
}

export function OrderFeedbackForm({
  orderId,
  customerId,
  tableId,
  waiterId,
}: {
  orderId: string;
  customerId: string;
  tableId: string;
  waiterId: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    const result = await submitOrderFeedback({ orderId, customerId, tableId, waiterId, rating, comment });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Could not save your feedback");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="text-[13px] font-semibold text-emerald-800">Thank you for your feedback.</p>
        <p className="mt-1 text-[11px] text-emerald-700">The restaurant team can now act on it.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[16px] border border-[#e7e2da] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#99938a]">How was your experience?</p>
      <div className="mt-3 flex items-center justify-between gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            className={`flex h-10 flex-1 items-center justify-center rounded-[12px] transition ${
              value <= rating ? "bg-amber-50 text-amber-500" : "bg-[#f5f2ee] text-[#c5beb4]"
            }`}
          >
            <Star filled={value <= rating} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder="What stood out, or what could be better? (optional)"
            className="mt-3 w-full resize-none rounded-[13px] border border-[#ddd8d0] bg-[#faf9f7] px-3 py-2.5 text-[12px] text-[#171614] outline-none placeholder:text-[#aaa49b] focus:border-[#171614]"
          />
          {error && <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-3 w-full rounded-[13px] bg-[#171614] py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send feedback"}
          </button>
        </>
      )}
    </div>
  );
}
