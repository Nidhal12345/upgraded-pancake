"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Plus, Play, Flame, Target, Brain, Sparkles, Search, X, MoreHorizontal, Pencil, Trash2, Layers, GraduationCap, CalendarClock, Zap,
  Pause, RotateCcw, Link2, Minus, ChevronRight, Dumbbell, Library, BarChart3, CheckCircle2,
} from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { Container, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Card, EmptyState, SectionLabel, toneVar, Bar } from "@/components/ui/misc";
import { Ring } from "@/components/ui/ring";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { DeckIcon } from "@/components/learning/deck-icon";
import { buildQueue, deckCounts, isDue, learningStats } from "@/domain/learning";
import { difficultyLabel, formatInterval, memoryStrength, isLearned } from "@/domain/srs";
import { deleteCardsWithUndo, deleteDeckWithUndo, toggleSuspend } from "./learning-actions";
import { ReviewSession } from "./review-session";
import type { Deck, Flashcard, ID } from "@/domain/types";
import { fromKey, relativeDayLabel, WEEKDAY_MIN } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";

type Tab = "overview" | "cards" | "insights";

export function LearningView() {
  const router = useRouter();
  const params = useSearchParams();
  const decks = useApp((s) => s.decks);
  const cards = useApp((s) => s.cards);
  const reviews = useApp((s) => s.reviews);
  const goal = useApp((s) => s.settings.learnGoal);
  const openCardComposer = useUI((s) => s.openCardComposer);
  const openDeckEditor = useUI((s) => s.openDeckEditor);
  const [session, setSession] = useState<{ queue: ID[]; title: string } | null>(null);

  const tab = (["overview", "cards", "insights"].includes(params.get("tab") ?? "") ? params.get("tab") : "overview") as Tab;
  const deckFilter = params.get("deck");
  const setParam = (k: string, v: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`/learn${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const active = decks.filter((d) => !d.archived);
  const stats = useMemo(() => learningStats(cards, reviews), [cards, reviews]);
  const counts = useMemo(() => new Map(active.map((d) => [d.id, deckCounts(d, cards, reviews)])), [active, cards, reviews]);
  const newToday = [...counts.values()].reduce((n, c) => n + c.newToday, 0);
  const queueSize = stats.dueToday + newToday;

  const start = (deckIds?: ID[], cram = false) => {
    const q = buildQueue(decks, cards, reviews, { deckIds, limit: cram ? 20 : Math.max(goal, 20), cram });
    const title = deckIds?.length === 1 ? (decks.find((d) => d.id === deckIds[0])?.name ?? "Review") : cram ? "Practice" : "Daily review";
    setSession({ queue: q, title });
  };

  // "?review=1" or "?review=<deckId>" — deep link from Today / ⌘K
  const reviewParam = params.get("review");
  const [autoStarted, setAutoStarted] = useState<string | null>(null);
  if (reviewParam && autoStarted !== reviewParam && cards.length) {
    setAutoStarted(reviewParam);
    start(reviewParam === "1" ? undefined : [reviewParam]);
  }

  if (!reviewParam && autoStarted) setAutoStarted(null);

  // Strip the one-shot param from the URL after the session has been started.
  useEffect(() => {
    if (!reviewParam || autoStarted !== reviewParam) return;
    const sp = new URLSearchParams(window.location.search);
    sp.delete("review");
    router.replace(`/learn${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }, [reviewParam, autoStarted, router]);

  const goalPct = Math.min(1, stats.reviewedToday / Math.max(1, goal));

  return (
    <>
      <Container>
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Flame className="size-3.5 text-accent-2" /> {pluralize(stats.streak, "day")} streak
              </span>
              <span>·</span>
              <span>{stats.learned} cards learned</span>
            </span>
          }
          title="Learning"
          actions={
            <>
              <Button onClick={() => openDeckEditor()}>
                <Layers /> New deck
              </Button>
              <Button variant="primary" onClick={() => openCardComposer(deckFilter ? { prefill: { deckId: deckFilter } } : undefined)}>
                <Plus /> New card
              </Button>
            </>
          }
        >
          <Segmented
            label="Learning section"
            value={tab}
            onChange={(t) => setParam("tab", t === "overview" ? null : t)}
            options={[
              { value: "overview", label: "Overview", icon: <GraduationCap /> },
              { value: "cards", label: "Cards", icon: <Library /> },
              { value: "insights", label: "Insights", icon: <BarChart3 /> },
            ]}
          />
        </PageHeader>

        {cards.length === 0 && decks.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title="Build your memory, one card at a time"
            body="Create a deck for a subject, add cards, and review a few minutes a day. Meridian schedules each card right before you'd forget it."
            action={
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => openDeckEditor()}>
                  <Plus /> Create a deck
                </Button>
              </div>
            }
          />
        ) : tab === "overview" ? (
          <div className="flex flex-col gap-6 pb-16">
            {/* hero: daily review */}
            <Card className="relative overflow-hidden p-5 surface-hero md:p-6">
              <div className="flex flex-wrap items-center gap-5 md:gap-7">
                <Ring value={goalPct} size={112} stroke={9} barClass={goalPct >= 1 ? "stroke-ok" : "stroke-accent"} trackClass="stroke-[color-mix(in_oklab,var(--accent)_12%,var(--surface-3))]" label={`${stats.reviewedToday} of ${goal} reviews today`}>
                  <div className="text-center">
                    <div className="font-mono text-[24px] font-medium leading-none tabular">
                      {stats.reviewedToday}
                      <span className="text-fg-4">/{goal}</span>
                    </div>
                    <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-3">today</div>
                  </div>
                </Ring>
                <div className="min-w-[200px] flex-1">
                  <h2 className="text-[18px] font-semibold tracking-[-0.015em]">
                    {queueSize > 0 ? `${pluralize(queueSize, "card")} ready for review` : goalPct >= 1 ? "Daily goal reached" : "You're all caught up"}
                  </h2>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">
                    {queueSize > 0
                      ? `${stats.dueToday} due · ${newToday} new. About ${Math.max(1, Math.round(queueSize * 0.15))} minutes.`
                      : `Next reviews: ${stats.forecast[1]?.count ?? 0} tomorrow. Add cards or practise your weakest ones.`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="primary" size="lg" onClick={() => start()} disabled={queueSize === 0}>
                      <Play /> Start review
                    </Button>
                    <Button size="lg" onClick={() => start(undefined, true)} disabled={stats.totalReviews === 0}>
                      <Dumbbell /> Practise weakest
                    </Button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 max-md:w-full">
                  <MiniStat icon={<Target className="text-ok-text" />} label="Accuracy · 7d" value={`${Math.round(stats.accuracy7 * 100)}%`} />
                  <MiniStat icon={<Brain className="text-accent-text" />} label="Memory strength" value={`${Math.round(stats.strength * 100)}%`} />
                  <MiniStat icon={<Flame className="text-accent-2" />} label="Streak" value={`${stats.streak}d`} />
                  <MiniStat icon={<CheckCircle2 className="text-fg-3" />} label="Reviews total" value={stats.totalReviews} />
                </dl>
              </div>
            </Card>

            {/* decks */}
            <section aria-label="Decks">
              <SectionLabel
                action={
                  <Button size="xs" variant="ghost" onClick={() => openDeckEditor()}>
                    <Plus /> Deck
                  </Button>
                }
              >
                Decks · {active.length}
              </SectionLabel>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((d) => (
                  <DeckCard key={d.id} deck={d} counts={counts.get(d.id)!} onStudy={() => start([d.id])} onBrowse={() => router.replace(`/learn?tab=cards&deck=${d.id}`, { scroll: false })} />
                ))}
                <button
                  onClick={() => openDeckEditor()}
                  className="flex min-h-[172px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-3 text-[13px] text-fg-3 outline-none transition-colors hover:border-accent-line hover:bg-accent-softer hover:text-fg-2 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Plus className="size-5" /> New deck
                </button>
              </div>
            </section>

            {/* capture loop hint */}
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <div className="grid size-9 place-items-center rounded-[10px] bg-accent-soft text-accent-text">
                <Zap className="size-4" />
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="text-[13.5px] font-medium">Capture from anywhere</div>
                <p className="text-[12.5px] text-fg-3">
                  Select text in a note → <b className="font-medium text-fg-2">Make card</b>. Right-click a task → <b className="font-medium text-fg-2">Turn into card</b>. Or press <Kbd>⌘K</Kbd> and type “card”.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => router.push("/notes")}>
                Open notes <ChevronRight />
              </Button>
            </Card>
          </div>
        ) : tab === "cards" ? (
          <CardBrowser deckFilter={deckFilter} setDeck={(id) => setParam("deck", id)} />
        ) : (
          <Insights stats={stats} counts={counts} decks={active} />
        )}
      </Container>
      {session && <ReviewSession queue={session.queue} title={session.title} onExit={() => setSession(null)} />}
    </>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] text-fg-3 [&_svg]:size-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-[18px] font-medium tabular">{value}</dd>
    </div>
  );
}

