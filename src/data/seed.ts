import type { Habit, Note, FocusSession, Settings, Snapshot, Task, Tone, DayKey, TaskStatus } from "@/domain/types";
import { addDaysKey, todayKey, weekdayOf } from "@/lib/dates";
import { isScheduledOn } from "@/domain/habits";
import { seedLearning } from "./seed-learning";

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
  plannerStartHour: 5,
  plannerEndHour: 24,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  theme: "system",
  name: "Maya",
  learnGoal: 20,
};

/** Deterministic PRNG so seeded content is stable per account. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const H = (h: number, m = 0) => h * 60 + m;

export function createSeed(accountId: string, name: string, flavor: "personal" | "studio"): Snapshot {
  const today = todayKey();
  const now = new Date().toISOString();
  const rand = rng(accountId.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  let n = 0;
  const id = (p: string) => `${p}_${accountId.slice(0, 3)}${(++n).toString(36)}`;
  const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

  const t = (
    title: string,
    offset: number | null,
    start: number | null,
    duration: number,
    tone: Tone,
    extra: Partial<Task> = {},
  ): Task => {
    const date = offset == null ? undefined : addDaysKey(today, offset);
    let status: TaskStatus = "todo";
    if (offset != null && offset < 0) status = rand() < 0.82 ? "done" : rand() < 0.5 ? "cancelled" : "todo";
    return {
      id: id("t"),
      title,
      status,
      date,
      start,
      duration,
      tone,
      reminder: start != null ? 10 : null,
      createdAt: ago(40),
      updatedAt: ago(Math.max(0, -(offset ?? 0))),
      completedAt: status === "done" && date ? `${date}T17:00:00.000Z` : undefined,
      ...extra,
    };
  };

  const recurringOverrides = (days: number, prob: number, weekdaysOnly = false) => {
    const o: Task["overrides"] = {};
    for (let i = 1; i <= days; i++) {
      const k = addDaysKey(today, -i);
      if (weekdaysOnly && (weekdayOf(k) === 0 || weekdayOf(k) === 6)) continue;
      const r = rand();
      if (r < prob) o[k] = { status: "done" };
      else if (r < prob + 0.05) o[k] = { skipped: true };
    }
    return o;
  };

  const personal = flavor === "personal";
  const tasks: Task[] = personal
    ? [
        // today
        t("Draft Q4 roadmap narrative", 0, H(9, 30), 90, "persimmon", { project: "Northwind", notes: "Frame around the three bets: onboarding, sync, pricing." }),
        t("Design review — onboarding flow v3", 0, H(13), 60, "iris", { project: "Northwind", status: "in_progress" }),
        t("Call with Priya about the Lisbon offsite", 0, H(16, 30), 30, "sky"),
        t("Pick up dry cleaning", 0, null, 15, "slate"),
        t("Reply to Jonas re: contract renewal", 0, null, 15, "amber", { status: "done", completedAt: now }),
        t("Order birthday gift for Sam", 0, null, 15, "rose"),
        // this week / upcoming
        t("Quarterly metrics deep-dive", 1, H(10), 120, "teal", { project: "Northwind" }),
        t("Dentist", 1, H(15, 30), 45, "slate"),
        t("Write customer interview synthesis", 2, H(9), 90, "persimmon", { project: "Research" }),
        t("1:1 with Elena", 2, H(14), 30, "sky"),
        t("Book flights to Lisbon", 2, null, 20, "amber"),
        t("Pricing workshop", 3, H(11), 120, "iris", { project: "Northwind" }),
        t("Clean up Figma library", 3, null, 45, "iris"),
        t("Dinner with Theo & Ines", 4, H(19, 30), 150, "rose"),
        t("Farmers market", 5, H(9), 60, "moss"),
        t("Long run — 14 km", 6, H(8), 90, "moss"),
        t("Board prep: financial summary", 8, H(10), 90, "teal", { project: "Northwind" }),
        t("Renew passport", 10, null, 30, "slate"),
        t("Lisbon offsite", 15, null, 60, "sky"),
        t("Sort out the 'someday' list", null, null, 30, "slate"),
        t("Research standing desks", null, null, 30, "slate"),
        // recent past
        t("Ship changelog for v2.4", -1, H(11), 60, "persimmon", { project: "Northwind", status: "done" }),
        t("Grocery run", -1, null, 30, "moss", { status: "done" }),
        t("Interview: senior designer candidate", -2, H(14), 60, "iris", { status: "done" }),
        t("Fix the kitchen tap", -2, null, 30, "slate", { status: "cancelled" }),
        t("Prep slides for all-hands", -3, H(9), 90, "persimmon", { status: "done" }),
        t("Coffee with Marco", -3, H(8), 30, "amber", { status: "done" }),
        t("Update investor CRM", -4, null, 30, "teal"),
        t("Tax documents to accountant", -5, null, 20, "slate", { status: "done" }),
        t("Onboarding teardown — competitor apps", -6, H(10), 120, "iris", { status: "done" }),
        t("Hike at Sintra", -7, H(9), 240, "moss", { status: "done" }),
        t("Sprint planning", -8, H(10), 60, "sky", { status: "done" }),
        t("Write hiring scorecard", -9, null, 45, "iris", { status: "done" }),
        t("Draft newsletter", -10, H(9), 60, "persimmon", { status: "done" }),
        t("Call mom", -11, H(19), 30, "rose", { status: "done" }),
        t("Refactor analytics events", -13, H(13), 120, "teal", { status: "done" }),
        t("Research pricing tiers", -15, H(10), 90, "persimmon", { status: "done" }),
        t("Clean inbox to zero", -17, null, 30, "slate", { status: "done" }),
        t("Team retro", -20, H(16), 60, "sky", { status: "done" }),
        // recurring
        t("Daily standup", -35, H(9), 15, "sky", {
          recurrence: { freq: "weekdays" },
          status: "todo",
          overrides: recurringOverrides(35, 0.88, true),
          project: "Northwind",
        }),
        t("Inbox zero sweep", -30, H(17, 30), 20, "slate", {
          recurrence: { freq: "custom", days: [1, 3, 5] },
          status: "todo",
          overrides: recurringOverrides(30, 0.7),
        }),
        t("Weekly review & plan", -28, H(18), 45, "persimmon", {
          recurrence: { freq: "weekly", days: [0] },
          status: "todo",
          overrides: recurringOverrides(28, 0.8),
        }),
        t("Pay rent", -26, null, 10, "amber", {
          recurrence: { freq: "monthly" },
          status: "todo",
        }),
      ]
    : [
        t("Client kickoff — Halden Coffee rebrand", 0, H(10), 60, "persimmon", { project: "Halden" }),
        t("Moodboard round 2", 0, H(13, 30), 120, "iris", { project: "Halden", status: "in_progress" }),
        t("Send invoice #0142", 0, null, 10, "amber"),
        t("Type specimen exploration", 1, H(9), 150, "iris", { project: "Halden" }),
        t("Studio rent", 2, null, 10, "slate"),
        t("Portfolio case study write-up", 3, H(14), 120, "teal"),
        t("Proposal: Arden Botanics", -1, H(11), 90, "persimmon", { status: "done" }),
        t("Print test for packaging", -2, H(15), 60, "moss", { status: "done" }),
        t("Studio sync", -21, H(9, 30), 30, "sky", {
          recurrence: { freq: "custom", days: [1, 4] },
          status: "todo",
          overrides: recurringOverrides(21, 0.85),
        }),
      ];

  const habitLog = (h: Omit<Habit, "log">, prob: number, days: number): Habit => {
    const log: DayKey[] = [];
    const full = { ...h, log } as Habit;
    for (let i = days; i >= 1; i--) {
      const k = addDaysKey(today, -i);
      const bias = i < 12 ? prob + 0.12 : prob; // recent streak momentum
      if (h.schedule.kind === "weekly" ? rand() < h.schedule.times / 7 + 0.05 : isScheduledOn(full, k) && rand() < bias)
        log.push(k);
    }
    return full;
  };

  const habits: Habit[] = personal
    ? [
        habitLog({ id: id("h"), name: "Morning pages", icon: "pen", tone: "persimmon", schedule: { kind: "daily" }, time: H(7), reminder: true, createdAt: ago(120), updatedAt: ago(1) }, 0.86, 120),
        habitLog({ id: id("h"), name: "Read 20 pages", icon: "book", tone: "iris", schedule: { kind: "daily" }, time: H(22), reminder: true, createdAt: ago(90), updatedAt: ago(1) }, 0.74, 90),
        habitLog({ id: id("h"), name: "Strength training", icon: "dumbbell", tone: "moss", schedule: { kind: "weekdays", days: [1, 3, 5] }, time: H(7, 30), createdAt: ago(60), updatedAt: ago(1) }, 0.8, 60),
        habitLog({ id: id("h"), name: "Run", icon: "footprints", tone: "teal", schedule: { kind: "weekly", times: 3 }, createdAt: ago(75), updatedAt: ago(1) }, 0.5, 75),
        habitLog({ id: id("h"), name: "No phone after 22:00", icon: "moon", tone: "sky", schedule: { kind: "daily" }, createdAt: ago(40), updatedAt: ago(1) }, 0.6, 40),
        habitLog({ id: id("h"), name: "Drink 2L water", icon: "droplet", tone: "sky", schedule: { kind: "daily" }, createdAt: ago(20), updatedAt: ago(1) }, 0.7, 20),
      ]
    : [
        habitLog({ id: id("h"), name: "Sketch for 15 minutes", icon: "palette", tone: "iris", schedule: { kind: "daily" }, time: H(8), createdAt: ago(45), updatedAt: ago(1) }, 0.78, 45),
        habitLog({ id: id("h"), name: "Walk outside", icon: "sun", tone: "amber", schedule: { kind: "weekly", times: 4 }, createdAt: ago(30), updatedAt: ago(1) }, 0.6, 30),
      ];

  // Morning pages checked in already today to make the view feel "lived in"
  if (personal) habits[0].log.push(today);

  const notes: Note[] = personal
    ? [
        {
          id: id("n"),
          title: "Q4 roadmap — narrative draft",
          color: "persimmon",
          pinned: true,
          state: "active",
          createdAt: ago(6),
          updatedAt: ago(0.1),
          body: `The theme for the quarter is **fewer, deeper bets**. We said yes to too much in Q3 and it showed in the quality bar.\n\n## Three bets\n\n1. **Onboarding that teaches by doing** — replace the tour with a seeded workspace\n2. **Real-time sync** — conflict-free, offline-first\n3. **Pricing clarity** — one page, two plans, no asterisks\n\n## Open questions\n\n- [x] Do we have design capacity for bet #1?\n- [ ] What does "done" look like for sync?\n- [ ] Who owns pricing comms?\n\n> The best roadmap is the one the team can recite from memory.\n\n| Bet | Owner | Confidence |\n| --- | --- | --- |\n| Onboarding | Elena | High |\n| Sync | Marco | Medium |\n| Pricing | Maya | Medium |\n\nSee the [research repo](https://example.com/research) for interview notes.`,
        },
        {
          id: id("n"),
          title: "Lisbon offsite — logistics",
          color: "sky",
          pinned: true,
          state: "active",
          createdAt: ago(10),
          updatedAt: ago(2),
          body: `**Dates:** mid-October, 3 nights\n\n## To sort out\n\n- [x] Venue shortlist\n- [ ] Flights for 9 people\n- [ ] Dietary requirements form\n- [ ] Day 2 workshop agenda\n\n## Venue shortlist\n\n| Place | Area | Capacity | Notes |\n| --- | --- | --- | --- |\n| Casa do Largo | Alfama | 12 | Rooftop, lovely light |\n| Atelier 44 | LX Factory | 20 | Bit loud |\n\n> Keep day 1 unstructured. People need to arrive before they can think.`,
        },
        {
          id: id("n"),
          title: "Interview synthesis — week 38",
          color: "iris",
          pinned: false,
          state: "active",
          createdAt: ago(4),
          updatedAt: ago(1),
          body: `## Patterns\n\n- Users *love* the weekly view but ~~ignore~~ rarely open the calendar\n- Recurring tasks are the #1 request from power users\n- "I want it to feel calm" came up in **5 of 7** interviews\n\n## Quotes\n\n> "Most tools make me feel behind. I want one that makes me feel caught up."\n\n> "I plan Sunday night. That's the ritual."`,
        },
        {
          id: id("n"),
          title: "Data engineering glossary",
          color: "teal",
          pinned: false,
          state: "active",
          createdAt: ago(5),
          updatedAt: ago(0.6),
          body: `Terms from the pipeline design review. Select any line and press **Make card**, or use *Extract cards*.\n\n- **Idempotent pipeline**: re-running produces the same output without duplicates\n- **Watermark** :: the event-time threshold after which late data is considered complete\n- **Data contract** — an agreed schema + SLA between a producer and its consumers\n- **Backfill**: re-processing historical partitions after a logic change\n\nQ: What is the medallion architecture?\nA: Bronze (raw) → Silver (cleaned) → Gold (business-level) layers.`,
        },
        {
          id: id("n"),
          title: "Books to read",
          color: "moss",
          pinned: false,
          state: "active",
          createdAt: ago(30),
          updatedAt: ago(8),
          body: `- [x] *Four Thousand Weeks* — Oliver Burkeman\n- [ ] *The Creative Act* — Rick Rubin\n- [ ] *Slow Productivity* — Cal Newport\n- [ ] *A Pattern Language* — Christopher Alexander`,
        },
        {
          id: id("n"),
          title: "Weekly review template",
          color: "none",
          pinned: false,
          state: "active",
          createdAt: ago(50),
          updatedAt: ago(14),
          body: `## Look back\n\n- What went well?\n- What drained me?\n\n## Look ahead\n\n- The **one thing** that would make next week a success:\n- What can I say no to?`,
        },
        {
          id: id("n"),
          title: "Old apartment checklist",
          color: "amber",
          pinned: false,
          state: "archived",
          createdAt: ago(200),
          updatedAt: ago(120),
          body: `- [x] Return keys\n- [x] Final meter reading\n- [x] Forward mail`,
        },
        {
          id: id("n"),
          title: "Scratch",
          color: "none",
          pinned: false,
          state: "trashed",
          createdAt: ago(9),
          updatedAt: ago(3),
          trashedAt: ago(3),
          body: `random thoughts — delete me`,
        },
      ]
    : [
        {
          id: id("n"),
          title: "Halden — brand principles",
          color: "persimmon",
          pinned: true,
          state: "active",
          createdAt: ago(3),
          updatedAt: ago(0.2),
          body: `1. **Warm, not rustic**\n2. **Precise, not cold**\n3. Let the product be the hero`,
        },
      ];

  const sessions: FocusSession[] = [];
  for (let i = 1; i <= 21; i++) {
    const day = addDaysKey(today, -i);
    const wd = weekdayOf(day);
    const count = wd === 0 || wd === 6 ? Math.floor(rand() * 2) : 1 + Math.floor(rand() * 4);
    for (let j = 0; j < count; j++)
      sessions.push({ id: id("f"), mode: "focus", minutes: 25, day, endedAt: `${day}T${String(9 + j).padStart(2, "0")}:25:00.000Z` });
  }
  sessions.push({ id: id("f"), mode: "focus", minutes: 25, day: today, endedAt: now, label: "Roadmap narrative" });

  const learning = seedLearning(accountId, flavor);

  return {
    version: 1,
    rev: 0,
    updatedAt: now,
    ...learning,
    tasks,
    habits,
    notes,
    sessions,
    settings: { ...DEFAULT_SETTINGS, name },
    tombstones: {},
  };
}
