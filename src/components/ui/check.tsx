"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/domain/types";

/**
 * Task status checkbox. Round, satisfying, with a pop on completion.
 * in_progress renders a half-filled state; cancelled renders a struck X.
 */
export function StatusCheck({
  status,
  onToggle,
  size = 18,
  label,
  className,
}: {
  status: TaskStatus;
  onToggle: () => void;
  size?: number;
  label: string;
  className?: string;
}) {
  const done = status === "done";
  const cancelled = status === "cancelled";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done ? true : status === "in_progress" ? "mixed" : false}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "group/check relative grid shrink-0 place-items-center rounded-full outline-none transition-[background-color,border-color,transform] duration-150 before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-90",
        done
          ? "bg-ok text-white"
          : cancelled
            ? "border-[1.5px] border-fg-4 text-fg-3"
            : status === "in_progress"
              ? "border-[1.5px] border-warn"
              : "border-[1.5px] border-line-3 bg-input hover:border-accent-line",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {done && <Check strokeWidth={3} className="animate-pop" style={{ width: size * 0.6, height: size * 0.6 }} />}
      {cancelled && <X strokeWidth={2.5} style={{ width: size * 0.55, height: size * 0.55 }} />}
      {status === "in_progress" && (
        <span className="rounded-full bg-warn" style={{ width: size * 0.5, height: size * 0.5, clipPath: "inset(0 50% 0 0)" }} />
      )}
      {status === "todo" && (
        <Check strokeWidth={3} className="text-fg-4 opacity-0 transition-opacity group-hover/check:opacity-100" style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </button>
  );
}