function DeckCard({ deck, counts, onStudy, onBrowse }: { deck: Deck; counts: ReturnType<typeof deckCounts>; onStudy: () => void; onBrowse: () => void }) {
  const openDeckEditor = useUI((s) => s.openDeckEditor);
  const openCardComposer = useUI((s) => s.openCardComposer);
  const ready = counts.due + counts.newToday;
  const learnedPct = counts.total ? counts.learned / counts.total : 0;
  return (
    <Card className="group flex min-w-0 flex-col p-4" style={toneVar(deck.tone)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] tone-soft tone-text [&_svg]:size-5">
          <DeckIcon name={deck.icon} />
        </span>
        <button onClick={onBrowse} className="min-w-0 flex-1 text-left outline-none">
          <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.01em] hover:underline">{deck.name}</h3>
          <p className="truncate text-[12px] text-fg-3">{deck.description || pluralize(counts.total, "card")}</p>
        </button>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" aria-label={`Actions for ${deck.name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => openCardComposer({ prefill: { deckId: deck.id } })}>
              <Plus /> Add card
            </MenuItem>
            <MenuItem onSelect={onBrowse}>
              <Library /> Browse cards
            </MenuItem>
            <MenuItem onSelect={() => openDeckEditor(deck.id)}>
              <Pencil /> Edit deck
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => deleteDeckWithUndo(deck)}>
              <Trash2 /> Delete deck
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Count label="Due" value={counts.due} strong={counts.due > 0} />
        <Count label="New" value={counts.newToday} sub={counts.newCards > counts.newToday ? `of ${counts.newCards}` : undefined} />
        <Count label="Learned" value={counts.learned} />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-fg-3">
          <span>Mastery</span>
          <span className="font-mono tabular">{Math.round(learnedPct * 100)}%</span>
        </div>
        <Bar value={learnedPct} barClass="tone-solid" className="h-1" />
      </div>
      <Button variant={ready ? "primary" : "secondary"} size="sm" className="mt-4 w-full" onClick={onStudy} disabled={!ready}>
        {ready ? (
          <>
            <Play /> Study {ready}
          </>
        ) : (
          "Nothing due"
        )}
      </Button>
    </Card>
  );
}

