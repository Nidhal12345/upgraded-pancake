"use client";
import { memo } from "react";
import { Repeat, Clock, SkipForward, Ban, CalendarClock, Trash2, CircleDashed, Circle, ArrowRight, MoveRight, StickyNote, GraduationCap } from "lucide-react";
import type { TaskOccurrence } from "@/domain/types";
import { StatusCheck } from "@/components/ui/check";
import { Context, ContextContent, ContextItem, ContextSeparator, ContextTrigger } from "@/components/ui/menu";
import { toneVar } from "@/components/ui/misc";
import { useUI } from "@/data/ui-store";
import { addDaysKey, fmtDuration, fmtRange, relativeDayLabel, todayKey } from "@/lib/dates";
import { deleteTasks, moveOccurrence, setOccurrenceStatus, skipOccurrence, toggleOccurrence } from "@/features/tasks/task-actions";
import { cn } from "@/lib/utils";

export function OccurrenceMenuItems({ occ }: { occ: TaskOccurrence }) {
  const today = todayKey();
  return (
    <>
      <ContextItem onSelect={() => setOccurrenceStatus(occ, occ.status === "in_progress" ? "todo" : "in_progress")}>
        {occ.status === "in_progress" ? <Circle /> : <CircleDashed />}
        {occ.status === "in_progress" ? "Mark as to-do" : "Mark in progress"}
      </ContextItem>
      <ContextItem onSelect={() => setOccurrenceStatus(occ, occ.status === "cancelled" ? "todo" : "cancelled")}>
        <Ban /> {occ.status === "cancelled" ? "Restore" : occ.recurring ? "Cancel this occurrence" : "Cancel task"}
      </ContextItem>
      <ContextSeparator />
      {occ.date !== today && (
        <ContextItem onSelect={() => moveOccurrence(occ, today, occ.start)}>
          <ArrowRight /> Move to today
        </ContextItem>
      )}
      <ContextItem onSelect={() => moveOccurrence(occ, addDaysKey(occ.date, 1), occ.start)}>
        <MoveRight /> Push to {relativeDayLabel(addDaysKey(occ.date, 1)).toLowerCase()}
      </ContextItem>
      {occ.recurring && (
        <ContextItem onSelect={() => skipOccurrence(occ)}>
          <SkipForward /> Skip this occurrence
        </ContextItem>
      )}
      <ContextItem onSelect={() => useUI.getState().openEditor({ taskId: occ.taskId, originalDate: occ.recurring ? occ.originalDate : undefined })}>
        <CalendarClock /> Edit details…
      </ContextItem>
      <ContextItem
        onSelect={() =>
          useUI.getState().openCardComposer({
            prefill: { front: occ.title, back: occ.task.notes ?? "", source: { kind: "task", id: occ.taskId, label: occ.title } },
          })
        }
      >
        <GraduationCap /> Turn into learning card
      </ContextItem>
      <ContextSeparator />
      <ContextItem danger onSelect={() => deleteTasks([occ.taskId])}>
        <Trash2 /> {occ.recurring ? "Delete series" : "Delete"}
      </ContextItem>
    </>
  );
}

/** Single-line task row. Click opens the inspector; right-click for quick actions. */
export const TaskRow = memo(function TaskRow({
  occ,
  showDate,
  selected,
  onSelectToggle,
  selectable,
  dense,
}: {
  occ: TaskOccurrence;
  showDate?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onSelectToggle?: (occ: TaskOccurrence, shift: boolean) => void;
  dense?: boolean;
}) {
  const openEditor = useUI((s) => s.openEditor);
  const done = occ.status === "done";
  const cancelled = occ.status === "cancelled";
  const open = () => openEditor({ taskId: occ.taskId, originalDate: occ.recurring ? occ.originalDate : undefined });
  const overdue = !done && !cancelled && occ.date < todayKey();

  return (
    <Context>
      <ContextTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => (selectable && (e.metaKey || e.ctrlKey || e.shiftKey) ? onSelectToggle?.(occ, e.shiftKey) : open())}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter") open();
            if (e.key === " ") {
              e.preventDefault();
              toggleOccurrence(occ);
            }
            if (e.key === "x" && selectable) onSelectToggle?.(occ, false);
          }}
          aria-label={`${occ.title}${occ.start != null ? `, ${fmtRange(occ.start, occ.duration)}` : ""}`}
          style={toneVar(occ.task.tone)}
          className={cn(
            "group relative flex items-center gap-3 rounded-[10px] px-3 outline-none transition-colors",
            dense ? "min-h-10 py-1.5" : "min-h-12 py-2.5",
            selected ? "bg-selected" : "hover:bg-hover focus-visible:bg-hover",
            "focus-visible:shadow-[inset_0_0_0_1.5px_var(--accent-line)]",
          )}
        >
          {selectable && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onSelectToggle?.(occ, false)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${occ.title}`}
              className={cn("size-3.5 shrink-0 accent-[var(--accent)] transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:hidden")}
            />
          )}
          <StatusCheck status={occ.status} onToggle={() => toggleOccurrence(occ)} label={done ? `Mark ${occ.title} as not done` : `Complete ${occ.title}`} />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-[14px] leading-snug transition-colors", done && "text-fg-3", cancelled && "text-fg-4 line-through")}>{occ.title}</div>
            {!dense && (occ.task.notes || occ.task.project) && (
              <div className="mt-0.5 flex items-center gap-2 truncate text-[12px] text-fg-3">
                {occ.task.project && <span className="truncate">{occ.task.project}</span>}
                {occ.task.notes && (
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <StickyNote className="size-3 shrink-0" />
                    <span className="truncate">{occ.task.notes}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5 text-[12px] text-fg-3">
            {occ.status === "in_progress" && <span className="rounded-[5px] bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn-text max-sm:hidden">In progress</span>}
            {occ.recurring && <Repeat className="size-3.5 text-fg-4" aria-label="Recurring" />}
            {showDate && <span className={cn("max-sm:hidden", overdue && "text-danger-text")}>{relativeDayLabel(occ.date)}</span>}
            {occ.start != null ? (
              <span className="flex items-center gap-1 font-mono tabular">
                <Clock className="size-3 max-sm:hidden" />
                {fmtRange(occ.start, occ.duration).split(" – ")[0]}
                <span className="text-fg-4 max-sm:hidden">· {fmtDuration(occ.duration)}</span>
              </span>
            ) : null}
            <span aria-hidden className="h-4 w-[3px] rounded-full tone-solid opacity-70" />
          </div>
        </div>
      </ContextTrigger>
      <ContextContent>
        <OccurrenceMenuItems occ={occ} />
      </ContextContent>
    </Context>
  );
});
