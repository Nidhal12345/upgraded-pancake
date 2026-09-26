import type { DayKey, Deck, Flashcard, ID, ReviewLog } from "./types";
import { isLearned, memoryStrength } from "./srs";
import { addDaysKey, rangeKeys, toKey, todayKey } from "@/lib/dates";

/** End of the local day — cards due before this count as "due today". */
export function endOfDay(now = new Date()) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export const isDue = (c: Flashcard, now = new Date()) =>
  !c.suspended && c.memory.state !== "new" && new Date(c.memory.due).getTime() <= endOfDay(now).getTime();

/** Learning-step cards are "due now" only when their minute timer has elapsed. */
export const isDueNow = (c: Flashcard, now = new Date()) =>
  !c.suspended && c.memory.state !== "new" && new Date(c.memory.due).getTime() <= now.getTime();

export interface DeckCounts {
  total: number;
  newCards: number;
  learning: number;
  due: number;
  learned: number;
  newToday: number; // new cards available today (respecting the daily limit)
  strength: number; // mean memory strength of reviewed cards
}

/** New cards first-reviewed today, per deck (to enforce daily new-card limits). */
export function newIntroducedToday(reviews: ReviewLog[], day = todayKey()) {
  const m = new Map<ID, number>();
  for (const r of reviews) if (r.day === day && r.prevState === "new") m.set(r.deckId, (m.get(r.deckId) ?? 0) + 1);
  return m;
}

export function deckCounts(deck: Deck, cards: Flashcard[], reviews: ReviewLog[], now = new Date()): DeckCounts {
  const mine = cards.filter((c) => c.deckId === deck.id && !c.suspended);
  const introduced = newIntroducedToday(reviews, toKey(now)).get(deck.id) ?? 0;
  let newCards = 0, learning = 0, due = 0, learned = 0, sum = 0, seen = 0;
  for (const c of mine) {
    if (c.memory.state === "new") newCards++;
    else {
      seen++;
      sum += memoryStrength(c.memory, now);
      if (c.memory.state === "learning" || c.memory.state === "relearning") learning++;
      if (isDue(c, now)) due++;
      if (isLearned(c.memory)) learned++;
    }
  }
  return {
    total: mine.length,
    newCards,
    learning,
    due,
    learned,
    newToday: Math.max(0, Math.min(newCards, deck.newPerDay - introduced)),
    strength: seen ? sum / seen : 0,
  };
}

/**
 * Build a review session: due reviews first (most-forgotten first, so the
 * weakest memories get attention while energy is highest), interleaved with
 * today's allowance of new cards (1 new per ~3 reviews), capped by `limit`.
 */
