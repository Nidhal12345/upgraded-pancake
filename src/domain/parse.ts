import type { DayKey, Recurrence } from "./types";
import { addDaysKey, todayKey, weekdayOf } from "@/lib/dates";

/**
 * Lightweight natural-language parser for quick-add.
 * "Review deck tomorrow 3pm 45m every weekday" →
 *   { title: "Review deck", date, start: 900, duration: 45, recurrence }
 */
export interface ParsedTask {
  title: string;
  date?: DayKey;
  start?: number | null;
  duration?: number;
  recurrence?: Recurrence;
  tokens: { label: string; kind: "date" | "time" | "duration" | "repeat" }[];
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dayIdx = (s: string) => DAYS.indexOf(s.slice(0, 3).toLowerCase());

export function parseQuickAdd(input: string, base: DayKey = todayKey()): ParsedTask {
  let s = ` ${input} `;
  const tokens: ParsedTask["tokens"] = [];
  const out: ParsedTask = { title: "", tokens };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], " ");
    }
  };

  // recurrence
  take(/\s(every ?day|daily)\s/i, () => {
    out.recurrence = { freq: "daily" };
    tokens.push({ label: "Every day", kind: "repeat" });
  });
  take(/\s(every weekday|weekdays)\s/i, () => {
    out.recurrence = { freq: "weekdays" };
    tokens.push({ label: "Weekdays", kind: "repeat" });
  });
  take(/\s(monthly|every month)\s/i, () => {
    out.recurrence = { freq: "monthly" };
    tokens.push({ label: "Monthly", kind: "repeat" });
  });
  take(/\severy ((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:(?:,\s*|\s+and\s+|\s*&\s*|\s+)(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)*)\s/i, (m) => {
    const days = m[1].split(/,\s*|\s+and\s+|\s*&\s*|\s+/).map(dayIdx).filter((d) => d >= 0);
    out.recurrence = days.length > 1 ? { freq: "custom", days } : { freq: "weekly", days };
    tokens.push({ label: `Every ${m[1]}`, kind: "repeat" });
    if (!out.date) {
      let d = base;
      for (let i = 0; i < 7; i++, d = addDaysKey(base, i)) if (days.includes(weekdayOf(d))) break;
      out.date = d;
    }
  });
  take(/\s(weekly|every week)\s/i, () => {
    out.recurrence = { freq: "weekly" };
    tokens.push({ label: "Weekly", kind: "repeat" });
  });

  // date
  take(/\s(today|tod)\s/i, () => {
    out.date = base;
    tokens.push({ label: "Today", kind: "date" });
  });
  take(/\s(tomorrow|tmr|tmrw)\s/i, () => {
    out.date = addDaysKey(base, 1);
    tokens.push({ label: "Tomorrow", kind: "date" });
  });
  take(/\s(?:on |next )?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|urday|sday)?\s/i, (m) => {
    const target = dayIdx(m[1]);
    let delta = (target - weekdayOf(base) + 7) % 7;
    if (delta === 0) delta = 7;
    out.date = addDaysKey(base, delta);
    tokens.push({ label: m[1][0].toUpperCase() + m[1].slice(1, 3), kind: "date" });
  });
  take(/\sin (\d{1,2}) days?\s/i, (m) => {
    out.date = addDaysKey(base, parseInt(m[1], 10));
    tokens.push({ label: `In ${m[1]}d`, kind: "date" });
  });

  // time: 3pm, 3:30pm, 15:00, at 9
  take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\s/i, (m) => {
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toLowerCase() === "pm") h += 12;
    out.start = h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    tokens.push({ label: m[0].trim(), kind: "time" });
  });
  if (out.start == null)
    take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\s/i, (m) => {
      out.start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      tokens.push({ label: `${m[1]}:${m[2]}`, kind: "time" });
    });
  if (out.start == null)
    take(/\sat (\d{1,2})\s/i, (m) => {
      const h = parseInt(m[1], 10);
      out.start = (h < 7 ? h + 12 : h) * 60;
      tokens.push({ label: `at ${m[1]}`, kind: "time" });
    });

  // duration: 45m, 1h, 1.5h, 1h30
  take(/\s(?:for\s)?(\d+(?:\.\d+)?)\s?h(?:ours?|rs?)?(?:\s?(\d{1,2})\s?m?)?\s/i, (m) => {
    out.duration = Math.round(parseFloat(m[1]) * 60) + (m[2] ? parseInt(m[2], 10) : 0);
    tokens.push({ label: m[0].trim(), kind: "duration" });
  });
  take(/\s(?:for\s)?(\d{1,3})\s?(?:m|min|mins|minutes)\s/i, (m) => {
    out.duration = parseInt(m[1], 10);
    tokens.push({ label: m[0].trim(), kind: "duration" });
  });

  if (out.recurrence && !out.date) out.date = base;
  if (out.recurrence?.freq === "weekly" && !out.recurrence.days && out.date)
    out.recurrence.days = [weekdayOf(out.date)];
  out.title = s.replace(/\s+/g, " ").trim();
  return out;
}
