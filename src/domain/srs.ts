/**
 * Spaced-repetition scheduler — a compact FSRS-4.5-style memory model.
 *
 * Each card carries two latent variables:
 *   S  stability  — days until recall probability decays to 90 %
 *   D  difficulty — 1 (trivial) … 10 (very hard)
 *
 * Retrievability after t days follows a power forgetting curve:
 *   R(t, S) = (1 + FACTOR · t / S) ^ DECAY
 *
 * After each review we update S and D from the rating and the *current*
 * retrievability (reviewing a card you were about to forget strengthens it
 * more than reviewing one you just saw). The next interval is solved so
 * predicted recall at review time equals the target retention (90 %).
 *
 * New and lapsed cards pass through short (re)learning steps in minutes
 * before graduating to day-based intervals.
 */

export type Rating = 1 | 2 | 3 | 4; // Again · Hard · Good · Easy
export type CardState = "new" | "learning" | "review" | "relearning";

export interface MemoryState {
  state: CardState;
  stability: number; // days
  difficulty: number; // 1..10
  due: string; // ISO datetime
  lastReview?: string; // ISO datetime
  reps: number;
  lapses: number;
  step: number; // index into (re)learning steps
}

// Default FSRS-5 weights (trained on large public review datasets).
const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
export const TARGET_RETENTION = 0.9;
export const MAX_INTERVAL_DAYS = 365 * 3;

const LEARNING_STEPS_MIN = [1, 10]; // new cards
const RELEARNING_STEPS_MIN = [10]; // lapsed cards

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const DAY = 864e5;

