"use client";
import { toast } from "sonner";
import { useApp } from "@/data/store";
import type { DayKey, Habit, Task, TaskOccurrence, TaskStatus } from "@/domain/types";
import { fmtTime, relativeDayLabel } from "@/lib/dates";
import { pluralize } from "@/lib/utils";

/**
 * Imperative, toast-aware commands shared by every surface (lists, planner,
 * command menu, keyboard shortcuts). Each destructive action offers Undo.
 */
const app = () => useApp.getState();

export function toggleOccurrence(occ: TaskOccurrence) {
  const next: TaskStatus = occ.status === "done" ? "todo" : "done";
  app().setOccurrenceStatus(occ, next);
  if (next === "done") {
    toast.success(occ.recurring ? "Occurrence completed" : "Task completed", {
      description: occ.title,
      action: { label: "Undo", onClick: () => app().setOccurrenceStatus(occ, occ.status) },
    });
  }
}

export function setOccurrenceStatus(occ: TaskOccurrence, status: TaskStatus) {
  const prev = occ.status;
  app().setOccurrenceStatus(occ, status);
  if (status === "cancelled")
    toast(occ.recurring ? "Occurrence cancelled" : "Task cancelled", {
      description: occ.title,
      action: { label: "Undo", onClick: () => app().setOccurrenceStatus(occ, prev) },
    });
}

export function skipOccurrence(occ: TaskOccurrence) {
  app().patchOccurrence(occ, { skipped: true });
  toast(`Skipped ${relativeDayLabel(occ.originalDate).toLowerCase()}'s occurrence`, {
    description: occ.title,
    action: { label: "Undo", onClick: () => app().patchOccurrence(occ, { skipped: false }) },
  });
}

export function moveOccurrence(occ: TaskOccurrence, date: DayKey, start: number | null, duration?: number, silent = false) {
  const before = { date: occ.date, start: occ.start, duration: occ.duration };
  if (before.date === date && before.start === start && (duration == null || duration === before.duration)) return;
  app().scheduleOccurrence(occ, { date, start, duration });
  if (silent) return;
  const label =
    duration != null && date === before.date && start === before.start
      ? "Duration updated"
      : date === before.date
        ? `Rescheduled to ${start != null ? fmtTime(start) : "anytime"}`
        : `Moved to ${relativeDayLabel(date)}${start != null ? ` · ${fmtTime(start)}` : ""}`;
  toast(occ.recurring ? `${label} · this occurrence` : label, {
    description: occ.title,
    action: { label: "Undo", onClick: () => app().scheduleOccurrence({ ...occ, date, start, duration: duration ?? occ.duration }, before) },
  });
}

export function deleteTasks(ids: string[]) {
  const removed = app().deleteTasks(ids);
  if (!removed.length) return;
  toast(removed.length === 1 ? "Task deleted" : `${pluralize(removed.length, "task")} deleted`, {
    description: removed.length === 1 ? removed[0].title : undefined,
    action: { label: "Undo", onClick: () => app().restoreTasks(removed) },
  });
}

export function bulkStatus(tasks: Task[], status: TaskStatus) {
  const prev = tasks.map((t) => ({ id: t.id, status: t.status }));
  app().setTasksStatus(
    tasks.filter((t) => !t.recurrence).map((t) => t.id),
    status,
  );
  toast(`${pluralize(tasks.length, "task")} updated`, {
    action: {
      label: "Undo",
      onClick: () => prev.forEach((p) => app().updateTask(p.id, { status: p.status })),
    },
  });
}

export function toggleHabitCheckIn(h: Habit, day: DayKey) {
  const done = app().toggleHabit(h.id, day);
  if (done) {
    const updated = app().habits.find((x) => x.id === h.id);
    toast.success(`${h.name} · checked in`, {
      action: { label: "Undo", onClick: () => app().toggleHabit(h.id, day) },
      description: updated ? undefined : undefined,
    });
  }
  return done;
}

export function deleteHabit(h: Habit) {
  const removed = app().deleteHabit(h.id);
  if (removed)
    toast(`"${h.name}" deleted`, {
      description: `${pluralize(h.log.length, "check-in")} removed`,
      action: { label: "Undo", onClick: () => app().restoreHabit(removed) },
    });
}
