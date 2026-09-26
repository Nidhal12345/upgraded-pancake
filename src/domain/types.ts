/**
 * Core domain model. Everything is plain serialisable data so the same shapes
 * can be persisted locally today and sent to an API / database later.
 * Dates are ISO day keys ("2026-09-26"); times are minutes from midnight.
 */

export type ID = string;
export type DayKey = string; // yyyy-MM-dd

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type Tone = "slate" | "persimmon" | "amber" | "moss" | "teal" | "sky" | "iris" | "rose";

export type RecurrenceFreq = "daily" | "weekdays" | "weekly" | "monthly" | "custom";

export interface Recurrence {
  freq: RecurrenceFreq;
  /** 0=Sun … 6=Sat. Used by weekly (single day, derived) and custom. */
  days?: number[];
  /** Repeat every N units (weeks for weekly/custom, months for monthly, days for daily). */
  interval?: number;
  /** Inclusive last day for the series. */
  until?: DayKey;
}

/** A per-occurrence change to a recurring series (keyed by the original day). */
export interface OccurrenceOverride {
  status?: TaskStatus;
  /** "skipped" hides the occurrence without treating it as a failure. */
  skipped?: boolean;
  date?: DayKey;
  start?: number | null;
  duration?: number;
  title?: string;
}

export interface Task {
  id: ID;
  title: string;
  notes?: string;
  status: TaskStatus;
  /** Scheduled day. Undefined = inbox / unscheduled. For recurring: series anchor. */
  date?: DayKey;
  /** Minutes from 00:00. null/undefined = "anytime". */
  start?: number | null;
  /** Minutes. */
  duration?: number;
  tone: Tone;
  project?: string;
  recurrence?: Recurrence;
  overrides?: Record<DayKey, OccurrenceOverride>;
  /** Minutes before start to remind. */
  reminder?: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** A concrete instance of a task on a given day (expanded from a series). */
export interface TaskOccurrence {
  key: string; // `${taskId}:${originalDate}`
  taskId: ID;
  task: Task;
  /** Original series day (identity of the occurrence). */
  originalDate: DayKey;
  /** Displayed day (may differ when moved). */
  date: DayKey;
  start: number | null;
  duration: number;
  title: string;
  status: TaskStatus;
  recurring: boolean;
  moved: boolean;
}

export type HabitSchedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] }
  | { kind: "weekly"; times: number };

export interface Habit {
  id: ID;
  name: string;
  icon: string; // lucide icon key from HABIT_ICONS
  tone: Tone;
  schedule: HabitSchedule;
  /** Optional preferred time (minutes) — renders inside the planner. */
  time?: number | null;
  reminder?: boolean;
  /** Days on which the habit was checked in. */
  log: DayKey[];
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export type NoteColor = "none" | Tone;
export type NoteState = "active" | "archived" | "trashed";

export interface Note {
  id: ID;
  title: string;
  body: string; // markdown
  color: NoteColor;
  pinned: boolean;
  state: NoteState;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string;
}

export type FocusMode = "focus" | "short" | "long";

export interface FocusSession {
  id: ID;
  mode: FocusMode;
  minutes: number;
  endedAt: string;
  day: DayKey;
  label?: string;
}

export interface Settings {
  weekStartsOn: 0 | 1;
  plannerStartHour: number;
  plannerEndHour: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  theme: "light" | "dark" | "system";
  name: string;
  /** Daily learning goal (reviews). */
  learnGoal: number;
}

/** Full persisted state for one account. */
export interface Snapshot {
  version: 1;
  rev: number;
  updatedAt: string;
  tasks: Task[];
  habits: Habit[];
  notes: Note[];
  sessions: FocusSession[];
  settings: Settings;
  decks?: Deck[];
  cards?: Flashcard[];
  reviews?: ReviewLog[];
  /** id → deletion time, so merges don't resurrect deleted entities. */
  tombstones: Record<ID, string>;
}

export interface Account {
  id: ID;
  name: string;
  email: string;
  initials: string;
  tone: Tone;
}

// ── Learning ──────────────────────────────────────────────────────────
export interface Deck {
  id: ID;
  name: string;
  description?: string;
  icon: string; // key into DECK_ICONS
  tone: Tone;
  /** New cards introduced per day from this deck. */
  newPerDay: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export type CardSource = { kind: "note" | "task" | "manual"; id?: ID; label?: string };

export interface Flashcard {
  id: ID;
  deckId: ID;
  front: string; // word, concept or question
  back: string; // answer or explanation
  example?: string;
  note?: string;
  tags: string[];
  source?: CardSource;
  suspended?: boolean;
  /** Spaced-repetition memory model (see domain/srs.ts). */
  memory: import("./srs").MemoryState;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewLog {
  id: ID;
  cardId: ID;
  deckId: ID;
  rating: 1 | 2 | 3 | 4;
  /** State the card was in *before* this review. */
  prevState: import("./srs").CardState;
  /** Days between the previous review and this one. */
  elapsedDays: number;
  /** Interval scheduled by this review, in days (fractions for minutes). */
  scheduledDays: number;
  day: DayKey;
  at: string;
  ms?: number; // time to answer
}
