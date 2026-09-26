"use client";

import { create } from "zustand";
import type {
  Deck,
  Flashcard,
  ReviewLog,
  DayKey,
  FocusSession,
  Habit,
  ID,
  Note,
  OccurrenceOverride,
  Settings,
  Snapshot,
  Task,
  TaskOccurrence,
  TaskStatus,
} from "@/domain/types";
import { uid } from "@/lib/utils";
import { createSeed, DEFAULT_SETTINGS } from "./seed";
import { seedLearning } from "./seed-learning";
import { ACCOUNTS, DEFAULT_ACCOUNT_ID } from "./accounts";
import { httpRemote, localCache, type RemoteStore } from "./sync/adapter";
import { mergeSnapshots } from "./sync/merge";
import { newMemory, review as srsReview, type MemoryState, type Rating } from "@/domain/srs";
import { toKey } from "@/lib/dates";

export type SyncState = "idle" | "pending" | "syncing" | "offline" | "error";

interface DataState {
  accountId: string;
  hydrated: boolean;
  rev: number;
  updatedAt: string;
  tasks: Task[];
  habits: Habit[];
  notes: Note[];
  sessions: FocusSession[];
  decks: Deck[];
  cards: Flashcard[];
  reviews: ReviewLog[];
  settings: Settings;
  tombstones: Record<ID, string>;
  sync: { state: SyncState; lastSyncedAt?: string; error?: string };
}

interface DataActions {
  hydrate(accountId: string): Promise<void>;
  refresh(): Promise<void>;
  resetDemo(): void;

  addTask(input: Partial<Task> & { title: string }): Task;
  updateTask(id: ID, patch: Partial<Task>): void;
  deleteTasks(ids: ID[]): Task[];
  restoreTasks(tasks: Task[]): void;
  setTasksStatus(ids: ID[], status: TaskStatus): void;
  setOccurrenceStatus(occ: TaskOccurrence, status: TaskStatus): void;
  patchOccurrence(occ: TaskOccurrence, patch: OccurrenceOverride): void;
  resetOccurrence(occ: TaskOccurrence): void;
  scheduleOccurrence(occ: TaskOccurrence, where: { date: DayKey; start: number | null; duration?: number }, scope?: "this" | "series"): void;

  addHabit(input: Omit<Habit, "id" | "log" | "createdAt" | "updatedAt">): Habit;
  updateHabit(id: ID, patch: Partial<Habit>): void;
  deleteHabit(id: ID): Habit | undefined;
  restoreHabit(h: Habit): void;
  toggleHabit(id: ID, day: DayKey): boolean;

  createNote(input?: Partial<Note>): Note;
  saveNote(id: ID, content: { title: string; body: string }): void;
  updateNoteMeta(id: ID, patch: Partial<Pick<Note, "pinned" | "color" | "state">>): void;
  duplicateNote(id: ID): Note | undefined;
  deleteNoteForever(id: ID): void;
  emptyTrash(): void;

  addSession(s: Omit<FocusSession, "id">): void;

  addDeck(input: Omit<Deck, "id" | "createdAt" | "updatedAt">): Deck;
  updateDeck(id: ID, patch: Partial<Deck>): void;
  deleteDeck(id: ID): { deck: Deck; cards: Flashcard[] } | undefined;
  restoreDeck(payload: { deck: Deck; cards: Flashcard[] }): void;
  addCards(inputs: (Pick<Flashcard, "deckId" | "front" | "back"> & Partial<Flashcard>)[]): Flashcard[];
  updateCard(id: ID, patch: Partial<Flashcard>): void;
  deleteCards(ids: ID[]): Flashcard[];
  restoreCards(cards: Flashcard[]): void;
  /** Grade a card; returns the log + previous memory (for undo). */
  gradeCard(id: ID, rating: Rating, ms?: number): { log: ReviewLog; prev: MemoryState } | undefined;
  undoGrade(cardId: ID, prev: MemoryState, logId: ID): void;
  resetCard(id: ID): void;
  updateSettings(patch: Partial<Settings>): void;
}

export type AppStore = DataState & DataActions;

const nowIso = () => new Date().toISOString();
const remote: RemoteStore = httpRemote;