export function buildQueue(
  decks: Deck[],
  cards: Flashcard[],
  reviews: ReviewLog[],
  opts: { deckIds?: ID[]; limit?: number; includeNew?: boolean; cram?: boolean; now?: Date } = {},
): ID[] {
  const now = opts.now ?? new Date();
  const allowed = new Set((opts.deckIds?.length ? opts.deckIds : decks.filter((d) => !d.archived).map((d) => d.id)));
  const pool = cards.filter((c) => allowed.has(c.deckId) && !c.suspended);

  if (opts.cram) {
    // Practice mode: weakest cards regardless of schedule.
    return pool
      .filter((c) => c.memory.state !== "new")
      .sort((a, b) => memoryStrength(a.memory, now) - memoryStrength(b.memory, now))
      .slice(0, opts.limit ?? 20)
      .map((c) => c.id);
  }

  const due = pool
    .filter((c) => isDue(c, now))
    .sort((a, b) => memoryStrength(a.memory, now) - memoryStrength(b.memory, now));

  const fresh: Flashcard[] = [];
  if (opts.includeNew !== false) {
    const introduced = newIntroducedToday(reviews, toKey(now));
    for (const d of decks) {
      if (!allowed.has(d.id)) continue;
      const room = Math.max(0, d.newPerDay - (introduced.get(d.id) ?? 0));
      fresh.push(
        ...pool
          .filter((c) => c.deckId === d.id && c.memory.state === "new")
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
          .slice(0, room),
      );
    }
  }

  const out: ID[] = [];
  let i = 0, j = 0;
  while (i < due.length || j < fresh.length) {
    for (let k = 0; k < 3 && i < due.length; k++) out.push(due[i++].id);
    if (j < fresh.length) out.push(fresh[j++].id);
  }
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export interface LearningStats {
  reviewedToday: number;
  correctToday: number;
  streak: number;
  bestStreak: number;
  accuracy7: number;
  accuracy30: number;
  totalReviews: number;
  learned: number;
  newCards: number;
  dueToday: number;
  strength: number;
  history: { day: DayKey; reviews: number; correct: number }[];
  forecast: { day: DayKey; count: number }[];
}

/** Learning streak: consecutive days with ≥1 review; today doesn't break it. */
export function learningStreak(reviews: ReviewLog[], today = todayKey()) {
  const days = new Set(reviews.map((r) => r.day));
  let cur = 0;
  let d = days.has(today) ? today : addDaysKey(today, -1);
  while (days.has(d)) {
    cur++;
    d = addDaysKey(d, -1);
  }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = "";
  for (const k of sorted) {
    run = prev && addDaysKey(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current: cur, best: Math.max(best, cur) };
}

export function learningStats(cards: Flashcard[], reviews: ReviewLog[], now = new Date()): LearningStats {
  const today = toKey(now);
  const active = cards.filter((c) => !c.suspended);
  const todayLogs = reviews.filter((r) => r.day === today);
  const acc = (days: number) => {
    const from = addDaysKey(today, -(days - 1));
    const l = reviews.filter((r) => r.day >= from);
    return l.length ? l.filter((r) => r.rating > 1).length / l.length : 0;
  };
  const seen = active.filter((c) => c.memory.state !== "new");
  const history = rangeKeys(addDaysKey(today, -27), 28).map((day) => {
    const l = reviews.filter((r) => r.day === day);
    return { day, reviews: l.length, correct: l.filter((r) => r.rating > 1).length };
  });
  const forecast = rangeKeys(today, 14).map((day, i) => ({
    day,
    count: active.filter((c) => {
      if (c.memory.state === "new") return false;
      const k = toKey(new Date(c.memory.due));
      return i === 0 ? k <= day : k === day;
    }).length,
  }));
  const s = learningStreak(reviews, today);
  return {
    reviewedToday: todayLogs.length,
    correctToday: todayLogs.filter((r) => r.rating > 1).length,
    streak: s.current,
    bestStreak: s.best,
    accuracy7: acc(7),
    accuracy30: acc(30),
    totalReviews: reviews.length,
    learned: active.filter((c) => isLearned(c.memory)).length,
    newCards: active.filter((c) => c.memory.state === "new").length,
    dueToday: active.filter((c) => isDue(c, now)).length,
    strength: seen.length ? seen.reduce((n, c) => n + memoryStrength(c.memory, now), 0) / seen.length : 0,
    history,
    forecast,
  };
}

/** Normalise a free-text tag list. */
export function parseTags(s: string) {
  return [...new Set(s.split(/[,#\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

/**
 * Extract card candidates from markdown text:
 *   "Term :: definition", "Term — definition", "**Term**: definition",
 *   "Q: … / A: …", and "- Term: definition" list items.
 */
export function extractCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "").trim();
    if (!l) continue;
    const qa = l.match(/^Q[:.]\s*(.+)$/i);
    if (qa && lines[i + 1]?.trim().match(/^A[:.]\s*(.+)$/i)) {
      out.push({ front: qa[1].trim(), back: lines[i + 1].trim().replace(/^A[:.]\s*/i, "") });
      i++;
      continue;
    }
    const m = l.match(/^\*{0,2}([^:*—–]{2,80}?)\*{0,2}\s*(?:::|—|–|:)\s+(.{2,})$/);
    if (m && !/^https?$/i.test(m[1].trim())) out.push({ front: m[1].replace(/\*\*/g, "").trim(), back: m[2].replace(/\*\*/g, "").trim() });
  }
  return out.slice(0, 50);
}
