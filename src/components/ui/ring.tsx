import { cn } from "@/lib/utils";

/** SVG progress ring. Pure — safe for server rendering. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  className,
  trackClass = "stroke-surface-3",
  barClass = "stroke-accent",
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  className?: string;
  trackClass?: string;
  barClass?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={cn(barClass, "transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.3,0.9,0.3,1)]")}
          style={{ opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
