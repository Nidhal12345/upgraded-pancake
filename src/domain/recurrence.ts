import { getDate, getDaysInMonth, differenceInCalendarMonths } from "date-fns";
import type { DayKey, Recurrence, Task, TaskOccurrence, OccurrenceOverride } from "./types";
import { diffDays, fromKey, rangeKeys, weekdayOf, WEEKDAY_SHORT, addDaysKey } from "@/lib/dates";

export const DEFAULT_DURATION = 30;

/** Does a recurring series naturally produce an occurrence on `day`? */
export function occursOn(task: Task, day: DayKey): boolean {
  const r = task.recurrence;
  if (!task.date) return false;
  if (!r) return task.date === day;
  const anchor = task.date;
  const offset = diffDays(day, anchor);
  if (offset < 0) return false;
  if (r.until && day > r.until) return false;
  const interval = Math.max(1, r.interval ?? 1);
  const wd = weekdayOf(day);

  switch (r.freq) {
    case "daily":
      return offset % interval === 0;
    case "weekdays":
      return wd >= 1 && wd <= 5;
    case "weekly": {
      const target = r.days?.[0] ?? weekdayOf(anchor);
      if (wd !== target) return false;
      return Math.floor(offset / 7) % interval === 0;
    }
    case "custom": {
      const days = r.days?.length ? r.days : [weekdayOf(anchor)];
      if (!days.includes(wd)) return false;
      // weeks since the anchor's week start (Mon-based) to keep intervals stable
      const anchorMon = addDaysKey(anchor, -((weekdayOf(anchor) + 6) % 7));
      const weeks = Math.floor(diffDays(day, anchorMon) / 7);
      return weeks % interval === 0;
    }
    case "monthly": {
      const a = fromKey(anchor);
      const d = fromKey(day);
      const months = differenceInCalendarMonths(d, a);
      if (months % interval !== 0) return false;
      const target = Math.min(getDate(a), getDaysInMonth(d));
      return getDate(d) === target;
    }
  }
}

/** Build the occurrence for a series' original day (whether or not it's skipped). */
export function occurrenceOf(task: Task, originalDate: DayKey): TaskOccurrence {
  return build(task, originalDate, task.overrides?.[originalDate]);
}

function build(task: Task, originalDate: DayKey, ov: OccurrenceOverride | undefined): TaskOccurrence {
  const recurring = !!task.recurrence;
  const start = ov && "start" in ov ? (ov.start ?? null) : (task.start ?? null);
  return {
    key: `${task.id}:${originalDate}`,
    taskId: task.id,
    task,
    originalDate,
    date: ov?.date ?? originalDate,
    start,
    duration: ov?.duration ?? task.duration ?? DEFAULT_DURATION,
    title: ov?.title ?? task.title,
    status: recurring ? (ov?.status ?? "todo") : task.status,
    recurring,
    moved: !!ov?.date && ov.date !== originalDate,
  };
}

/**
 * Expand tasks into concrete occurrences whose *displayed* date lies in
 * [from, to]. Skipped occurrences are omitted unless `includeSkipped`.
 */
export function expandOccurrences(
  tasks: Task[],
  from: DayKey,
  to: DayKey,
  opts: { includeSkipped?: boolean } = {},
): TaskOccurrence[] {
  const out: TaskOccurrence[] = [];
  const span = diffDays(to, from) + 1;
  if (span <= 0) return out;
  const days = rangeKeys(from, span);

  for (const task of tasks) {
    if (!task.date) continue;
    if (!task.recurrence) {
      if (task.date >= from && task.date <= to) out.push(build(task, task.date, undefined));
      continue;
    }
    const overrides = task.overrides ?? {};
    if (task.recurrence.until && task.recurrence.until < from && !Object.keys(overrides).length) continue;

    for (const day of days) {
      if (!occursOn(task, day)) continue;
      const ov = overrides[day];
      if (ov?.skipped && !opts.includeSkipped) continue;
      const occ = build(task, day, ov);
      if (occ.date < from || occ.date > to) continue; // moved out of window
      out.push(occ);
    }
    // occurrences moved *into* the window from outside it
    for (const [orig, ov] of Object.entries(overrides)) {
      if (!ov.date || (orig >= from && orig <= to)) continue;
      if (ov.date < from || ov.date > to) continue;
      if (ov.skipped && !opts.includeSkipped) continue;
      if (!occursOn(task, orig)) continue;
      out.push(build(task, orig, ov));
    }
  }
  return out.sort(compareOccurrences);
}

export function compareOccurrences(a: TaskOccurrence, b: TaskOccurrence) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.start == null && b.start != null) return 1;
  if (b.start == null && a.start != null) return -1;
  if (a.start != null && b.start != null && a.start !== b.start) return a.start - b.start;
  return a.title.localeCompare(b.title);
}

export function describeRecurrence(r: Recurrence | undefined, anchor?: DayKey): string {
  if (!r) return "Does not repeat";
  const every = (r.interval ?? 1) > 1 ? `Every ${r.interval} ` : "Every ";
  switch (r.freq) {
    case "daily":
      return (r.interval ?? 1) > 1 ? `Every ${r.interval} days` : "Every day";
    case "weekdays":
      return "Every weekday";
    case "weekly": {
      const d = r.days?.[0] ?? (anchor ? weekdayOf(anchor) : 1);
      return `${every}${(r.interval ?? 1) > 1 ? "weeks on " : ""}${WEEKDAY_SHORT[d]}`;
    }
    case "monthly":
      return anchor ? `Monthly on the ${ordinal(fromKey(anchor).getDate())}` : "Monthly";
    case "custom": {
      const ds = (r.days ?? []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return `${(r.interval ?? 1) > 1 ? `Every ${r.interval} weeks · ` : ""}${ds.map((d) => WEEKDAY_SHORT[d]).join(", ") || "Custom"}`;
    }
  }
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