function Count({ label, value, sub, strong }: { label: string; value: number; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-[9px] bg-surface-2 py-2">
      <div className={cn("font-mono text-[17px] font-medium leading-none tabular", strong ? "text-accent-text" : "text-fg")}>{value}</div>
      <div className="mt-1 text-[10.5px] text-fg-3">
        {label}
        {sub && <span className="text-fg-4"> {sub}</span>}
      </div>
    </div>
  );
}

type CardFilter = "all" | "due" | "new" | "learning" | "learned" | "paused";

function CardBrowser({ deckFilter, setDeck }: { deckFilter: string | null; setDeck: (id: string | null) => void }) {
  const decks = useApp((s) => s.decks);
  const cards = useApp((s) => s.cards);
  const reviews = useApp((s) => s.reviews);
  const openCardComposer = useUI((s) => s.openCardComposer);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [openId, setOpenId] = useState<ID | null>(null);
  const [limit, setLimit] = useState(60);
  const now = new Date();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards
      .filter((c) => !deckFilter || c.deckId === deckFilter)
      .filter((c) => {
        switch (filter) {
          case "due": return isDue(c);
          case "new": return c.memory.state === "new" && !c.suspended;
          case "learning": return (c.memory.state === "learning" || c.memory.state === "relearning") && !c.suspended;
          case "learned": return isLearned(c.memory);
          case "paused": return !!c.suspended;
          default: return true;
        }
      })
      .filter((c) => !needle || [c.front, c.back, c.example ?? "", c.note ?? "", c.tags.join(" ")].some((f) => f.toLowerCase().includes(needle)))
      .sort((a, b) => (a.memory.state === "new" ? 1 : 0) - (b.memory.state === "new" ? 1 : 0) || (a.memory.due < b.memory.due ? -1 : 1));
  }, [cards, deckFilter, filter, q]);

  const deck = decks.find((d) => d.id === deckFilter);
  const history = openId ? reviews.filter((r) => r.cardId === openId).slice(-12).reverse() : [];

  return (
    <div className="pb-16">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" style={deck ? toneVar(deck.tone) : undefined}>
              {deck ? <DeckIcon name={deck.icon} className="tone-text" /> : <Layers />}
              {deck?.name ?? "All decks"}
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setDeck(null)}>
              <Layers /> All decks
            </MenuItem>
            <MenuSeparator />
            {decks.map((d) => (
              <MenuItem key={d.id} onSelect={() => setDeck(d.id)} style={toneVar(d.tone)}>
                <DeckIcon name={d.icon} className="!text-[var(--tone)]" /> {d.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cards, answers, tags…"
            aria-label="Search cards"
            className="h-8 w-full rounded-[8px] bg-input pl-8 pr-7 text-[13px] shadow-[0_0_0_1px_var(--line-2)] outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)]"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-fg-3">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="-mx-4 w-full overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:w-auto sm:px-0">
          <Segmented
            size="xs"
            label="Card filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "due", label: "Due" },
              { value: "new", label: "New" },
              { value: "learning", label: "Learning" },
              { value: "learned", label: "Learned" },
              { value: "paused", label: "Paused" },
            ]}
          />
        </div>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => openCardComposer(deckFilter ? { prefill: { deckId: deckFilter } } : undefined)}>
          <Plus /> Card
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={q ? <Search /> : <Library />}
          title={q ? "No cards match" : "No cards here yet"}
          body={q ? "Try another word or tag." : "Add your first card — a word, a concept, a formula."}
          action={!q && <Button variant="primary" onClick={() => openCardComposer(deckFilter ? { prefill: { deckId: deckFilter } } : undefined)}><Plus /> New card</Button>}
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.slice(0, limit).map((c) => (
            <CardRow key={c.id} card={c} deck={decks.find((d) => d.id === c.deckId)} open={openId === c.id} onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))} history={openId === c.id ? history : []} now={now} />
          ))}
        </Card>
      )}
      {list.length > limit && (
        <div className="flex justify-center py-4">
          <Button variant="secondary" onClick={() => setLimit((l) => l + 60)}>
            Show more · {list.length - limit} remaining
          </Button>
        </div>
      )}
    </div>
  );
}

