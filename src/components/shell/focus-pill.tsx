"use client";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useFocus, fmtClock, remainingOf, MODE_LABEL } from "@/features/focus/focus-store";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/** Tiny persistent timer shown in the shell while a session is active. */
export function FocusPill({ className }: { className?: string }) {
  const status = useFocus((s) => s.status);
  const mode = useFocus((s) => s.mode);
  const endsAt = useFocus((s) => s.endsAt);
  const remainingMs = useFocus((s) => s.remainingMs);
  const start = useFocus((s) => s.start);
  const pause = useFocus((s) => s.pause);
  useNow(status === "running" ? 1000 : 600_000);
  if (status === "idle") return null;
  const ms = remainingOf({ status, endsAt, remainingMs });
  return (
    <div className={cn("flex h-9 items-center gap-1 rounded-[9px] bg-surface pl-3 pr-1 shadow-sm", className)}>
      <Link href="/focus" className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] outline-none">
        <span className={cn("size-1.5 rounded-full", mode === "focus" ? "bg-accent" : "bg-ok", status === "running" && "animate-pulse")} />
        <span className="truncate text-fg-2">{MODE_LABEL[mode]}</span>
        <span className="ml-auto font-mono tabular text-fg">{fmtClock(ms)}</span>
      </Link>
      <button
        onClick={status === "running" ? pause : start}
        aria-label={status === "running" ? "Pause timer" : "Resume timer"}
        className="grid size-7 place-items-center rounded-[7px] text-fg-2 outline-none hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-3.5"
      >
        {status === "running" ? <Pause /> : <Play />}
      </button>
    </div>
  );
}