export function retrievability(elapsedDays: number, stability: number) {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Interval (days) at which predicted recall hits `retention`. */
export function intervalFor(stability: number, retention = TARGET_RETENTION) {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

const initStability = (r: Rating) => Math.max(0.1, W[r - 1]);
const rawInitDifficulty = (r: Rating) => W[4] - Math.exp(W[5] * (r - 1)) + 1;
const initDifficulty = (r: Rating) => clamp(rawInitDifficulty(r), 1, 10);

function nextDifficulty(d: number, r: Rating) {
  const delta = -W[6] * (r - 3);
  const dPrime = d + delta * ((10 - d) / 9); // linear damping near the ceiling
  const meanReverted = W[7] * rawInitDifficulty(4) + (1 - W[7]) * dPrime;
  return clamp(meanReverted, 1, 10);
}

function recallStability(d: number, s: number, r: number, rating: Rating) {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus);
}

function forgetStability(d: number, s: number, r: number) {
  const next = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return Math.min(next, s); // forgetting never *increases* stability
}

/**
 * Short-term stability update for same-day (learning-step) reviews
 * (FSRS-5): S' = S · e^(w17 · (G − 3 + w18)). Again shrinks S, Easy grows it.
 */
function shortTermStability(s: number, rating: Rating) {
  return s * Math.exp(W[17] * (rating - 3 + W[18]));
}

export function newMemory(now = new Date()): MemoryState {
  return { state: "new", stability: 0, difficulty: 0, due: now.toISOString(), reps: 0, lapses: 0, step: 0 };
}

/** Apply a rating and return the next memory state. Pure. */
export function review(m: MemoryState, rating: Rating, now = new Date()): MemoryState {
  const at = now.getTime();
  const elapsed = m.lastReview ? (at - new Date(m.lastReview).getTime()) / DAY : 0;
  const base = { ...m, lastReview: now.toISOString(), reps: m.reps + 1 };
  const inMinutes = (min: number) => new Date(at + min * 60_000).toISOString();
  const inDays = (d: number) => new Date(at + d * DAY).toISOString();

  // ── first sight ──────────────────────────────────────────────────
  if (m.state === "new") {
    const s = initStability(rating);
    const d = initDifficulty(rating);
    if (rating === 4) return { ...base, state: "review", stability: s, difficulty: d, step: 0, due: inDays(intervalFor(s)) };
    if (rating === 1) return { ...base, state: "learning", stability: s, difficulty: d, step: 0, due: inMinutes(LEARNING_STEPS_MIN[0]) };
    if (rating === 2) return { ...base, state: "learning", stability: s, difficulty: d, step: 0, due: inMinutes((LEARNING_STEPS_MIN[0] + LEARNING_STEPS_MIN[1]) / 2) };
    return { ...base, state: "learning", stability: s, difficulty: d, step: 1, due: inMinutes(LEARNING_STEPS_MIN[1]) };
  }

  // ── (re)learning steps ───────────────────────────────────────────
  if (m.state === "learning" || m.state === "relearning") {
    const steps = m.state === "learning" ? LEARNING_STEPS_MIN : RELEARNING_STEPS_MIN;
    const d = nextDifficulty(m.difficulty, rating);
    const s = Math.max(0.1, shortTermStability(m.stability, rating));
    if (rating === 1) return { ...base, difficulty: d, stability: s, step: 0, due: inMinutes(steps[0]) };
    if (rating === 2) return { ...base, difficulty: d, stability: s, due: inMinutes(steps[Math.min(m.step, steps.length - 1)] * 1.5) };
    const nextStep = m.step + 1;
    if (rating === 3 && nextStep < steps.length) return { ...base, difficulty: d, stability: s, step: nextStep, due: inMinutes(steps[nextStep]) };
    // graduate
    const ivl = Math.max(1, intervalFor(s) + (rating === 4 ? 1 : 0));
    return { ...base, state: "review", difficulty: d, stability: s, step: 0, due: inDays(ivl) };
  }

  // ── review ───────────────────────────────────────────────────────
  const r = retrievability(elapsed, m.stability);
  const d = nextDifficulty(m.difficulty, rating);
  if (rating === 1) {
    const s = Math.max(0.1, forgetStability(m.difficulty, m.stability, r));
    return { ...base, state: "relearning", stability: s, difficulty: d, lapses: m.lapses + 1, step: 0, due: inMinutes(RELEARNING_STEPS_MIN[0]) };
  }
  const s = recallStability(m.difficulty, m.stability, r, rating);
  let ivl = intervalFor(s);
  // Keep ordering sensible: Hard ≤ Good < Easy relative to the last interval.
  const last = Math.max(1, Math.round(elapsed));
  if (rating === 2) ivl = Math.max(1, Math.min(ivl, Math.max(last, Math.round(last * 1.2))));
  if (rating === 3) ivl = Math.max(ivl, last + 1);
  if (rating === 4) ivl = Math.max(ivl, last + 2);
  return { ...base, state: "review", stability: s, difficulty: d, step: 0, due: inDays(Math.min(ivl, MAX_INTERVAL_DAYS)) };
}

/** Preview the due date each rating would produce — shown on the answer buttons. */
export function previewIntervals(m: MemoryState, now = new Date()) {
  return ([1, 2, 3, 4] as Rating[]).map((r) => {
    const next = review(m, r, now);
    return { rating: r, due: next.due, ms: new Date(next.due).getTime() - now.getTime() };
  });
}

export function formatInterval(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

/** Memory strength now (0..1) — current retrievability; 0 for unseen cards. */
export function memoryStrength(m: MemoryState, now = new Date()) {
  if (m.state === "new" || !m.lastReview) return 0;
  const elapsed = (now.getTime() - new Date(m.lastReview).getTime()) / DAY;
  return retrievability(elapsed, m.stability);
}

/** A card counts as "learned" once it graduates with ≥ 3 weeks of stability. */
export const LEARNED_STABILITY = 21;
export const isLearned = (m: MemoryState) => m.state === "review" && m.stability >= LEARNED_STABILITY;
export const isMature = (m: MemoryState) => m.state === "review" && m.stability >= 7;

export const RATING_LABEL: Record<Rating, string> = { 1: "Didn't know", 2: "Hard", 3: "Good", 4: "Easy" };

export function difficultyLabel(d: number) {
  if (d === 0) return "Unrated";
  if (d < 3.5) return "Easy";
  if (d < 5.5) return "Moderate";
  if (d < 7.5) return "Challenging";
  return "Hard";
}
