"use client";
import { Circle, CircleDashed, CircleCheck, CircleX, Check } from "lucide-react";
import type { TaskStatus } from "@/domain/types";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { chipClass } from "./pickers";

export const STATUS_META: Record<TaskStatus, { label: string; icon: typeof Circle; cls: string; key: string }> = {
  todo: { label: "To do", icon: Circle, cls: "text-fg-3", key: "1" },
  in_progress: { label: "In progress", icon: CircleDashed, cls: "text-warn-text", key: "2" },
  done: { label: "Completed", icon: CircleCheck, cls: "text-ok-text", key: "3" },
  cancelled: { label: "Cancelled", icon: CircleX, cls: "text-fg-4", key: "4" },
};
export const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const M = STATUS_META[status];
  return <M.icon className={cn(M.cls, className)} />;
}

export function StatusMenu({ value, onChange, className }: { value: TaskStatus; onChange: (s: TaskStatus) => void; className?: string }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className={cn(chipClass, className)}>
          <StatusIcon status={value} />
          {STATUS_META[value].label}
        </button>
      </MenuTrigger>
      <MenuContent className="w-[190px]">
        {STATUSES.map((s) => (
          <MenuItem key={s} onSelect={() => onChange(s)} shortcut={STATUS_META[s].key}>
            <StatusIcon status={s} className={STATUS_META[s].cls} />
            {STATUS_META[s].label}
            {value === s && <Check className="ml-1 !text-accent" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
