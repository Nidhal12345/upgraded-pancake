import { test } from "node:test";
import assert from "node:assert/strict";
import { expandOccurrences, occursOn } from "../src/domain/recurrence";
import { streaks, successRate } from "../src/domain/habits";
import { parseQuickAdd } from "../src/domain/parse";
import { dayXp, MAX_DAILY_XP } from "../src/domain/progress";
import { mergeSnapshots } from "../src/data/sync/merge";
import { layoutDay } from "../src/features/week/layout";
import { toggleNthCheckbox, continueList } from "../src/features/notes/md-commands";
import type { Habit, Snapshot, Task } from "../src/domain/types";

const base = (p: Partial<Task>): Task => ({ id: "t1", title: "T", status: "todo", tone: "slate", createdAt: "", updatedAt: "", ...p });

test("weekdays recurrence skips weekends", () => {
  const t = base({ date: "2026-09-21", recurrence: { freq: "weekdays" } }); // Monday
  const occ = expandOccurrences([t], "2026-09-21", "2026-09-27");
  assert.equal(occ.length, 5);
  assert.equal(occursOn(t, "2026-09-26"), false);
});

test("monthly on the 31st clamps to month end", () => {
  const t = base({ date: "2026-01-31", recurrence: { freq: "monthly" } });
  assert.ok(occursOn(t, "2026-02-28"));
  assert.ok(occursOn(t, "2026-04-30"));
});

test("custom days with 2-week interval", () => {
  const t = base({ date: "2026-09-21", recurrence: { freq: "custom", days: [1, 3], interval: 2 } });
  const occ = expandOccurrences([t], "2026-09-21", "2026-10-04").map((o) => o.date);
  assert.deepEqual(occ, ["2026-09-21", "2026-09-23"]);
});

test("per-occurrence overrides: skip, complete, move across window", () => {
  const t = base({
    date: "2026-09-21",
    start: 540,
    recurrence: { freq: "daily" },
    overrides: {
      "2026-09-22": { skipped: true },
      "2026-09-23": { status: "done" },
      "2026-09-20": {},
      "2026-09-24": { date: "2026-09-30", start: 600 },
    },
  });
  const wk = expandOccurrences([t], "2026-09-21", "2026-09-27");
  assert.equal(wk.find((o) => o.originalDate === "2026-09-22"), undefined);
  assert.equal(wk.find((o) => o.originalDate === "2026-09-23")?.status, "done");
  assert.equal(wk.find((o) => o.originalDate === "2026-09-24"), undefined, "moved out of window");
  const next = expandOccurrences([t], "2026-09-28", "2026-10-04");
  const moved = next.find((o) => o.originalDate === "2026-09-24");
  assert.ok(moved?.moved);
  assert.equal(moved?.start, 600);
});

test("habit streaks ignore unscheduled days; today never breaks", () => {
  const h: Habit = {
    id: "h", name: "Lift", icon: "dumbbell", tone: "moss", createdAt: "2026-09-01T00:00:00Z", updatedAt: "",
    schedule: { kind: "weekdays", days: [1, 3, 5] },
    log: ["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-21", "2026-09-23", "2026-09-25"],
  };
  assert.equal(streaks(h, "2026-09-26").current, 6);
  assert.equal(streaks(h, "2026-09-28").current, 6, "Monday not yet done doesn't break");
  assert.ok(successRate(h, "2026-09-26") > 0.4);
});

test("weekly N-times habits count week streaks", () => {
  const h: Habit = {
    id: "h", name: "Run", icon: "footprints", tone: "teal", createdAt: "2026-09-01T00:00:00Z", updatedAt: "",
    schedule: { kind: "weekly", times: 2 },
    log: ["2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24"],
  };
  const s = streaks(h, "2026-09-26");
  assert.equal(s.unit, "week");
  assert.equal(s.current, 3);
});

test("quick-add parser", () => {
  const p = parseQuickAdd("Review deck tomorrow 3pm 45m", "2026-09-26");
  assert.equal(p.title, "Review deck");
  assert.equal(p.date, "2026-09-27");
  assert.equal(p.start, 900);
  assert.equal(p.duration, 45);
  const r = parseQuickAdd("Standup every weekday 9:30", "2026-09-26");
  assert.equal(r.recurrence?.freq, "weekdays");
  assert.equal(r.start, 570);
  const c = parseQuickAdd("Gym every mon and thu 7am", "2026-09-26");
  assert.deepEqual(c.recurrence, { freq: "custom", days: [1, 4] });
  assert.equal(c.date, "2026-09-28");
});

test("xp is capped", () => {
  assert.equal(dayXp(20, 20, 10, 20), MAX_DAILY_XP);
  assert.ok(dayXp(20, 20, 10) < MAX_DAILY_XP);
  assert.equal(dayXp(0, 0, 0), 0);
});

test("merge: newer entity wins, tombstones prevent resurrection", () => {
  const snap = (tasks: Task[], tomb: Record<string, string> = {}): Snapshot => ({
    version: 1, rev: 1, updatedAt: "2026-09-26T00:00:00Z", tasks, habits: [], notes: [], sessions: [],
    settings: {} as Snapshot["settings"], tombstones: tomb,
  });
  const now = new Date().toISOString();
  const local = snap([base({ id: "a", title: "new", updatedAt: now })], { b: now });
  const remote = snap([base({ id: "a", title: "old", updatedAt: "2026-01-01" }), base({ id: "b", updatedAt: "2026-01-01" })]);
  const m = mergeSnapshots(local, remote);
  assert.deepEqual(m.tasks.map((t) => t.title), ["new"]);
});

test("planner overlap layout assigns lanes", () => {
  const l = layoutDay([
    { id: "a", start: 540, end: 600 },
    { id: "b", start: 560, end: 620 },
    { id: "c", start: 630, end: 660 },
  ]);
  assert.equal(l.get("a")!.lanes, 2);
  assert.equal(l.get("b")!.lane, 1);
  assert.equal(l.get("c")!.lanes, 1);
});

test("markdown helpers", () => {
  assert.equal(toggleNthCheckbox("- [ ] a\n- [ ] b", 1), "- [ ] a\n- [x] b");
  const c = continueList({ text: "1. first", start: 8, end: 8 });
  assert.equal(c?.insert, "\n2. ");
});
