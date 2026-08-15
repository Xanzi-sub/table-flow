"use client";

/** Shared confirm/delete dialog — replaces native window.confirm() with the app's own styling. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center" onClick={onCancel}>
      <div
        className="w-full max-w-sm border border-[var(--border)] bg-[var(--surface)] p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-[var(--foreground)]">{title}</h2>
        {description && (
          <p className="mt-1.5 text-xs text-[var(--foreground-muted)]">{description}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-secondary">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
