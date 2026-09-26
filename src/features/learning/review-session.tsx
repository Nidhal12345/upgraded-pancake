"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Undo2, Pencil, Eye, Flame, Target, Sparkles, CalendarClock, CheckCircle2, RotateCcw, Brain, Lightbulb } from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Bar, toneVar } from "@/components/ui/misc";
import { Ring } from "@/components/ui/ring";
import { DeckIcon } from "@/components/learning/deck-icon";
import { formatInterval, previewIntervals, RATING_LABEL, memoryStrength, isLearned, type MemoryState, type Rating } from "@/domain/srs";
import { learningStats } from "@/domain/learning";
import { isTypingTarget } from "@/components/shell/shortcuts";
import type { ID } from "@/domain/types";
import { cn, pluralize } from "@/lib/utils";

const RATING_STYLE: Record<Rating, { cls: string; key: string }> = {
  1: { cls: "text-danger-text hover:bg-danger-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--danger)_30%,transparent)]", key: "1" },
  2: { cls: "text-warn-text hover:bg-warn-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--warn)_35%,transparent)]", key: "2" },
  3: { cls: "text-ok-text hover:bg-ok-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ok)_32%,transparent)]", key: "3" },
  4: { cls: "text-accent-text hover:bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-line)]", key: "4" },
};

interface Graded {
  cardId: ID;
  rating: Rating;
  prev: MemoryState;
  logId: ID;
  wasNew: boolean;
}

/**
 * Focused review. The queue is fixed at start (plus learning-step requeues),
 * so progress reads "12 / 20". Cards rated "Didn't know" come back later in
 * the same session once their short relearning step has elapsed.
 */
