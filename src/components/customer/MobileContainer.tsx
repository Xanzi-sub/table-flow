import { cn } from "@/lib/utils";

// Forces customer-facing surfaces into a native-app-style mobile frame,
// centered on wider viewports (desktop/tablet browsers).
export function MobileContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-neutral-900 sm:flex sm:items-center sm:justify-center sm:py-6">
      <div
        className={cn(
          "relative flex min-h-dvh w-full flex-col bg-neutral-50 text-neutral-900 shadow-2xl sm:min-h-[calc(100dvh-3rem)] sm:max-w-[430px] sm:rounded-[2.5rem] sm:border-8 sm:border-neutral-900",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
