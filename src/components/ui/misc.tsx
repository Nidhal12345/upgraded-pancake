import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/domain/types";

export const TONES: Tone[] = ["slate", "persimmon", "amber", "moss", "teal", "sky", "iris", "rose"];
export const TONE_LABEL: Record<Tone, string> = {
  slate: "Graphite",
  persimmon: "Persimmon",
  amber: "Amber",
  moss: "Moss",
  teal: "Teal",
  sky: "Sky",
  iris: "Iris",
  rose: "Rose",
};
export const toneVar = (t: Tone | "none" | undefined) => ({ "--tone": t && t !== "none" ? `var(--c-${t})` : "var(--fg-4)" }) as React.CSSProperties;

export function ToneDot({ tone, className }: { tone: Tone | "none"; className?: string }) {
  return <span aria-hidden style={toneVar(tone)} className={cn("inline-block size-2 shrink-0 rounded-full tone-solid", className)} />;
}

export function Badge({
  children,
  tone,
  className,
  variant = "soft",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  variant?: "soft" | "outline" | "plain";
}) {
  return (
    <span
      style={tone ? toneVar(tone) : undefined}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] font-medium [&_svg]:size-3",
        variant === "soft" && (tone ? "tone-soft tone-text" : "bg-surface-3/80 text-fg-2"),
        variant === "outline" && "border border-line-2 text-fg-2",
        variant === "plain" && "px-0 text-fg-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-8" : "gap-3 py-16", className)}>
      {icon && (
        <div className="relative mb-1 grid size-12 place-items-center rounded-[14px] surface-card text-accent-text [&_svg]:size-5">
          <div className="absolute -inset-3 -z-0 rounded-[20px] border border-dashed border-line-2" />
          {icon}
        </div>
      )}
      <div className="max-w-[300px]">
        <p className="text-[14px] font-medium text-fg">{title}</p>
        {body && <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-7 items-center justify-between gap-2", className)}>
      <h2 className="text-[12px] font-medium uppercase tracking-[0.07em] text-fg-3">{children}</h2>
      {action}
    </div>
  );
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[14px] surface-card", className)} {...p}>
      {children}
    </div>
  );
}

export function Bar({ value, className, barClass = "bg-accent" }: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", barClass)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
