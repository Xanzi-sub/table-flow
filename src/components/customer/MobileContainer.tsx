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
    <div className="min-h-dvh bg-[#171614] sm:flex sm:items-center sm:justify-center sm:py-6">
      <div
        className={cn(
          "relative flex min-h-dvh w-full flex-col bg-[#faf9f7] text-[#171614] shadow-2xl sm:min-h-[calc(100dvh-3rem)] sm:max-w-[430px] sm:rounded-[2.5rem] sm:border-8 sm:border-[#171614]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
