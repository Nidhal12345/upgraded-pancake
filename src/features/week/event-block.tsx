"use client";
import { memo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Repeat, Check } from "lucide-react";
import type { Habit, TaskOccurrence } from "@/domain/types";
import { toneVar } from "@/components/ui/misc";
import { fmtRange, fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { snap } from "./layout";
import { HabitIcon } from "@/components/habits/habit-icon";
import { Context, ContextContent, ContextTrigger } from "@/components/ui/menu";
import { OccurrenceMenuItems } from "@/components/tasks/task-row";
import { toggleOccurrence } from "@/features/tasks/task-actions";

export interface BlockGeometry {
  top: number;
  height: number;
  left: string;
  width: string;
}

/**
 * A scheduled block in the time grid. Drag body to move (dnd-kit),
 * drag the bottom edge to resize (native pointer capture).
 */
export const EventBlock = memo(function EventBlock({
  occ,
  geo,
  pxPerMin,
  maxEnd,
  dimmed,
  selected,
  coarse,
  onOpen,
  onTapSelect,
  onResize,
}: {
  occ: TaskOccurrence;
  geo: BlockGeometry;
  pxPerMin: number;
  maxEnd: number;
  dimmed?: boolean;
  selected?: boolean;
  coarse?: boolean;
  onOpen: (o: TaskOccurrence) => void;
  onTapSelect: (o: TaskOccurrence) => void;
  onResize: (o: TaskOccurrence, duration: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: occ.key, data: { occ } });
  const [resizeDur, setResizeDur] = useState<number | null>(null);
  const resizeRef = useRef<{ y: number; dur: number } | null>(null);

  const duration = resizeDur ?? occ.duration;
  const height = resizeDur != null ? Math.max(20, resizeDur * pxPerMin - 2) : geo.height;
  const compact = height < 38;
  const done = occ.status === "done";
  const cancelled = occ.status === "cancelled";

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { y: e.clientY, dur: occ.duration };
    setResizeDur(occ.duration);
  };
  const moveResize = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const d = snap(resizeRef.current.dur + (e.clientY - resizeRef.current.y) / pxPerMin);
    setResizeDur(Math.max(15, Math.min(d, maxEnd - (occ.start ?? 0))));
  };
  const endResize = () => {
    if (resizeRef.current && resizeDur != null && resizeDur !== occ.duration) onResize(occ, resizeDur);
    resizeRef.current = null;
    setResizeDur(null);
  };

  return (
    <Context>
      <ContextTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          role="button"
          aria-roledescription="Draggable task"
          aria-label={`${occ.title}, ${fmtRange(occ.start!, occ.duration)}. Press Enter to edit.`}
          onClick={(e) => {
            e.stopPropagation();
            if (coarse) onTapSelect(occ);
            else onOpen(occ);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpen(occ);
            if (e.key === " ") {
              e.preventDefault();
              toggleOccurrence(occ);
            }
          }}
          data-block
          style={{ ...toneVar(occ.task.tone), top: geo.top, height, left: geo.left, width: geo.width, touchAction: "manipulation" }}
          className={cn(
            "group/block absolute z-[2] select-none overflow-hidden rounded-[7px] border-l-[3px] border-[var(--tone)] pl-2 pr-1.5 text-left outline-none transition-[opacity,box-shadow] duration-150",
            "bg-[color-mix(in_oklab,var(--tone)_14%,var(--surface))] hover:bg-[color-mix(in_oklab,var(--tone)_19%,var(--surface))]",
            "shadow-[0_0_0_1px_var(--surface)] focus-visible:shadow-[0_0_0_2px_var(--ring)]",
            compact ? "py-0.5" : "py-1",
            done && "opacity-60",
            cancelled && "bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--line)_5px_6px)] opacity-50",
            isDragging && "opacity-30",
            dimmed && "opacity-25",
            selected && "shadow-[0_0_0_2px_var(--tone)] z-[4]",
            resizeDur != null && "z-[5] shadow-md",
          )}
        >
          <div className={cn("flex min-w-0 gap-1", compact ? "items-center" : "items-start")}>
            {done && <Check className="mt-px size-3 shrink-0 tone-text" strokeWidth={3} />}
            <span
              className={cn(
                "min-w-0 flex-1 text-[12px] font-medium leading-[1.3] text-fg",
                compact ? "truncate" : "line-clamp-2",
                cancelled && "line-through",
              )}
            >
              {occ.title}
              {compact && <span className="ml-1 font-mono text-[10.5px] font-normal text-fg-3">{fmtTime(occ.start)}</span>}
            </span>
            {occ.recurring && <Repeat className="mt-0.5 size-3 shrink-0 text-fg-3" aria-hidden />}
          </div>
          {!compact && (
            <div className="mt-0.5 truncate font-mono text-[10.5px] tabular text-fg-3">
              {fmtRange(occ.start!, duration)}
            </div>
          )}
          {!coarse && !cancelled && height >= 28 && (
            <div
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onClick={(e) => e.stopPropagation()}
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 transition-opacity group-hover/block:opacity-100"
            >
              <div className="mx-auto mt-[3px] h-[3px] w-6 rounded-full bg-[var(--tone)] opacity-60" />
            </div>
          )}
        </div>
      </ContextTrigger>
      <ContextContent>
        <OccurrenceMenuItems occ={occ} />
      </ContextContent>
    </Context>
  );
});

/** Timed habit marker inside the grid — tap to check in. */
export const HabitBlock = memo(function HabitBlock({ habit, done, top, onToggle }: { habit: Habit; done: boolean; top: number; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ ...toneVar(habit.tone), top }}
      aria-pressed={done}
      aria-label={`Habit: ${habit.name} at ${fmtTime(habit.time)}${done ? ", done" : ""}`}
      className={cn(
        "absolute right-1 z-[3] flex h-[20px] max-w-[calc(100%-8px)] items-center gap-1 rounded-full border px-1.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        done ? "border-transparent tone-solid text-white" : "border-dashed tone-line bg-surface tone-text hover:tone-soft",
      )}
    >
      {done ? <Check className="size-3 shrink-0" strokeWidth={3} /> : <HabitIcon name={habit.icon} className="size-3 shrink-0" />}
      <span className="truncate max-sm:hidden">{habit.name}</span>
    </button>
  );
});
