"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TaskStatus } from "@/domain/types";

export type PlannerView = "day" | "3day" | "week" | "list";

interface PlannerPrefs {
  view: PlannerView;
  statuses: TaskStatus[];
  showHabits: boolean;
  setView(v: PlannerView): void;
  toggleStatus(s: TaskStatus): void;
  setStatuses(s: TaskStatus[]): void;
  setShowHabits(v: boolean): void;
}

export const ALL_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

/** Planner preferences persist per device. */
export const usePlannerPrefs = create<PlannerPrefs>()(
  persist(
    (set) => ({
      view: "week",
      statuses: ALL_STATUSES,
      showHabits: true,
      setView: (view) => set({ view }),
      toggleStatus: (s) =>
        set((p) => {
          const has = p.statuses.includes(s);
          const next = has ? p.statuses.filter((x) => x !== s) : [...p.statuses, s];
          return { statuses: next.length ? next : ALL_STATUSES };
        }),
      setStatuses: (statuses) => set({ statuses }),
      setShowHabits: (showHabits) => set({ showHabits }),
    }),
    { name: "meridian:planner" },
  ),
);
