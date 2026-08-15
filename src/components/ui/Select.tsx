import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent, custom-styled <select> used across staff/admin forms — replaces
 * bare native selects (which inherit dark-UA form-control colors and can
 * render invisible white-on-white text when the OS is set to dark mode).
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "input w-full appearance-none pr-9",
          className
        )}
        style={{ colorScheme: "light" }}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--gray-400)]"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
