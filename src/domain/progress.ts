import type { DayKey, FocusSession, Habit, Task } from "./types";
import { expandOccurrences } from "./recurrence";
import { habitsForDay, isScheduledOn, streaks, successRate } from "./habits";
import { addDaysKey, rangeKeys, todayKey } from "@/lib/dates";

export interface DaySummary {
  day: DayKey;
  tasksTotal: number;
  reviews: number;
  tasksDone: number;
  habitsTotal: number;
  habitsDone: number;
  focus: number;
  total: number;
  done: number;
  rate: number; // 0..1 (0 when nothing planned)
  xp: number;
}

export const MAX_DAILY_XP = 10;

/**
 * Daily XP (max 10): up to 7 points for the completion ratio of intentions
 * (scaled by volume so a single tiny task isn't a perfect day), up to 2 for
 * focus sessions, and up to 1 for learning reviews (≥ 10 answers).
 */
export function dayXp(done: number, total: number, focus: number, reviews = 0) {
  const volume = Math.min(1, total / 4);
  const completion = total ? (done / total) * 7 * (0.5 + 0.5 * volume) : 0;
  return Math.min(MAX_DAILY_XP, Math.round(completion + Math.min(2, focus * 0.5) + Math.min(1, reviews / 10)));
}

export function summarizeRange(
  tasks: Task[],
  habits: Habit[],
  sessions: FocusSession[],
  from: DayKey,
  count: number,
  _weekStartsOn: 0 | 1 = 1,
  reviewLogs: { day: DayKey }[] = [],
): DaySummary[] {
  void _weekStartsOn;
  const reviewsByDay = new Map<DayKey, number>();
  for (const r of reviewLogs) reviewsByDay.set(r.day, (reviewsByDay.get(r.day) ?? 0) + 1);
  const days = rangeKeys(from, count);
  const to = days[days.length - 1];
  const occ = expandOccurrences(tasks, from, to);
  const byDay = new Map<DayKey, { t: number; d: number }>();
  for (const o of occ) {
    if (o.status === "cancelled") continue;
    const e = byDay.get(o.date) ?? { t: 0, d: 0 };
    e.t++;
    if (o.status === "done") e.d++;
    byDay.set(o.date, e);
  }
  const focusByDay = new Map<DayKey, number>();
  for (const s of sessions) if (s.mode === "focus") focusByDay.set(s.day, (focusByDay.get(s.day) ?? 0) + 1);
  const logs = habits.map((h) => ({ h, set: new Set(h.log) }));

  return days.map((day) => {
    const t = byDay.get(day) ?? { t: 0, d: 0 };
    let ht = 0;
    let hd = 0;
    for (const { h, set } of logs) {
      if (h.archived) continue;
      const scheduled = h.schedule.kind === "weekly" ? set.has(day) : isScheduledOn(h, day);
      if (!scheduled) continue;
      ht++;
      if (set.has(day)) hd++;
    }
    const total = t.t + ht;
    const done = t.d + hd;
    const focus = focusByDay.get(day) ?? 0;
    const reviews = reviewsByDay.get(day) ?? 0;
    return {
      day,
      reviews,
      tasksTotal: t.t,
      tasksDone: t.d,
      habitsTotal: ht,
      habitsDone: hd,
      focus,
      total,
      done,
      rate: total ? done / total : 0,
      xp: dayXp(done, total, focus, reviews),
    };
  });
}

/** Today counts flexible habits that are still "open" this week too. */
export function todayIntentions(tasks: Task[], habits: Habit[], day: DayKey, weekStartsOn: 0 | 1 = 1) {
  const occ = expandOccurrences(tasks, day, day).filter((o) => o.status !== "cancelled");
  const hs = habitsForDay(habits, day, weekStartsOn);
  const doneT = occ.filter((o) => o.status === "done").length;
  const doneH = hs.filter((h) => h.log.includes(day)).length;
  return { total: occ.length + hs.length, done: doneT + doneH, occurrences: occ, habits: hs };
}

/** Consistency: share of days in the last 28 with ≥ 60 % of intentions completed. */
export function consistencyScore(summaries: DaySummary[]) {
  const today = todayKey();
  const relevant = summaries.filter((s) => s.total > 0 && s.day !== today);
  if (!relevant.length) return 0;
  const good = relevant.filter((s) => s.rate >= 0.6).length;
  return good / relevant.length;
}

export const LEVELS = [
  { level: 1, name: "Seedling", at: 0 },
  { level: 2, name: "Sprout", at: 60 },
  { level: 3, name: "Steady grower", at: 250 },
  { level: 4, name: "Deep roots", at: 800 },
  { level: 5, name: "Evergreen", at: 1600 },
  { level: 6, name: "Canopy", at: 2800 },
  { level: 7, name: "Old growth", at: 4500 },
] as const;

export function levelFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].at) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const progress = next ? (xp - cur.at) / (next.at - cur.at) : 1;
  return { ...cur, next, progress, xp, toNext: next ? next.at - xp : 0 };
}

export function habitRanking(habits: Habit[], today = todayKey()) {
  return habits
    .filter((h) => !h.archived)
    .map((h) => ({ habit: h, rate: successRate(h, today), ...streaks(h, today) }))
    .sort((a, b) => b.rate - a.rate || b.current - a.current);
}

export function encouragement(done: number, total: number, hour = new Date().getHours()) {
  if (total === 0) return { title: "A clear day", body: "Nothing planned yet. Add one intention to give the day a shape." };
  const r = done / total;
  if (r >= 1) return { title: "Everything's done", body: "You kept every promise to yourself today. Rest counts too." };
  if (r >= 0.75) return { title: "Nearly there", body: `${total - done} left — finish strong, then call it a day.` };
  if (r >= 0.4) return { title: "Good momentum", body: "You're well into the day's list. Keep the rhythm going." };
  if (done > 0) return { title: "You've started", body: "The hardest part is behind you. Pick the next small thing." };
  if (hour < 12) return { title: "Fresh start", body: "Pick one thing that would make today feel worthwhile." };
  return { title: "Still time", body: "Begin with the smallest item — momentum does the rest." };
}

export function trailingStart(days: number, today = todayKey()) {
  return addDaysKey(today, -(days - 1));
}
