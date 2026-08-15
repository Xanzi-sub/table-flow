/** Shared stroke-icon set for customer-facing UI — replaces emoji placeholders. */
const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CartIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}

export function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M6 3h12a1 1 0 0 1 1 1v16l-2.5-1.5L14 20l-2.5-1.5L9 20l-2.5-1.5L4 20V4a1 1 0 0 1 1-1Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

export function PlateIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.4} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function NoteIcon({ className }: { className?: string }) {
  return (
    <svg {...common} strokeWidth={1.8} className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13 6l3 3" />
    </svg>
  );
}
