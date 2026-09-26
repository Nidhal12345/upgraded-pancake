import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";
import type { DayKey } from "@/domain/types";

export const toKey = (d: Date): DayKey => format(d, "yyyy-MM-dd");
export const fromKey = (k: DayKey): Date => parseISO(k);
export const todayKey = (): DayKey => toKey(new Date());
export const isDayKey = (k: unknown): k is DayKey =>
  typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && isValid(parseISO(k));

export const addDaysKey = (k: DayKey, n: number): DayKey => toKey(addDays(fromKey(k), n));
export const diffDays = (a: DayKey, b: DayKey) => differenceInCalendarDays(fromKey(a), fromKey(b));
export const weekdayOf = (k: DayKey) => fromKey(k).getDay();

export function rangeKeys(start: DayKey, count: number): DayKey[] {
  const out: DayKey[] = [];
  const base = fromKey(start);
  for (let i = 0; i < count; i++) out.push(toKey(addDays(base, i)));
  return out;
}

export function weekStartKey(k: DayKey, weekStartsOn: 0 | 1 = 1): DayKey {
  return toKey(startOfWeek(fromKey(k), { weekStartsOn }));
}

/** 540 → "9:00", with am/pm-free 24h clock for scanability. */
export function fmtTime(min: number | null | undefined): string {
  if (min == null) return "";
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function fmtRange(start: number, duration: number) {
  return `${fmtTime(start)} – ${fmtTime(start + duration)}`;
}

export function fmtDuration(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function relativeDayLabel(k: DayKey, today = todayKey()): string {
  const d = diffDays(k, today);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return format(fromKey(k), "EEEE");
  return format(fromKey(k), fromKey(k).getFullYear() === new Date().getFullYear() ? "EEE, MMM d" : "MMM d, yyyy");
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_MIN = ["S", "M", "T", "W", "T", "F", "S"];

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
