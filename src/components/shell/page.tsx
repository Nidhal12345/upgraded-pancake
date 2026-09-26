"use client";
import { cn } from "@/lib/utils";
import { useApp } from "@/data/store";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-col gap-4 pb-5 pt-6 md:pt-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[12.5px] font-medium text-fg-3">{eyebrow}</div>}
          <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-fg md:text-[40px]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[14px] text-fg-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Container({ className, children, wide }: { className?: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 md:px-8", wide ? "max-w-[1480px]" : "max-w-[1120px]", className)}>{children}</div>;
}

/** Renders a skeleton until the account snapshot is available (instant when cached). */
export function Hydrated({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  if (!hydrated)
    return (
      fallback ?? (
        <Container>
          <div className="pt-8" aria-busy="true" aria-label="Loading your workspace">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton mt-3 h-10 w-64" />
            <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-12" style={{ opacity: 1 - i * 0.12 }} />
                ))}
              </div>
              <div className="skeleton h-72" />
            </div>
          </div>
        </Container>
      )
    );
  return <>{children}</>;
}
