"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createScanJob, importMenuRowsFromSpreadsheet, type SpreadsheetRow } from "@/app/actions/scan";

const SPREADSHEET_EXTENSIONS = [".xlsx", ".csv"];
const MAX_MENU_FILES = 20;
const MAX_MENU_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
const MAX_SPREADSHEET_ROWS = 5000;

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h.trim().toLowerCase()));
}

async function parseSpreadsheetFile(file: File): Promise<SpreadsheetRow[]> {
  if (file.size > MAX_SPREADSHEET_BYTES) throw new Error("Spreadsheet must be 5 MB or smaller");
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  let rows: unknown[][];

  if (extension === ".csv") {
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<unknown[]>(await file.text(), {
      skipEmptyLines: true,
      preview: MAX_SPREADSHEET_ROWS + 2,
    });
    if (result.errors.length) throw new Error("Could not parse that CSV file");
    rows = result.data;
  } else if (extension === ".xlsx") {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    rows = (await readXlsxFile(file)) as unknown as unknown[][];
  } else {
    throw new Error("Only .xlsx and .csv files are supported");
  }

  if (rows.length === 0) return [];
  if (rows.length > MAX_SPREADSHEET_ROWS + 1) throw new Error(`Spreadsheet cannot exceed ${MAX_SPREADSHEET_ROWS} data rows`);

  const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
  const groupCol = findColumn(headers, ["group", "main category", "section group"]);
  const categoryCol = findColumn(headers, ["category", "section"]);
  const nameCol = findColumn(headers, ["name", "item", "item name"]);
  const descCol = findColumn(headers, ["description", "desc"]);
  const priceCol = findColumn(headers, ["price", "cost"]);

  if (nameCol === -1 || priceCol === -1) {
    throw new Error("Spreadsheet must have at least 'name' and 'price' columns");
  }

  const parsed: SpreadsheetRow[] = [];
  for (const row of rows.slice(1)) {
    const name = String(row[nameCol] ?? "").trim();
    if (!name) continue;
    const rawPrice = row[priceCol];
    const price = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(price)) continue;
    parsed.push({
      group: groupCol !== -1 ? String(row[groupCol] ?? "").trim() || undefined : undefined,
      category: categoryCol !== -1 ? String(row[categoryCol] ?? "").trim() || undefined : undefined,
      name,
      description: descCol !== -1 ? String(row[descCol] ?? "").trim() || undefined : undefined,
      price,
    });
  }
  return parsed;
}

export function MenuScanUploader({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleSubmit() {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      if (files.length > MAX_MENU_FILES) throw new Error(`Upload no more than ${MAX_MENU_FILES} files per scan`);
      if (files.some((file) => file.size > MAX_MENU_FILE_BYTES)) throw new Error("Each menu file must be 10 MB or smaller");
      if (files.some((file) => !file.type.startsWith("image/") && file.type !== "application/pdf")) {
        throw new Error("Menu scans must be images or PDF files");
      }
      const supabase = createClient();
      const imageUrls: string[] = [];

      for (const file of files) {
        const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
        const path = `scans/${crypto.randomUUID()}${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-photos")
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) throw new Error(uploadError.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from("menu-photos").getPublicUrl(path);
        imageUrls.push(publicUrl);
      }

      const result = await createScanJob(imageUrls);
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Could not start the scan job");
      }

      setFiles([]);
      onCreated(result.data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSheetImport() {
    if (!sheetFile) return;
    setImporting(true);
    setError(null);
    try {
      const rows = await parseSpreadsheetFile(sheetFile);
      if (rows.length === 0) throw new Error("No usable rows found in that file");

      const supabase = createClient();
      const extension = sheetFile.name.toLowerCase().slice(sheetFile.name.lastIndexOf("."));
      const path = `scans/${crypto.randomUUID()}${extension}`;
      const { error: uploadError } = await supabase.storage.from("menu-photos").upload(path, sheetFile, {
        contentType: sheetFile.type || (extension === ".csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      const {
        data: { publicUrl },
      } = supabase.storage.from("menu-photos").getPublicUrl(path);

      const result = await importMenuRowsFromSpreadsheet(rows, publicUrl);
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Could not import the spreadsheet");
      }
      setSheetFile(null);
      onCreated(result.data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-[var(--foreground)]">Scan a Physical Menu</h2>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Photograph each page, or upload a PDF — one job can hold multiple files.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-600)]">{error}</p>
      )}

      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        capture="environment"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="mt-4 block w-full text-sm text-[var(--foreground-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--gray-900)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />

      {files.length > 0 && (
        <p className="mt-2 text-xs text-[var(--foreground-muted)]">{files.length} file(s) selected</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={files.length === 0 || uploading}
        className="btn btn-primary mt-4 w-full"
      >
        {uploading ? "Uploading…" : "Upload & Extract Items"}
      </button>

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-bold text-[var(--foreground)]">Or import from a spreadsheet</h3>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          Excel (.xlsx) or CSV with columns: group, category, name, description, price. Maximum 5 MB and 5,000 rows.
        </p>
        <input
          type="file"
          accept={SPREADSHEET_EXTENSIONS.join(",")}
          onChange={(e) => setSheetFile(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm text-[var(--foreground-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--gray-100)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--foreground)]"
        />
        <button
          onClick={handleSheetImport}
          disabled={!sheetFile || importing}
          className="btn btn-secondary mt-3 w-full"
        >
          {importing ? "Importing…" : "Import Spreadsheet"}
        </button>
      </div>
    </div>
  );
}
