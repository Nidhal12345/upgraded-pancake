"use client";
import { Cloud, CloudOff, RefreshCw, CloudAlert, Check } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useApp } from "@/data/store";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

export function SyncStatus({ compact }: { compact?: boolean }) {
  const sync = useApp((s) => s.sync);
  const refresh = useApp((s) => s.refresh);
  useNow(30_000);
  const map = {
    idle: { icon: Check, label: "Synced", cls: "text-fg-3" },
    pending: { icon: Cloud, label: "Saving…", cls: "text-fg-3" },
    syncing: { icon: RefreshCw, label: "Syncing…", cls: "text-fg-3 [&_svg]:animate-spin" },
    offline: { icon: CloudOff, label: "Offline — saved on device", cls: "text-warn-text" },
    error: { icon: CloudAlert, label: "Sync failed — retrying", cls: "text-danger-text" },
  }[sync.state];
  const I = map.icon;
  const when = sync.lastSyncedAt ? `Last synced ${formatDistanceToNowStrict(new Date(sync.lastSyncedAt), { addSuffix: true })}` : "Not synced yet";
  return (
    <Tooltip content={<span>{when} · click to refresh</span>}>
      <button
        onClick={() => void refresh()}
        className={cn("flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-[12px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-3.5", map.cls)}
        aria-live="polite"
      >
        <I />
        {!compact && <span>{map.label}</span>}
      </button>
    </Tooltip>
  );
}
