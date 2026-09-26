"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Flame, Target, Bell, ArrowRight, Sunrise, CalendarClock, Repeat2, Coffee, ChevronDown, Timer, GraduationCap, Play } from "lucide-react";
import { learningStats, deckCounts } from "@/domain/learning";
import { Bar } from "@/components/ui/misc";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { Container, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Ring } from "@/components/ui/ring";
import { Card, EmptyState, SectionLabel, toneVar } from "@/components/ui/misc";
import { Kbd } from "@/components/ui/kbd";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitCheckTile } from "@/components/habits/habit-check";
import { HabitIcon } from "@/components/habits/habit-icon";
import { consistencyScore, encouragement, summarizeRange, todayIntentions, trailingStart } from "@/domain/progress";
import { streaks, habitsForDay } from "@/domain/habits";
import { expandOccurrences } from "@/domain/recurrence";
import { addDaysKey, fmtTime, fromKey, greeting, nowMinutes, relativeDayLabel, todayKey, WEEKDAY_MIN } from "@/lib/dates";
import { useNow } from "@/hooks/use-now";
import { cn, pluralize } from "@/lib/utils";

export function TodayView() {
  const now = useNow();
  const today = todayKey();
  const tasks = useApp((s) => s.tasks);
  const habits = useApp((s) => s.habits);
  const sessions = useApp((s) => s.sessions);
  const reviewLogs = useApp((s) => s.reviews);
  const settings = useApp((s) => s.settings);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const [showDone, setShowDone] = useState(false);

  const intent = useMemo(() => todayIntentions(tasks, habits, today, settings.weekStartsOn), [tasks, habits, today, settings.weekStartsOn]);
  const last28 = useMemo(() => summarizeRange(tasks, habits, sessions, trailingStart(28), 28, settings.weekStartsOn, reviewLogs), [tasks, habits, sessions, settings.weekStartsOn, reviewLogs]);
  const last7 = last28.slice(-7);
  const consistency = consistencyScore(last28);
  const longest = useMemo(() => {
    let best: { name: string; n: number; icon: string; tone: (typeof habits)[number]["tone"]; unit: string } | null = null;
    for (const h of habits) {
      if (h.archived) continue;
      const s = streaks(h, today, settings.weekStartsOn);
      if (!best || s.current > best.n) best = { name: h.name, n: s.current, icon: h.icon, tone: h.tone, unit: s.unit };
    }
    return best;
  }, [habits, today, settings.weekStartsOn]);

  const overdue = useMemo(
    () => expandOccurrences(tasks, addDaysKey(today, -14), addDaysKey(today, -1)).filter((o) => !o.recurring && (o.status === "todo" || o.status === "in_progress")),
    [tasks, today],
  );

  const occ = intent.occurrences;
  const open = occ.filter((o) => o.status !== "done");
  const doneList = occ.filter((o) => o.status === "done");
  const timed = open.filter((o) => o.start != null);
  const anytime = open.filter((o) => o.start == null);
  const allCancelled = expandOccurrences(tasks, today, today).filter((o) => o.status === "cancelled");

  const nowMin = nowMinutes(now);
  /** The now-line sits before the first block that hasn't started yet. */
  const nowIdx = timed.findIndex((t) => t.start! > nowMin);
  const upcoming = useMemo(() => {
    const out: { key: string; time: number; label: string; kind: "task" | "habit"; tone: (typeof habits)[number]["tone"]; icon?: string; day: string }[] = [];
    const occs = expandOccurrences(tasks, today, addDaysKey(today, 1));
    for (const o of occs) {
      if (o.start == null || o.status === "done" || o.status === "cancelled") continue;
      if (o.date === today && o.start < nowMin) continue;
      out.push({ key: o.key, time: o.start, label: o.title, kind: "task", tone: o.task.tone, day: o.date });
    }
    for (const d of [today, addDaysKey(today, 1)]) {
      for (const h of habitsForDay(habits, d, settings.weekStartsOn)) {
        if (h.time == null || h.log.includes(d)) continue;
        if (d === today && h.time < nowMin) continue;
        out.push({ key: `${h.id}${d}`, time: h.time, label: h.name, kind: "habit", tone: h.tone, icon: h.icon, day: d });
      }
    }
    return out.sort((a, b) => (a.day === b.day ? a.time - b.time : a.day < b.day ? -1 : 1)).slice(0, 5);
  }, [tasks, habits, today, nowMin, settings.weekStartsOn]);

  const msg = encouragement(intent.done, intent.total, now.getHours());
  const ratio = intent.total ? intent.done / intent.total : 0;
  const focusToday = sessions.filter((s) => s.day === today && s.mode === "focus").length;

  return (
    <Container>
      <PageHeader
        eyebrow={format(now, "EEEE, MMMM d")}
        title={
          <>
            {greeting(now)}, <span className="italic text-fg-2">{settings.name}</span>
          </>
        }
        actions={
          <Button variant="primary" onClick={() => openQuickAdd({ date: today })} className="max-md:hidden">
            <Plus /> Add to today <Kbd className="border-white/20 bg-white/15 text-accent-fg/80 shadow-none">Q</Kbd>
          </Button>
        }
      />

      <div className="grid gap-6 pb-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        {/* ── left column ───────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-7">
          {/* progress hero */}
          <Card className="relative overflow-hidden p-5 surface-hero md:p-6">
            <div className="relative flex items-center gap-5 md:gap-7">
              <Ring value={ratio} size={112} stroke={9} barClass={ratio >= 1 ? "stroke-ok" : "stroke-accent"} trackClass="stroke-[color-mix(in_oklab,var(--accent)_12%,var(--surface-3))]" label={`${intent.done} of ${intent.total} intentions complete`}>
                <div className="text-center">
                  <div className="font-mono text-[26px] font-medium leading-none tabular tracking-[-0.02em]">
                    {intent.done}
                    <span className="text-fg-4">/{intent.total}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-3">done</div>
                </div>
              </Ring>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-semibold tracking-[-0.015em]">{msg.title}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{msg.body}</p>
                <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-fg-3">
                  <span>
                    <b className="font-mono font-medium tabular text-fg">{occ.length}</b> {occ.length === 1 ? "task" : "tasks"}
                  </span>
                  <span>
                    <b className="font-mono font-medium tabular text-fg">{intent.habits.length}</b> {intent.habits.length === 1 ? "habit" : "habits"}
                  </span>
                  <Link href="/focus" className="flex items-center gap-1 hover:text-fg">
                    <Timer className="size-3.5" />
                    <b className="font-mono font-medium tabular text-fg">{focusToday}</b> focus
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          {overdue.length > 0 && (
            <section aria-label="Overdue">
              <SectionLabel
                action={
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      overdue.forEach((o) => useApp.getState().scheduleOccurrence(o, { date: today, start: o.start }));
                    }}
                  >
                    Move all to today <ArrowRight />
                  </Button>
                }
              >
                <span className="text-danger-text">Overdue · {overdue.length}</span>
              </SectionLabel>
              <div className="mt-1 flex flex-col">
                {overdue.slice(0, 5).map((o) => (
                  <TaskRow key={o.key} occ={o} showDate dense />
                ))}
              </div>
            </section>
          )}

          {/* scheduled */}
          <section aria-label="Scheduled">
            <SectionLabel action={<span className="text-[12px] text-fg-4">{timed.length ? pluralize(timed.length, "block") : ""}</span>}>Scheduled</SectionLabel>
            {timed.length ? (
              <ol className="relative mt-1 flex flex-col">
                {timed.map((o, i) => {
                  const isNow = o.start! <= nowMin && nowMin < o.start! + o.duration;
                  return (
                    <li key={o.key} className="relative">
                      {i === nowIdx && <NowLine />}
                      <div className={cn(isNow && "rounded-[10px] bg-accent-soft/60")}>
                        <TaskRow occ={o} />
                      </div>
                    </li>
                  );
                })}
                {nowIdx === -1 && <NowLine />}
              </ol>
            ) : (
              <EmptyInline icon={<CalendarClock />} text="No time-blocked tasks today." cta="Plan in week view" href="/week" />
            )}
          </section>

          {/* anytime */}
          <section aria-label="Anytime">
            <SectionLabel
              action={
                <Button size="xs" variant="ghost" onClick={() => openQuickAdd({ date: today, start: null })}>
                  <Plus /> Add
                </Button>
              }
            >
              Anytime
            </SectionLabel>
            {anytime.length ? (
              <div className="mt-1 flex flex-col">
                {anytime.map((o) => (
                  <TaskRow key={o.key} occ={o} />
                ))}
              </div>
            ) : (
              <EmptyInline icon={<Coffee />} text={occ.length ? "Nothing floating — everything has a time." : "No flexible tasks yet."} />
            )}

            {(doneList.length > 0 || allCancelled.length > 0) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                  className="flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12.5px] text-fg-3 hover:bg-hover hover:text-fg-2"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
                  {doneList.length} completed{allCancelled.length ? ` · ${allCancelled.length} cancelled` : ""}
                </button>
                {showDone && (
                  <div className="mt-1 flex flex-col animate-in">
                    {[...doneList, ...allCancelled].map((o) => (
                      <TaskRow key={o.key} occ={o} dense />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {intent.total === 0 && overdue.length === 0 && (
            <EmptyState
              icon={<Sunrise />}
              title="A blank page"
              body="Nothing planned for today. Add a task, or set up a habit you'd like to keep."
              action={
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => openQuickAdd({ date: today })}>
                    <Plus /> Add a task
                  </Button>
                  <Button onClick={() => useUI.getState().openHabitEditor()}>New habit</Button>
                </div>
              }
            />
          )}
        </div>

        {/* ── right column ──────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6">
          <section aria-label="Habits">
            <SectionLabel
              action={
                <Link href="/habits" className="text-[12px] text-fg-3 hover:text-fg">
                  All habits
                </Link>
              }
            >
              Habits · {intent.habits.filter((h) => h.log.includes(today)).length}/{intent.habits.length}
            </SectionLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {intent.habits.map((h) => (
                <HabitCheckTile key={h.id} habit={h} day={today} weekStartsOn={settings.weekStartsOn} />
              ))}
              {intent.habits.length === 0 && (
                <Card className="p-4">
                  <EmptyState compact icon={<Repeat2 />} title="No habits today" body="Habits you schedule for today show up here." action={<Button size="sm" onClick={() => useUI.getState().openHabitEditor()}>Create a habit</Button>} />
                </Card>
              )}
            </div>
          </section>

          <LearningToday />

          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
                <Flame className="size-3.5 text-accent-2" /> Longest streak
              </div>
              <div className="mt-2 font-mono text-[24px] font-medium leading-none tabular tracking-[-0.02em]">
                {longest?.n ?? 0}
                <span className="ml-0.5 text-[13px] text-fg-3">{longest?.unit === "week" ? "wk" : "d"}</span>
              </div>
              {longest && longest.n > 0 && (
                <div className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-fg-3" style={toneVar(longest.tone)}>
                  <HabitIcon name={longest.icon} className="size-3 shrink-0 tone-text" />
                  <span className="truncate">{longest.name}</span>
                </div>
              )}
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
                <Target className="size-3.5 text-ok-text" /> Consistency
              </div>
              <div className="mt-2 font-mono text-[24px] font-medium leading-none tabular tracking-[-0.02em]">
                {Math.round(consistency * 100)}
                <span className="text-[13px] text-fg-3">%</span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-fg-3">Good days · last 28</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-fg-3">Last 7 days</span>
              <Link href="/stats" className="text-[12px] text-fg-3 hover:text-fg">
                Stats
              </Link>
            </div>
            <div className="mt-3 flex h-[92px] items-end gap-2" role="list" aria-label="Completion over the last seven days">
              {last7.map((d) => {
                const isToday = d.day === today;
                const h = d.total ? Math.max(6, d.rate * 100) : 4;
                return (
                  <div key={d.day} role="listitem" aria-label={`${relativeDayLabel(d.day)}: ${d.done} of ${d.total}`} className="group flex flex-1 flex-col items-center gap-1.5">
                    <div className="relative flex h-[66px] w-full items-end justify-center">
                      <span className="pointer-events-none absolute -top-5 whitespace-nowrap font-mono text-[10.5px] tabular text-fg-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {d.done}/{d.total}
                      </span>
                      <div
                        className={cn("w-full max-w-[26px] rounded-[5px] transition-[height] duration-500", !d.total ? "bg-surface-3" : isToday ? "bg-accent-grad" : d.rate >= 0.6 ? "bg-[color-mix(in_oklab,var(--accent)_38%,var(--surface-3))]" : "bg-[color-mix(in_oklab,var(--accent)_16%,var(--surface-3))]")}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <span className={cn("text-[10.5px] font-medium", isToday ? "text-accent-text" : "text-fg-4")}>{WEEKDAY_MIN[fromKey(d.day).getDay()]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <section aria-label="Upcoming reminders">
            <SectionLabel>Up next</SectionLabel>
            <Card className="mt-2 divide-y divide-line">
              {upcoming.length ? (
                upcoming.map((u) => (
                  <div key={u.key} className="flex items-center gap-3 px-3.5 py-2.5" style={toneVar(u.tone)}>
                    <span className="w-11 shrink-0 font-mono text-[12.5px] tabular text-fg-2">{fmtTime(u.time)}</span>
                    <span className="h-5 w-[3px] shrink-0 rounded-full tone-solid" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{u.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-fg-4">
                      {u.kind === "habit" ? <Repeat2 className="size-3" /> : <Bell className="size-3" />}
                      {u.day !== today ? "Tmrw" : u.time - nowMin < 60 ? `in ${u.time - nowMin}m` : ""}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-5 text-center text-[12.5px] text-fg-3">No more reminders today. Enjoy the quiet.</div>
              )}
            </Card>
          </section>
        </aside>
      </div>
    </Container>
  );
}

function NowLine() {
  return (
    <div className="pointer-events-none relative my-0.5 flex items-center gap-2 pl-1" aria-hidden>
      <span className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_var(--accent-soft)]" />
      <span className="h-px flex-1 bg-accent/50" />
      <span className="pr-1 font-mono text-[10.5px] text-accent-text">now</span>
    </div>
  );
}

function EmptyInline({ icon, text, cta, href }: { icon: React.ReactNode; text: string; cta?: string; href?: string }) {
  return (
    <div className="mt-1 flex items-center gap-3 rounded-[10px] border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-fg-4">
      {icon}
      <span className="flex-1">{text}</span>
      {cta && href && (
        <Link href={href} className="flex items-center gap-1 text-[12.5px] font-medium text-fg-2 hover:text-fg">
          {cta} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Learning on Today: due count, daily goal and a one-tap entry into review. */
function LearningToday() {
  const cards = useApp((s) => s.cards);
  const reviews = useApp((s) => s.reviews);
  const decks = useApp((s) => s.decks);
  const goal = useApp((s) => s.settings.learnGoal);
  const stats = useMemo(() => learningStats(cards, reviews), [cards, reviews]);
  const fresh = useMemo(() => decks.filter((d) => !d.archived).reduce((n, d) => n + deckCounts(d, cards, reviews).newToday, 0), [decks, cards, reviews]);
  if (!decks.length) return null;
  const ready = stats.dueToday + fresh;
  const pct = Math.min(1, stats.reviewedToday / Math.max(1, goal));
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-text">
          <GraduationCap className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">{ready ? `${ready} cards to review` : pct >= 1 ? "Learning goal reached" : "Learning is caught up"}</div>
          <div className="text-[11.5px] text-fg-3">
            {stats.reviewedToday}/{goal} today · <Flame className="inline size-3 -translate-y-px text-accent-2" /> {stats.streak}d streak
          </div>
        </div>
        {ready > 0 ? (
          <Button size="sm" variant="primary" asChild>
            <Link href="/learn?review=1">
              <Play /> Review
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" asChild>
            <Link href="/learn">Open</Link>
          </Button>
        )}
      </div>
      <Bar value={pct} className="mt-3 h-1" barClass={pct >= 1 ? "bg-ok" : "bg-accent-grad"} />
    </Card>
  );
}