const EMPTY: Omit<DataState, "accountId" | "sync" | "hydrated"> = {
  rev: 0,
  updatedAt: nowIso(),
  tasks: [],
  habits: [],
  notes: [],
  sessions: [],
  decks: [],
  cards: [],
  reviews: [],
  settings: DEFAULT_SETTINGS,
  tombstones: {},
};

function toSnapshot(s: DataState): Snapshot {
  return {
    version: 1,
    rev: s.rev,
    updatedAt: s.updatedAt,
    tasks: s.tasks,
    habits: s.habits,
    notes: s.notes,
    sessions: s.sessions,
    decks: s.decks,
    cards: s.cards,
    reviews: s.reviews,
    settings: s.settings,
    tombstones: s.tombstones,
  };
}

function fromSnapshot(s: Snapshot) {
  return {
    rev: s.rev,
    updatedAt: s.updatedAt,
    tasks: s.tasks,
    habits: s.habits,
    notes: s.notes,
    sessions: s.sessions,
    decks: s.decks ?? [],
    cards: s.cards ?? [],
    reviews: s.reviews ?? [],
    settings: { ...DEFAULT_SETTINGS, ...s.settings },
    tombstones: s.tombstones ?? {},
  };
}

// ── sync engine ────────────────────────────────────────────────
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;
let pullAbort: AbortController | undefined;

