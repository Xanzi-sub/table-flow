"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createTable, updateTable, deleteTable } from "@/app/actions/tables";
import { PageHeader } from "@/components/ui/PageHeader";
import type { TableRow } from "@/types/database";

const CARD_WIDTH = 480;
const CARD_HEIGHT = 640;
const QR_SIZE = 340;

/** Renders venue name + QR + table number as one flat, downloadable branded card. */
async function drawQrCard(
  canvas: HTMLCanvasElement,
  venueName: string,
  table: TableRow,
  origin: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = "#dfe2e8";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  // Venue name (top)
  ctx.fillStyle = "#14161d";
  ctx.textAlign = "center";
  ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
  wrapText(ctx, venueName || "TableFlow", CARD_WIDTH / 2, 70, CARD_WIDTH - 60, 40);

  ctx.fillStyle = "#6b7385";
  ctx.font = "600 15px system-ui, -apple-system, sans-serif";
  ctx.fillText("SCAN TO VIEW MENU & ORDER", CARD_WIDTH / 2, 128);

  // QR code
  const url = `${origin}/q/${table.qr_identifier}`;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: "#14161d", light: "#ffffff" },
  });
  const qrImage = await loadImage(qrDataUrl);
  const qrX = (CARD_WIDTH - QR_SIZE) / 2;
  const qrY = 160;
  ctx.drawImage(qrImage, qrX, qrY, QR_SIZE, QR_SIZE);

  // Table number (bottom)
  ctx.fillStyle = "#14161d";
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Table ${table.table_number ?? "—"}`, CARD_WIDTH / 2, qrY + QR_SIZE + 70);

  if (table.section) {
    ctx.fillStyle = "#6b7385";
    ctx.font = "500 18px system-ui, -apple-system, sans-serif";
    ctx.fillText(table.section, CARD_WIDTH / 2, qrY + QR_SIZE + 100);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}

function QrCard({ venueName, table }: { venueName: string; table: TableRow }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editing, setEditing] = useState(false);
  const [tableNumber, setTableNumber] = useState(table.table_number?.toString() ?? "");
  const [section, setSection] = useState(table.section ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      drawQrCard(canvasRef.current, venueName, table, window.location.origin);
    }
  }, [venueName, table]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `table-${table.table_number ?? "qr"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  async function handleSave() {
    setSaving(true);
    await updateTable(table.id, {
      tableNumber: Number(tableNumber),
      section: section || null,
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete Table ${table.table_number ?? ""}? This removes its QR code.`)) return;
    await deleteTable(table.id);
  }

  return (
    <div className="card flex flex-col items-center gap-3 p-4">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[240px] rounded-md border border-[var(--border)]"
      />

      {editing ? (
        <div className="flex w-full flex-col gap-2">
          <input
            type="number"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="input !py-1.5 text-center"
            placeholder="Table number"
          />
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="input !py-1.5 text-center"
            placeholder="Section (optional)"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1 !py-1.5 !text-xs">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-secondary flex-1 !py-1.5 !text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex w-full gap-2">
          <button onClick={handleDownload} className="btn btn-primary flex-1 !py-1.5 !text-xs">
            Download PNG
          </button>
          <button onClick={() => setEditing(true)} className="btn btn-secondary !py-1.5 !text-xs">
            Edit
          </button>
          <button onClick={handleDelete} className="btn btn-danger !py-1.5 !text-xs">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function TableQrManager({
  initialTables,
  venueName,
}: {
  initialTables: TableRow[];
  venueName: string;
}) {
  const [tables, setTables] = useState(initialTables);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newSection, setNewSection] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newTableNumber) return;
    setCreating(true);
    setError(null);

    const result = await createTable({
      tableNumber: Number(newTableNumber),
      section: newSection || undefined,
    });

    setCreating(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "Could not create table");
      return;
    }

    setTables((prev) => [
      ...prev,
      {
        id: result.data!.id,
        qr_identifier: result.data!.qrIdentifier,
        table_number: Number(newTableNumber),
        section: newSection || null,
        status: "vacant",
        current_waiter_id: null,
        updated_at: new Date().toISOString(),
      },
    ]);
    setNewTableNumber("");
    setNewSection("");
  }

  const sorted = [...tables].sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0));

  return (
    <div>
      <PageHeader
        title="Tables & QR Codes"
        description="Create tables and generate print-ready QR codes for each one."
      />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="label">Table number</span>
          <input
            type="number"
            min={1}
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            className="input w-40"
          />
        </label>
        <label className="text-sm">
          <span className="label">Section (optional)</span>
          <input
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            placeholder="e.g. Patio"
            className="input w-48"
          />
        </label>
        <button onClick={handleCreate} disabled={creating || !newTableNumber} className="btn btn-primary">
          {creating ? "Creating…" : "Add Table & Generate QR"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((table) => (
          <QrCard key={table.id} venueName={venueName} table={table} />
        ))}
        {sorted.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-[var(--border-strong)] py-10 text-center text-sm text-[var(--foreground-muted)]">
            No tables yet — add one above to generate its QR code.
          </p>
        )}
      </div>
    </div>
  );
}
