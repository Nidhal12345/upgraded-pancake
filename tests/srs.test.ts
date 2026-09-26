import { test } from "node:test";
import assert from "node:assert/strict";
import { newMemory, review, intervalFor, retrievability, previewIntervals, type Rating } from "../src/domain/srs";
import { buildQueue, extractCards, learningStreak } from "../src/domain/learning";
import type { Deck, Flashcard } from "../src/domain/types";

const DAY = 864e5;
const t0 = new Date("2026-09-01T09:00:00Z");

test("R(S,S) = 0.9 and interval solves for target retention", () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.equal(intervalFor(10), 10);
});

test("new card: Again < Hard < Good (minutes); Easy graduates to days", () => {
  const p = previewIntervals(newMemory(t0), t0).map((x) => x.ms);
  assert.ok(p[0] < p[1] && p[1] < p[2] && p[2] < p[3]);
  assert.ok(p[2] < 60 * 60_000, "Good on a new card is a learning step");
  assert.ok(p[3] >= DAY, "Easy graduates");
});

test("review card: ratings yield strictly increasing intervals", () => {
  let m = review(newMemory(t0), 3, t0);
  m = review(m, 3, new Date(t0.getTime() + 10 * 60_000)); // graduate
  const at = new Date(m.due);
  const iv = previewIntervals(m, at).map((x) => x.ms);
  assert.ok(iv[0] < DAY, "Again → back within the day");
  assert.ok(iv[1] <= iv[2] && iv[2] < iv[3], `ordering ${iv.map((x) => (x / DAY).toFixed(1))}`);
});

test("consistent Good ratings grow intervals; a lapse shrinks stability", () => {
  let m = review(newMemory(t0), 3, t0);
  m = review(m, 3, new Date(t0.getTime() + 10 * 60_000));
  const ivs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const at = new Date(m.due);
    const next = review(m, 3, at);
    ivs.push((new Date(next.due).getTime() - at.getTime()) / DAY);
    m = next;
  }
  for (let i = 1; i < ivs.length; i++) assert.ok(ivs[i] > ivs[i - 1] || ivs[i] === 1095, `grow ${ivs}`);
  assert.ok(ivs[0] >= 3 && ivs[0] <= 60, `first review interval is days-to-weeks: ${ivs[0]}`);
  const before = m.stability;
  const lapsed = review(m, 1, new Date(m.due));
  assert.equal(lapsed.state, "relearning");
  assert.ok(lapsed.stability < before);
  assert.equal(lapsed.lapses, 1);
});

test("difficulty rises with Again and falls with Easy", () => {
  const m = review(newMemory(t0), 3, t0);
  assert.ok(review(m, 1, t0).difficulty > m.difficulty);
  assert.ok(review(m, 4, t0).difficulty < m.difficulty);
});

test("queue respects new-per-day and interleaves", () => {
  const deck: Deck = { id: "d", name: "D", icon: "brain", tone: "iris", newPerDay: 2, createdAt: "", updatedAt: "" };
  const mk = (i: number, due?: Date): Flashcard => {
    let memory = newMemory(t0);
    if (due) memory = { ...review(memory, 4, new Date(due.getTime() - 5 * DAY)), due: due.toISOString() };
    return { id: `c${i}`, deckId: "d", front: "f", back: "b", tags: [], memory, createdAt: `2026-01-0${i}`, updatedAt: "" };
  };
  const now = new Date("2026-09-10T12:00:00Z");
  const cards = [mk(1), mk(2), mk(3), mk(4, new Date(now.getTime() - DAY)), mk(5, new Date(now.getTime() - DAY)), mk(6, new Date(now.getTime() + 5 * DAY))];
  const q = buildQueue([deck], cards, [], { now });
  assert.equal(q.filter((id) => ["c1", "c2", "c3"].includes(id)).length, 2);
  assert.ok(!q.includes("c6"));
  assert.equal(q.length, 4);
});

test("extractCards finds definitions and Q/A pairs", () => {
  const got = extractCards("- **Watermark** :: event-time threshold\n- Backfill: re-process history\nQ: What is CDC?\nA: Change data capture");
  assert.deepEqual(got.map((c) => c.front), ["Watermark", "Backfill", "What is CDC?"]);
});

test("learning streak", () => {
  const r = (day: string) => ({ id: day, cardId: "c", deckId: "d", rating: 3 as Rating, prevState: "review" as const, elapsedDays: 1, scheduledDays: 2, day, at: day });
  assert.equal(learningStreak([r("2026-09-24"), r("2026-09-25")], "2026-09-26").current, 2);
  assert.equal(learningStreak([r("2026-09-23"), r("2026-09-25"), r("2026-09-26")], "2026-09-26").current, 2);
});