export const useApp = create<AppStore>()((set, get) => {
  /** Commit a mutation: bump timestamp, write-through to the local cache, schedule a cloud push. */
  const commit = (fn: (s: AppStore) => Partial<DataState>) => {
    set((s) => ({ ...fn(s), updatedAt: nowIso(), sync: { ...s.sync, state: "pending" } }));
    const s = get();
    localCache.write(s.accountId, toSnapshot(s));
    schedulePush();
  };

  const schedulePush = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), 900);
  };

  const push = async (): Promise<void> => {
    if (inflight) {
      await inflight;
      return push();
    }
    const s = get();
    const account = s.accountId;
    inflight = (async () => {
      set((st) => ({ sync: { ...st.sync, state: "syncing" } }));
      try {
        const snap = toSnapshot(get());
        const res = await remote.push(account, snap, snap.rev);
        if (get().accountId !== account) return;
        if (res.ok) {
          set((st) => ({ rev: res.rev, sync: { state: st.sync.state === "syncing" ? "idle" : st.sync.state, lastSyncedAt: nowIso() } }));
        } else {
          const merged = mergeSnapshots(toSnapshot(get()), res.conflict);
          set({ ...fromSnapshot(merged) });
          const retry = await remote.push(account, merged, merged.rev);
          if (retry.ok) set({ rev: retry.rev, sync: { state: "idle", lastSyncedAt: nowIso() } });
        }
        localCache.write(account, toSnapshot(get()));
      } catch (e) {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        set({ sync: { state: offline ? "offline" : "error", error: (e as Error).message, lastSyncedAt: get().sync.lastSyncedAt } });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  const mapTask = (id: ID, fn: (t: Task) => Task) => (s: AppStore) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...fn(t), updatedAt: nowIso() } : t)),
  });

  const patchOverride = (occ: TaskOccurrence, patch: OccurrenceOverride | null) =>
    mapTask(occ.taskId, (t) => {
      const overrides = { ...(t.overrides ?? {}) };
      if (patch === null) delete overrides[occ.originalDate];
      else {
        const merged = { ...overrides[occ.originalDate], ...patch };
        if (merged.date === occ.originalDate) delete merged.date;
        overrides[occ.originalDate] = merged;
      }
      return { ...t, overrides };
    });

  return {
    accountId: DEFAULT_ACCOUNT_ID,
    hydrated: false,
    ...EMPTY,
    sync: { state: "idle" },

    async hydrate(accountId) {
      clearTimeout(pushTimer);
      pullAbort?.abort();
      const acct = ACCOUNTS.find((a) => a.id === accountId) ?? ACCOUNTS[0];
      // 1) instant paint from the account-scoped device cache
      const cached = localCache.read(acct.id);
      set({
        accountId: acct.id,
        ...(cached ? fromSnapshot(cached) : EMPTY),
        hydrated: !!cached,
        sync: { state: "syncing" },
      });
      // 2) reconcile with the cloud copy
      try {
        pullAbort = new AbortController();
        const cloud = await remote.pull(acct.id, pullAbort.signal);
        if (get().accountId !== acct.id) return;
        let next: Snapshot;
        if (!cloud && !cached) next = createSeed(acct.id, acct.name.split(" ")[0], acct.flavor);
        else if (!cloud) next = cached!;
        else if (!cached) next = cloud;
        else next = cloud.rev === cached.rev && cached.updatedAt <= cloud.updatedAt ? cloud : mergeSnapshots(cached, cloud);
        // Migration: snapshots created before Learning existed get starter decks.
        const migrated = next.decks === undefined;
        if (migrated) next = { ...next, ...seedLearning(acct.id, acct.flavor), updatedAt: nowIso() };
        set({ ...fromSnapshot(next), hydrated: true, sync: { state: "idle", lastSyncedAt: nowIso() } });
        localCache.write(acct.id, next);
        if (!cloud || next !== cloud || migrated) await push();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (!cached) {
          const seed = createSeed(acct.id, acct.name.split(" ")[0], acct.flavor);
          set({ ...fromSnapshot(seed) });
          localCache.write(acct.id, seed);
        }
        set({ hydrated: true, sync: { state: navigator.onLine ? "error" : "offline", error: (e as Error).message } });
      }
    },

    async refresh() {
      const s = get();
      if (!s.hydrated || s.sync.state === "syncing" || s.sync.state === "pending") return;
      try {
        const cloud = await remote.pull(s.accountId);
        if (!cloud || cloud.rev <= get().rev) return;
        const merged = mergeSnapshots(toSnapshot(get()), cloud);
        set({ ...fromSnapshot(merged), sync: { state: "idle", lastSyncedAt: nowIso() } });
        localCache.write(s.accountId, merged);
      } catch {
        /* quiet background refresh */
      }
    },

    resetDemo() {
      const acct = ACCOUNTS.find((a) => a.id === get().accountId) ?? ACCOUNTS[0];
      const seed = createSeed(acct.id, acct.name.split(" ")[0], acct.flavor);
      commit(() => ({ ...fromSnapshot({ ...seed, rev: get().rev }) }));
    },

    // ── tasks ────────────────────────────────────────────────
    addTask(input) {
      const t: Task = {
        id: uid("t"),
        status: "todo",
        tone: "slate",
        duration: 30,
        start: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input,
        title: input.title.trim() || "Untitled task",
      };
      commit((s) => ({ tasks: [...s.tasks, t] }));
      return t;
    },
    updateTask(id, patch) {
      commit(
        mapTask(id, (t) => {
          const next = { ...t, ...patch };
          if (patch.status === "done" && t.status !== "done") next.completedAt = nowIso();
          if (patch.status && patch.status !== "done") next.completedAt = undefined;
          return next;
        }),
      );
    },
    deleteTasks(ids) {
      const set_ = new Set(ids);
      const removed = get().tasks.filter((t) => set_.has(t.id));
      const at = nowIso();
      commit((s) => ({
        tasks: s.tasks.filter((t) => !set_.has(t.id)),
        tombstones: { ...s.tombstones, ...Object.fromEntries(ids.map((i) => [i, at])) },
      }));
      return removed;
    },
    restoreTasks(tasks) {
      const at = nowIso();
      commit((s) => {
        const tomb = { ...s.tombstones };
        tasks.forEach((t) => delete tomb[t.id]);
        return { tasks: [...s.tasks, ...tasks.map((t) => ({ ...t, updatedAt: at }))], tombstones: tomb };
      });
    },
    setTasksStatus(ids, status) {
      const set_ = new Set(ids);
      const at = nowIso();
      commit((s) => ({
        tasks: s.tasks.map((t) =>
          set_.has(t.id) && !t.recurrence
            ? { ...t, status, updatedAt: at, completedAt: status === "done" ? at : undefined }
            : t,
        ),
      }));
    },
    setOccurrenceStatus(occ, status) {
      if (!occ.recurring) return get().updateTask(occ.taskId, { status });
      commit(patchOverride(occ, { status, skipped: false }));
    },
    patchOccurrence(occ, patch) {
      if (!occ.recurring) {
        const p: Partial<Task> = {};
        if (patch.status) p.status = patch.status;
        if (patch.date) p.date = patch.date;
        if ("start" in patch) p.start = patch.start;
        if (patch.duration) p.duration = patch.duration;
        if (patch.title) p.title = patch.title;
        return get().updateTask(occ.taskId, p);
      }
      commit(patchOverride(occ, patch));
    },
    resetOccurrence(occ) {
      commit(patchOverride(occ, null));
    },
    scheduleOccurrence(occ, where, scope = "this") {
      if (!occ.recurring) {
        return get().updateTask(occ.taskId, { date: where.date, start: where.start, ...(where.duration ? { duration: where.duration } : {}) });
      }
      if (scope === "series") {
        return commit(
          mapTask(occ.taskId, (t) => ({
            ...t,
            start: where.start,
            ...(where.duration ? { duration: where.duration } : {}),
          })),
        );
      }
      commit(patchOverride(occ, { date: where.date, start: where.start, ...(where.duration ? { duration: where.duration } : {}) }));
    },

    // ── habits ───────────────────────────────────────────────
    addHabit(input) {
      const h: Habit = { ...input, id: uid("h"), log: [], createdAt: nowIso(), updatedAt: nowIso() };
      commit((s) => ({ habits: [...s.habits, h] }));
      return h;
    },
    updateHabit(id, patch) {
      commit((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: nowIso() } : h)) }));
    },
    deleteHabit(id) {
      const h = get().habits.find((x) => x.id === id);
      commit((s) => ({ habits: s.habits.filter((x) => x.id !== id), tombstones: { ...s.tombstones, [id]: nowIso() } }));
      return h;
    },
    restoreHabit(h) {
      commit((s) => {
        const tomb = { ...s.tombstones };
        delete tomb[h.id];
        return { habits: [...s.habits, { ...h, updatedAt: nowIso() }], tombstones: tomb };
      });
    },
    toggleHabit(id, day) {
      let nowDone = false;
      commit((s) => ({
        habits: s.habits.map((h) => {
          if (h.id !== id) return h;
          const has = h.log.includes(day);
          nowDone = !has;
          return { ...h, log: has ? h.log.filter((d) => d !== day) : [...h.log, day].sort(), updatedAt: nowIso() };
        }),
      }));
      return nowDone;
    },

    // ── notes ────────────────────────────────────────────────
    createNote(input) {
      const n: Note = {
        id: uid("n"),
        title: "",
        body: "",
        color: "none",
        pinned: false,
        state: "active",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input,
      };
      commit((s) => ({ notes: [n, ...s.notes] }));
      return n;
    },
    saveNote(id, content) {
      commit((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...content, updatedAt: nowIso() } : n)) }));
    },
    updateNoteMeta(id, patch) {
      commit((s) => ({
        notes: s.notes.map((n) =>
          n.id === id
            ? { ...n, ...patch, updatedAt: nowIso(), trashedAt: patch.state === "trashed" ? nowIso() : patch.state ? undefined : n.trashedAt }
            : n,
        ),
      }));
    },
    duplicateNote(id) {
      const src = get().notes.find((n) => n.id === id);
      if (!src) return;
      return get().createNote({ title: `${src.title || "Untitled"} (copy)`, body: src.body, color: src.color, state: "active" });
    },
    deleteNoteForever(id) {
      commit((s) => ({ notes: s.notes.filter((n) => n.id !== id), tombstones: { ...s.tombstones, [id]: nowIso() } }));
    },
    emptyTrash() {
      const at = nowIso();
      commit((s) => {
        const trashed = s.notes.filter((n) => n.state === "trashed");
        return {
          notes: s.notes.filter((n) => n.state !== "trashed"),
          tombstones: { ...s.tombstones, ...Object.fromEntries(trashed.map((n) => [n.id, at])) },
        };
      });
    },

    // ── learning ─────────────────────────────────────────────
    addDeck(input) {
      const d: Deck = { ...input, id: uid("d"), createdAt: nowIso(), updatedAt: nowIso() };
      commit((s) => ({ decks: [...s.decks, d] }));
      return d;
    },
    updateDeck(id, patch) {
      commit((s) => ({ decks: s.decks.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d)) }));
    },
    deleteDeck(id) {
      const deck = get().decks.find((d) => d.id === id);
      if (!deck) return;
      const cards = get().cards.filter((c) => c.deckId === id);
      const at = nowIso();
      commit((s) => ({
        decks: s.decks.filter((d) => d.id !== id),
        cards: s.cards.filter((c) => c.deckId !== id),
        tombstones: { ...s.tombstones, [id]: at, ...Object.fromEntries(cards.map((c) => [c.id, at])) },
      }));
      return { deck, cards };
    },
    restoreDeck({ deck, cards }) {
      const at = nowIso();
      commit((s) => {
        const tomb = { ...s.tombstones };
        delete tomb[deck.id];
        cards.forEach((c) => delete tomb[c.id]);
        return { decks: [...s.decks, { ...deck, updatedAt: at }], cards: [...s.cards, ...cards.map((c) => ({ ...c, updatedAt: at }))], tombstones: tomb };
      });
    },
    addCards(inputs) {
      const at = nowIso();
      const made: Flashcard[] = inputs.map((i) => ({
        tags: [],
        source: { kind: "manual" },
        ...i,
        front: i.front.trim(),
        back: i.back.trim(),
        id: uid("c"),
        memory: newMemory(),
        createdAt: at,
        updatedAt: at,
      }));
      commit((s) => ({ cards: [...s.cards, ...made] }));
      return made;
    },
    updateCard(id, patch) {
      commit((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)) }));
    },
    deleteCards(ids) {
      const set_ = new Set(ids);
      const removed = get().cards.filter((c) => set_.has(c.id));
      const at = nowIso();
      commit((s) => ({ cards: s.cards.filter((c) => !set_.has(c.id)), tombstones: { ...s.tombstones, ...Object.fromEntries(ids.map((i) => [i, at])) } }));
      return removed;
    },
    restoreCards(cards) {
      commit((s) => {
        const tomb = { ...s.tombstones };
        cards.forEach((c) => delete tomb[c.id]);
        return { cards: [...s.cards, ...cards.map((c) => ({ ...c, updatedAt: nowIso() }))], tombstones: tomb };
      });
    },
    gradeCard(id, rating, ms) {
      const card = get().cards.find((c) => c.id === id);
      if (!card) return;
      const now = new Date();
      const prev = card.memory;
      const next = srsReview(prev, rating, now);
      const elapsed = prev.lastReview ? (now.getTime() - new Date(prev.lastReview).getTime()) / 864e5 : 0;
      const log: ReviewLog = {
        id: uid("r"),
        cardId: id,
        deckId: card.deckId,
        rating,
        prevState: prev.state,
        elapsedDays: Math.round(elapsed * 10) / 10,
        scheduledDays: Math.round(((new Date(next.due).getTime() - now.getTime()) / 864e5) * 100) / 100,
        day: toKey(now),
        at: now.toISOString(),
        ms,
      };
      commit((s) => ({
        cards: s.cards.map((c) => (c.id === id ? { ...c, memory: next, updatedAt: now.toISOString() } : c)),
        reviews: [...s.reviews, log],
      }));
      return { log, prev };
    },
    undoGrade(cardId, prev, logId) {
      commit((s) => ({
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, memory: prev, updatedAt: nowIso() } : c)),
        reviews: s.reviews.filter((r) => r.id !== logId),
        tombstones: { ...s.tombstones, [logId]: nowIso() },
      }));
    },
    resetCard(id) {
      commit((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, memory: newMemory(), updatedAt: nowIso() } : c)) }));
    },

    addSession(sess) {
      commit((s) => ({ sessions: [...s.sessions, { ...sess, id: uid("f") }] }));
    },
    updateSettings(patch) {
      commit((s) => ({ settings: { ...s.settings, ...patch } }));
    },
  };
});

/** Flush pending writes when the tab hides (best-effort). */
export function flushSync() {
  const s = useApp.getState();
  if (s.sync.state === "pending") {
    clearTimeout(pushTimer);
    const snap = toSnapshot(s);
    try {
      navigator.sendBeacon?.(`/api/sync/${s.accountId}?rev=${snap.rev}`, new Blob([JSON.stringify(snap)], { type: "application/json" }));
    } catch {
      /* ignore */
    }
  }
}
