import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line-2 bg-surface px-1 font-mono text-[10.5px] font-medium text-fg-3 shadow-[0_1px_0_var(--line-2)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
