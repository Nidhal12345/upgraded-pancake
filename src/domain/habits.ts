import type { DayKey, Habit } from "./types";
import { addDaysKey, diffDays, weekdayOf, weekStartKey, WEEKDAY_SHORT, todayKey } from "@/lib/dates";

export const MILESTONES = [7, 14, 30, 60, 100, 180, 365] as const;

/** Is the habit expected on this specific day? (flexible weekly habits: every day is eligible). */
export function isScheduledOn(h: Habit, day: DayKey): boolean {
  if (day < h.createdAt.slice(0, 10)) return false;
  switch (h.schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return h.schedule.days.includes(weekdayOf(day));
    case "weekly":
      return true;
  }
}

export function isDone(h: Habit, day: DayKey, set?: Set<DayKey>) {
  return (set ?? new Set(h.log)).has(day);
}

export function describeSchedule(h: Habit): string {
  const s = h.schedule;
  if (s.kind === "daily") return "Every day";
  if (s.kind === "weekly") return `${s.times}× per week`;
  const d = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return "Weekdays";
  if (d.length === 2 && d.includes(0) && d.includes(6)) return "Weekends";
  return d.map((x) => WEEKDAY_SHORT[x]).join(" · ");
}

/** Check-ins done in the week containing `day`. */
export function weekProgress(h: Habit, day: DayKey, weekStartsOn: 0 | 1 = 1) {
  const start = weekStartKey(day, weekStartsOn);
  const set = new Set(h.log);
  let done = 0;
  let target = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDaysKey(start, i);
    if (set.has(k)) done++;
    if (h.schedule.kind !== "weekly" && isScheduledOn(h, k)) target++;
  }
  if (h.schedule.kind === "weekly") target = h.schedule.times;
  return { done: Math.min(done, Math.max(done, target)), target, start };
}

/**
 * Streaks. For day-based habits a streak counts consecutive *scheduled* days
 * completed (unscheduled days are transparent). For N×/week habits the streak
 * counts consecutive weeks that met the target. Today never breaks a streak.
 */
export function streaks(h: Habit, today: DayKey = todayKey(), weekStartsOn: 0 | 1 = 1) {
  const set = new Set(h.log);
  const created = h.createdAt.slice(0, 10);
  const unit: "day" | "week" = h.schedule.kind === "weekly" ? "week" : "day";

  if (h.schedule.kind === "weekly") {
    const times = h.schedule.times;
    const weekOk = (ws: DayKey) => {
      let n = 0;
      for (let i = 0; i < 7; i++) if (set.has(addDaysKey(ws, i))) n++;
      return n >= times;
    };
    const thisWeek = weekStartKey(today, weekStartsOn);
    const firstWeek = weekStartKey(created, weekStartsOn);
    let current = 0;
    let ws = weekOk(thisWeek) ? thisWeek : addDaysKey(thisWeek, -7);
    if (weekOk(thisWeek)) current = 0;
    while (ws >= firstWeek && weekOk(ws)) {
      current++;
      ws = addDaysKey(ws, -7);
    }
    let best = 0;
    let run = 0;
    for (let w = firstWeek; w <= thisWeek; w = addDaysKey(w, 7)) {
      if (weekOk(w)) best = Math.max(best, ++run);
      else if (w !== thisWeek) run = 0;
    }
    return { current, best: Math.max(best, current), unit };
  }

  let current = 0;
  let cursor = today;
  if (!set.has(today)) cursor = addDaysKey(today, -1);
  while (cursor >= created) {
    if (isScheduledOn(h, cursor)) {
      if (!set.has(cursor)) break;
      current++;
    }
    cursor = addDaysKey(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const span = diffDays(today, created);
  for (let i = 0; i <= span; i++) {
    const k = addDaysKey(created, i);
    if (!isScheduledOn(h, k)) continue;
    if (set.has(k)) best = Math.max(best, ++run);
    else if (k !== today) run = 0;
  }
  return { current, best: Math.max(best, current), unit };
}

/** Success rate over the trailing `days` window (default 28). */
export function successRate(h: Habit, today: DayKey = todayKey(), days = 28): number {
  const set = new Set(h.log);
  const created = h.createdAt.slice(0, 10);
  if (h.schedule.kind === "weekly") {
    const start = addDaysKey(today, -(days - 1));
    const from = start < created ? created : start;
    const span = diffDays(today, from) + 1;
    let done = 0;
    for (let i = 0; i < span; i++) if (set.has(addDaysKey(from, i))) done++;
    const expected = Math.max(1, Math.round((span / 7) * h.schedule.times));
    return Math.min(1, done / expected);
  }
  let expected = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const k = addDaysKey(today, -i);
    if (k < created) break;
    if (!isScheduledOn(h, k)) continue;
    if (k === today && !set.has(k)) continue; // day not over yet
    expected++;
    if (set.has(k)) done++;
  }
  return expected ? done / expected : 0;
}

export function nextMilestone(streak: number) {
  return MILESTONES.find((m) => m > streak) ?? MILESTONES[MILESTONES.length - 1];
}
export function reachedMilestones(best: number) {
  return MILESTONES.filter((m) => m <= best);
}

/** Habits relevant for a given day (scheduled, or flexible with remaining quota). */
export function habitsForDay(habits: Habit[], day: DayKey, weekStartsOn: 0 | 1 = 1) {
  return habits.filter((h) => {
    if (h.archived || !isScheduledOn(h, day)) return false;
    if (h.schedule.kind === "weekly") {
      const { done, target } = weekProgress(h, day, weekStartsOn);
      return done < target || h.log.includes(day);
    }
    return true;
  });
}
