"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "@/components/staff/QrScanner";

/** Extracts the qr_identifier segment from a decoded sticker URL or raw string. */
function extractIdentifier(decoded: string): string {
  try {
    const url = new URL(decoded);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("q");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] ?? decoded;
  } catch {
    return decoded;
  }
}

export default function AssignTableScanPage() {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);

  function handleDecoded(text: string) {
    if (scanned) return;
    setScanned(true);
    router.push(`/staff/assign-table/${extractIdentifier(text)}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-neutral-900">Scan &amp; Assign</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Point the camera at a table sticker to bind it to a table number.
      </p>
      <div className="mt-4">
        <QrScanner onDecoded={handleDecoded} />
      </div>
    </div>
  );
}