export function ReviewSession({ queue: initial, title, onExit }: { queue: ID[]; title: string; onExit: () => void }) {
  const cards = useApp((s) => s.cards);
  const decks = useApp((s) => s.decks);
  const [queue, setQueue] = useState<ID[]>(initial);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<Graded[]>([]);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  const total = initial.length;

  // Skip ids whose cards were deleted mid-session.
  const liveQueue = useMemo(() => queue.filter((id) => cards.some((c) => c.id === id)), [queue, cards]);
  const card = cards.find((c) => c.id === liveQueue[index]);
  const deck = card ? decks.find((d) => d.id === card.deckId) : undefined;
  const done = index >= liveQueue.length;
  const previews = useMemo(() => (card ? previewIntervals(card.memory) : []), [card]);
  const uniqueDone = new Set(graded.map((g) => g.cardId)).size;

  const reveal = useCallback(() => setRevealed(true), []);

  const grade = useCallback(
    (rating: Rating) => {
      if (!card || !revealed) return;
      const res = useApp.getState().gradeCard(card.id, rating, Date.now() - shownAt.current);
      if (!res) return;
      setGraded((g) => [...g, { cardId: card.id, rating, prev: res.prev, logId: res.log.id, wasNew: res.prev.state === "new" }]);
      // Requeue if the card is still in a short (re)learning step — it comes back ~3–5 cards later.
      const next = useApp.getState().cards.find((c) => c.id === card.id);
      if (next && (next.memory.state === "learning" || next.memory.state === "relearning")) {
        setQueue((q) => {
          const pos = Math.min(q.length, index + 1 + Math.max(3, Math.min(6, q.length - index - 1)));
          const copy = [...q];
          copy.splice(pos, 0, card.id);
          return copy;
        });
      }
      setRevealed(false);
      setIndex((i) => i + 1);
      shownAt.current = Date.now();
    },
    [card, revealed, index],
  );

  const undo = useCallback(() => {
    const last = graded[graded.length - 1];
    if (!last) return;
    useApp.getState().undoGrade(last.cardId, last.prev, last.logId);
    setGraded((g) => g.slice(0, -1));
    setQueue((q) => {
      // drop a requeued copy that was added after the current position
      const later = q.indexOf(last.cardId, index);
      return later >= 0 && later !== index - 1 ? q.filter((_, i) => i !== later) : q;
    });
    setIndex((i) => Math.max(0, i - 1));
    setRevealed(true);
  }, [graded, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || document.querySelector("[role=dialog]:not([data-review])")) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          undo();
        }
        return;
      }
      if (e.key === "Escape") return onExit();
      if (done) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) as Rating);
      } else if (revealed && e.key === " ") {
        e.preventDefault();
        grade(3);
      } else if (e.key === "u") undo();
      else if (e.key === "e" && card) useUI.getState().openCardComposer({ cardId: card.id });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, reveal, grade, undo, onExit, card]);

  if (done || !card) return <SessionSummary graded={graded} onExit={onExit} />;

  const progress = Math.min(1, uniqueDone / Math.max(1, total));
  const isRepeat = graded.some((g) => g.cardId === card.id);
  const stateLabel = { new: "New", learning: "Learning", review: "Review", relearning: "Relearning" }[card.memory.state];
  const strength = memoryStrength(card.memory);

  return (
    <div data-review className="fixed inset-0 z-[55] flex flex-col bg-bg [background:var(--grad-canvas),var(--bg)]" role="dialog" aria-label={`Review: ${title}`}>
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:px-6">
        <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="End session">
          <X />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mx-auto flex max-w-[560px] items-center gap-3">
            <Bar value={progress} className="h-1.5 flex-1" barClass="bg-accent-grad" />
            <span className="shrink-0 font-mono text-[13px] font-medium tabular" aria-live="polite">
              {Math.min(uniqueDone + (isRepeat ? 0 : 1), total)} <span className="text-fg-4">/ {total}</span>
            </span>
            {isRepeat && (
              <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tone-soft sm:inline" style={toneVar("amber")} title="Cards you missed come back a few cards later">
                Again · {liveQueue.length - index} left
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!graded.length} aria-label="Undo last answer (U)" title="Undo (U)">
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => useUI.getState().openCardComposer({ cardId: card.id })} aria-label="Edit card (E)" title="Edit (E)">
          <Pencil />
        </Button>
      </header>

      {/* card */}
      <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-6 pt-4 md:pt-10">
        <AnimatePresence mode="wait">
          <motion.article
            key={`${card.id}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            style={toneVar(deck?.tone)}
            className="w-full max-w-[640px] rounded-[20px] surface-card"
          >
            <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-[12px] text-fg-3">
              {deck && <DeckIcon name={deck.icon} className="size-3.5 tone-text" />}
              <span className="truncate font-medium text-fg-2">{deck?.name}</span>
              <span className={cn("rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]", card.memory.state === "new" ? "bg-accent-soft text-accent-text" : card.memory.state === "review" ? "bg-surface-3 text-fg-3" : "bg-warn-soft text-warn-text")}>
                {stateLabel}
              </span>
              {card.memory.state !== "new" && (
                <span className="ml-auto flex items-center gap-1.5" title="Estimated recall probability right now">
                  <Brain className="size-3.5" /> {Math.round(strength * 100)}%
                </span>
              )}
            </div>

            <div className="px-6 pb-8 pt-10 text-center md:px-10 md:pt-14">
              <h2 className="text-balance font-serif text-[30px] leading-tight tracking-[-0.01em] md:text-[40px]">{card.front}</h2>
              {card.tags.length > 0 && !revealed && (
                <div className="mt-4 flex flex-wrap justify-center gap-1">
                  {card.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-3">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {revealed && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-8 border-t border-dashed border-line-2 pt-8 text-left">
                  <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-fg">{card.back}</p>
                  {card.example && (
                    <p className="mt-4 rounded-[12px] bg-surface-2 px-4 py-3 text-[14.5px] italic leading-relaxed text-fg-2">
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase not-italic tracking-[0.07em] text-fg-4">Example</span>
                      {card.example}
                    </p>
                  )}
                  {card.note && (
                    <p className="mt-3 flex gap-2 text-[13px] leading-relaxed text-fg-3">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent-2" /> {card.note}
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
        {!revealed && <p className="mt-5 text-[13px] text-fg-3">Recall the answer, then reveal.</p>}
      </main>

      {/* controls */}
      <footer className="shrink-0 border-t border-line bg-surface/70 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        <div className="mx-auto max-w-[640px]">
          {!revealed ? (
            <Button variant="primary" size="lg" className="h-12 w-full rounded-[12px] text-[15px]" onClick={reveal}>
              <Eye /> Show answer <Kbd className="ml-1 border-white/20 bg-white/15 text-accent-fg/80 shadow-none max-md:hidden">Space</Kbd>
            </Button>
          ) : (
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
              {([1, 2, 3, 4] as Rating[]).map((r) => (
                <button
                  key={r}
                  onClick={() => grade(r)}
                  className={cn(
                    "flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[12px] bg-surface text-[13.5px] font-semibold outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.97]",
                    RATING_STYLE[r].cls,
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {RATING_LABEL[r]}
                    <Kbd className="max-md:hidden">{r}</Kbd>
                  </span>
                  <span className="font-mono text-[11.5px] font-normal text-fg-3">{formatInterval(previews[r - 1]?.ms ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2.5 text-center text-[11.5px] text-fg-4 max-md:hidden">
            {revealed ? "1–4 to answer · Space = Good · U undo · E edit · Esc end" : "Space to reveal · Esc to end"}
          </p>
        </div>
      </footer>
    </div>
  );
}

function SessionSummary({ graded, onExit }: { graded: Graded[]; onExit: () => void }) {
  const cards = useApp((s) => s.cards);
  const reviews = useApp((s) => s.reviews);
  const goal = useApp((s) => s.settings.learnGoal);
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => learningStats(cards, reviews), [cards, reviews]);
  // Final outcome per card = the last grade it got this session.
  const byCard = new Map<ID, Graded[]>();
  for (const g of graded) byCard.set(g.cardId, [...(byCard.get(g.cardId) ?? []), g]);
  const firstTry = [...byCard.values()].map((l) => l[0]);
  const correct = firstTry.filter((g) => g.rating > 1).length;
  const accuracy = firstTry.length ? correct / firstTry.length : 0;
  const newlyLearned = [...byCard.keys()].filter((id) => {
    const c = cards.find((x) => x.id === id);
    return c && (byCard.get(id)![0].wasNew || isLearned(c.memory));
  }).length;
  const needReview = [...byCard.values()].filter((l) => l.some((g) => g.rating === 1)).length;
  const tomorrow = stats.forecast[1]?.count ?? 0;
  const week = stats.forecast.slice(1, 8).reduce((n, f) => n + f.count, 0);
  const goalPct = Math.min(1, stats.reviewedToday / Math.max(1, goal));
  const struggling = [...byCard.entries()]
    .filter(([, l]) => l.some((g) => g.rating === 1))
    .map(([id]) => cards.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 4);

  if (!graded.length)
    return (
      <div data-review className="fixed inset-0 z-[55] grid place-items-center bg-bg p-6 [background:var(--grad-canvas),var(--bg)]" role="dialog" aria-label="Session">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok-text">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="mt-4 font-serif text-[30px]">All caught up</h2>
          <p className="mt-2 text-[14px] text-fg-2">Nothing is due right now. Your memory is doing the work — come back later.</p>
          <Button variant="primary" className="mt-6" onClick={onExit}>
            Back to Learning
          </Button>
        </div>
      </div>
    );

  return (
    <div data-review className="fixed inset-0 z-[55] overflow-y-auto bg-bg [background:var(--grad-canvas),var(--bg)]" role="dialog" aria-label="Session summary">
      <div className="mx-auto flex min-h-full max-w-[640px] flex-col justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent-text">
              <Sparkles className="size-7" />
            </div>
            <h2 className="mt-4 font-serif text-[36px] leading-tight">Session complete</h2>
            <p className="mt-1.5 text-[14px] text-fg-2">
              {accuracy >= 0.85 ? "Sharp recall. These memories are getting sturdy." : accuracy >= 0.6 ? "Solid work — the tricky ones will come back sooner." : "Tough set. That's exactly where the learning happens."}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SumTile label="Reviewed" value={byCard.size} sub={`${graded.length} answers`} />
            <SumTile label="Accuracy" value={`${Math.round(accuracy * 100)}%`} sub="first try" />
            <SumTile label="Learned" value={newlyLearned} sub="new or mastered" />
            <SumTile label="Need review" value={needReview} sub="back soon" tone={needReview ? "warn" : undefined} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-[14px] p-4 surface-card">
              <Ring value={goalPct} size={56} stroke={6} barClass="stroke-accent" label="Daily goal">
                <Target className="size-4 text-accent-text" />
              </Ring>
              <div>
                <div className="text-[13px] font-medium">Daily goal</div>
                <div className="font-mono text-[13px] tabular text-fg-2">
                  {stats.reviewedToday} / {goal} reviews
                </div>
                <div className="text-[12px] text-fg-3">{goalPct >= 1 ? "Goal reached today" : `${goal - stats.reviewedToday} to go`}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-[14px] p-4 surface-card">
              <div className="grid size-14 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent-2)_16%,transparent)]">
                <Flame className="size-6 text-accent-2" />
              </div>
              <div>
                <div className="text-[13px] font-medium">Learning streak</div>
                <div className="font-mono text-[20px] font-medium leading-tight tabular">{pluralize(stats.streak, "day")}</div>
                <div className="text-[12px] text-fg-3">Best {stats.bestStreak}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[14px] p-4 surface-card">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
              <CalendarClock className="size-4 text-fg-3" /> Upcoming reviews
              <span className="ml-auto text-[12px] font-normal text-fg-3">
                {tomorrow} tomorrow · {week} this week
              </span>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {stats.forecast.slice(1, 15).map((f, i) => {
                const max = Math.max(1, ...stats.forecast.slice(1, 15).map((x) => x.count));
                return (
                  <div key={f.day} className="flex flex-1 flex-col items-center gap-1" title={`${f.count} due`}>
                    <div className={cn("w-full rounded-[3px]", i === 0 ? "bg-accent" : "bg-[color-mix(in_oklab,var(--accent)_28%,var(--surface-3))]")} style={{ height: `${Math.max(4, (f.count / max) * 48)}px` }} />
                    <span className="font-mono text-[9.5px] text-fg-4">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {struggling.length > 0 && (
            <div className="mt-3 rounded-[14px] p-4 surface-card">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">
                <RotateCcw className="size-4 text-warn-text" /> Coming back soon
              </div>
              <ul className="flex flex-col divide-y divide-line">
                {struggling.map((c) => (
                  <li key={c!.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate">{c!.front}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-fg-3">{formatInterval(Math.max(60_000, new Date(c!.memory.due).getTime() - now))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex justify-center gap-2">
            <Button variant="primary" size="lg" onClick={onExit}>
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SumTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: "warn" }) {
  return (
    <div className="rounded-[14px] p-3.5 surface-card">
      <div className="text-[11.5px] font-medium text-fg-3">{label}</div>
      <div className={cn("mt-1 font-mono text-[26px] font-medium leading-none tabular", tone === "warn" && "text-warn-text")}>{value}</div>
      <div className="mt-1 text-[11px] text-fg-4">{sub}</div>
    </div>
  );
}
