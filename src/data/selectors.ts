"use client";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useApp } from "./store";
import { expandOccurrences } from "@/domain/recurrence";
import type { DayKey } from "@/domain/types";

/** Memoised occurrence expansion for a window. Only re-computes when tasks change. */
export function useOccurrences(from: DayKey, to: DayKey, includeSkipped = false) {
  const tasks = useApp((s) => s.tasks);
  return useMemo(() => expandOccurrences(tasks, from, to, { includeSkipped }), [tasks, from, to, includeSkipped]);
}

export function useSettings() {
  return useApp((s) => s.settings);
}

export function useActions() {
  return useApp(
    useShallow((s) => ({
      addTask: s.addTask,
      updateTask: s.updateTask,
      deleteTasks: s.deleteTasks,
      restoreTasks: s.restoreTasks,
      setTasksStatus: s.setTasksStatus,
      setOccurrenceStatus: s.setOccurrenceStatus,
      patchOccurrence: s.patchOccurrence,
      resetOccurrence: s.resetOccurrence,
      scheduleOccurrence: s.scheduleOccurrence,
      toggleHabit: s.toggleHabit,
    })),
  );
}
