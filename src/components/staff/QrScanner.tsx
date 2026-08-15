"use client";

import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onDecoded: (text: string) => void;
}

// Thin wrapper around html5-qrcode for in-browser sticker scanning.
export function QrScanner({ onDecoded }: QrScannerProps) {
  const containerId = "qr-scanner-region";
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => onDecoded(decodedText),
          () => {
            /* per-frame decode errors are expected while aiming — ignore */
          }
        )
        .catch((err) => setError(err?.message ?? "Could not access the camera"));
    });

    return () => {
      cancelled = true;
      scannerRef.current
        ?.stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {});
    };
  }, [onDecoded]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-black">
      <div id={containerId} className="aspect-square w-full" />
      {error && (
        <p className="bg-[var(--danger-50)] px-3 py-2 text-center text-sm text-[var(--danger-600)]">
          {error}
        </p>
      )}
    </div>
  );
}