function CardRow({ card, deck, open, onToggle, history, now }: { card: Flashcard; deck?: Deck; open: boolean; onToggle: () => void; history: ReturnType<typeof useApp.getState>["reviews"]; now: Date }) {
  const openCardComposer = useUI((s) => s.openCardComposer);
  const m = card.memory;
  const strength = memoryStrength(m, now);
  const due = new Date(m.due);
  const status = card.suspended ? "Paused" : m.state === "new" ? "New" : isDue(card, now) ? "Due" : isLearned(m) ? "Learned" : m.state === "review" ? "Review" : "Learning";
  const statusCls = {
    Paused: "bg-surface-3 text-fg-3",
    New: "bg-accent-soft text-accent-text",
    Due: "bg-warn-soft text-warn-text",
    Learned: "bg-ok-soft text-ok-text",
    Review: "bg-surface-2 text-fg-2",
    Learning: "bg-info-soft text-info",
  }[status];
  return (
    <div style={toneVar(deck?.tone)} className={cn(card.suspended && "opacity-60")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none">
          <span className="h-8 w-[3px] shrink-0 rounded-full tone-solid opacity-70" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{card.front}</span>
            <span className="block truncate text-[12.5px] text-fg-3">{card.back}</span>
          </span>
        </button>
        <div className="hidden w-[110px] shrink-0 sm:block" title="Memory strength (estimated recall now)">
          {m.state !== "new" ? (
            <>
              <div className="mb-1 flex justify-between font-mono text-[10.5px] tabular text-fg-3">
                <span>strength</span>
                <span>{Math.round(strength * 100)}%</span>
              </div>
              <Bar value={strength} className="h-1" barClass={strength > 0.85 ? "bg-ok" : strength > 0.6 ? "bg-accent" : "bg-warn"} />
            </>
          ) : (
            <span className="text-[11.5px] text-fg-4">Not studied</span>
          )}
        </div>
        <span className={cn("hidden w-[64px] shrink-0 rounded-[5px] py-0.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.05em] md:block", statusCls)}>{status}</span>
        <span className="w-[62px] shrink-0 text-right font-mono text-[11.5px] tabular text-fg-3 max-sm:hidden">
          {m.state === "new" ? "—" : due <= now ? "now" : formatInterval(due.getTime() - now.getTime())}
        </span>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" aria-label="Card actions">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => openCardComposer({ cardId: card.id })}>
              <Pencil /> Edit
            </MenuItem>
            <MenuItem onSelect={() => toggleSuspend(card)}>
              {card.suspended ? <Play /> : <Pause />} {card.suspended ? "Resume" : "Pause"}
            </MenuItem>
            <MenuItem onSelect={() => useApp.getState().resetCard(card.id)}>
              <RotateCcw /> Reset progress
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => deleteCardsWithUndo([card.id])}>
              <Trash2 /> Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-line bg-surface-2/50 px-5 py-4 animate-in md:grid-cols-[1fr_260px]">
          <div className="min-w-0 text-[13.5px] leading-relaxed">
            <p className="whitespace-pre-wrap">{card.back}</p>
            {card.example && <p className="mt-2 italic text-fg-2">“{card.example}”</p>}
            {card.note && <p className="mt-2 text-[12.5px] text-fg-3">{card.note}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {deck && (
                <span className="inline-flex items-center gap-1 rounded-full tone-soft px-2 py-0.5 text-[11px] tone-text">
                  <DeckIcon name={deck.icon} className="size-3" /> {deck.name}
                </span>
              )}
              {card.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-3">
                  #{t}
                </span>
              ))}
              {card.source && card.source.kind !== "manual" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-3">
                  <Link2 className="size-3" /> {card.source.kind}: {card.source.label}
                </span>
              )}
            </div>
          </div>
          <div className="text-[12px]">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <dt className="text-fg-3">Difficulty</dt>
              <dd className="text-right">{difficultyLabel(m.difficulty)}{m.difficulty ? <span className="ml-1 font-mono text-fg-4">{m.difficulty.toFixed(1)}</span> : null}</dd>
              <dt className="text-fg-3">Stability</dt>
              <dd className="text-right font-mono tabular">{m.stability ? `${m.stability.toFixed(1)}d` : "—"}</dd>
              <dt className="text-fg-3">Reviews · lapses</dt>
              <dd className="text-right font-mono tabular">
                {m.reps} · {m.lapses}
              </dd>
              <dt className="text-fg-3">Next review</dt>
              <dd className="text-right">{m.state === "new" ? "On first study" : relativeDayLabel(format(due, "yyyy-MM-dd"))}</dd>
            </dl>
            {history.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-4">Review history</div>
                <div className="flex flex-wrap gap-1">
                  {history
                    .slice()
                    .reverse()
                    .map((r) => (
                      <Tooltip key={r.id} content={`${["Didn't know", "Hard", "Good", "Easy"][r.rating - 1]} · ${formatDistanceToNowStrict(new Date(r.at), { addSuffix: true })}`}>
                        <span className={cn("size-3.5 rounded-[3px]", r.rating === 1 ? "bg-danger" : r.rating === 2 ? "bg-warn" : r.rating === 3 ? "bg-ok" : "bg-accent")} />
                      </Tooltip>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Insights({ stats, counts, decks }: { stats: ReturnType<typeof learningStats>; counts: Map<ID, ReturnType<typeof deckCounts>>; decks: Deck[] }) {
  const goal = useApp((s) => s.settings.learnGoal);
  const updateSettings = useApp((s) => s.updateSettings);
  const history = stats.history.map((h) => ({ ...h, wrong: h.reviews - h.correct }));
  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile icon={<Sparkles className="text-accent-text" />} label="Reviewed today" value={stats.reviewedToday} sub={`${stats.correctToday} correct`} />
        <Tile icon={<Target className="text-ok-text" />} label="Accuracy · 30d" value={`${Math.round(stats.accuracy30 * 100)}%`} sub={`${Math.round(stats.accuracy7 * 100)}% last 7 days`} />
        <Tile icon={<GraduationCap className="text-accent-text" />} label="Cards learned" value={stats.learned} sub="stable ≥ 3 weeks" />
        <Tile icon={<Flame className="text-accent-2" />} label="Learning streak" value={`${stats.streak}d`} sub={`best ${stats.bestStreak}d`} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Review history</h2>
            <p className="text-[12px] text-fg-3">Answers per day over the last 4 weeks</p>
          </div>
          <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-accent" /> Remembered</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[color-mix(in_oklab,var(--danger)_55%,var(--surface-3))]" /> Forgot</span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="day" tickFormatter={(k) => format(fromKey(k), "d")} interval={3} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-3)", fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-4)", fontSize: 11 }} />
              <RTooltip
                cursor={{ fill: "var(--hover)" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-[10px] bg-elevated px-3 py-2 text-[12px] shadow-lg">
                      <div className="font-medium">{format(fromKey(payload[0].payload.day), "EEE, MMM d")}</div>
                      <div className="text-fg-2">
                        {payload[0].payload.reviews} reviews · {payload[0].payload.reviews ? Math.round((payload[0].payload.correct / payload[0].payload.reviews) * 100) : 0}% correct
                      </div>
                    </div>
                  ) : null
                }
              />
              <RBar dataKey="correct" stackId="a" fill="var(--accent)" radius={[0, 0, 2, 2]} isAnimationActive={false} maxBarSize={18} />
              <RBar dataKey="wrong" stackId="a" fill="color-mix(in oklab, var(--danger) 55%, var(--surface-3))" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="size-4 text-fg-3" />
            <h2 className="text-[14px] font-semibold">Upcoming reviews</h2>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {stats.forecast.map((f, i) => {
              const max = Math.max(1, ...stats.forecast.map((x) => x.count));
              return (
                <div key={f.day} className="flex flex-1 flex-col items-center gap-1" title={`${relativeDayLabel(f.day)}: ${f.count}`}>
                  <span className="font-mono text-[10px] tabular text-fg-3">{f.count || ""}</span>
                  <div className={cn("w-full rounded-[3px]", i === 0 ? "bg-accent" : "bg-[color-mix(in_oklab,var(--accent)_28%,var(--surface-3))]")} style={{ height: `${Math.max(3, (f.count / max) * 64)}px` }} />
                  <span className={cn("text-[10px]", i === 0 ? "font-semibold text-accent-text" : "text-fg-4")}>{WEEKDAY_MIN[fromKey(f.day).getDay()]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <div>
              <div className="text-[13px] font-medium">Daily goal</div>
              <div className="text-[12px] text-fg-3">Reviews per day that count as a good session</div>
            </div>
            <div className="flex items-center rounded-[9px] bg-surface-2 p-0.5">
              <Button size="icon-sm" variant="ghost" aria-label="Decrease goal" onClick={() => updateSettings({ learnGoal: Math.max(5, goal - 5) })}>
                <Minus />
              </Button>
              <span className="w-9 text-center font-mono text-[14px] tabular">{goal}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Increase goal" onClick={() => updateSettings({ learnGoal: Math.min(200, goal + 5) })}>
                <Plus />
              </Button>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[14px] font-semibold">Memory strength by deck</h2>
          <ul className="flex flex-col gap-3">
            {decks.map((d) => {
              const c = counts.get(d.id)!;
              return (
                <li key={d.id} style={toneVar(d.tone)} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[8px] tone-soft tone-text [&_svg]:size-3.5">
                    <DeckIcon name={d.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{d.name}</span>
                      <span className="shrink-0 font-mono text-[12px] tabular text-fg-2">{Math.round(c.strength * 100)}%</span>
                    </span>
                    <Bar value={c.strength} barClass="tone-solid" className="mt-1 h-1" />
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11.5px] text-fg-3">
                    {c.learned}/{c.total} learned
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-fg-4">
            Strength is the estimated chance you&apos;d recall a card right now. Meridian schedules each review for when it drops to about 90%.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-[24px] font-medium leading-none tabular">{value}</div>
      <div className="mt-1.5 text-[11.5px] text-fg-4">{sub}</div>
    </Card>
  );
}
