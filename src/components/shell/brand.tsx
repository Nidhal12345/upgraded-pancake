import { cn } from "@/lib/utils";

/** Meridian mark — a horizon arc crossed by the day's line. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="7" className="fill-accent" />
      <path d="M5.5 15.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="var(--accent-fg)" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.5 15.5h15" stroke="var(--accent-fg)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <circle cx="12" cy="9" r="1.6" fill="var(--accent-fg)" />
    </svg>
  );
}
