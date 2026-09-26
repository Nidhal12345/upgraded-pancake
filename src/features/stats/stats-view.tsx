"use client";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { Sprout, Flame, Award, Zap, TrendingUp, TrendingDown, Minus, Timer, CheckCircle2, Repeat2, GraduationCap, Brain, Target } from "lucide-react";
import Link from "next/link";
import { learningStats } from "@/domain/learning";
import { useApp } from "@/data/store";
import { Container, PageHeader } from "@/components/shell/page";
import { Card, SectionLabel, toneVar, Bar as ProgressBar, EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { HabitIcon } from "@/components/habits/habit-icon";
import { habitRanking, levelFor, LEVELS, MAX_DAILY_XP, summarizeRange, trailingStart, consistencyScore, type DaySummary } from "@/domain/progress";
import { MILESTONES } from "@/domain/habits";
import { fromKey, todayKey, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: DaySummary }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-[10px] bg-elevated px-3 py-2 text-[12px] shadow-lg">
      <div className="font-medium">{format(fromKey(d.day), "EEE, MMM d")}</div>
      <div className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-fg-2">
        <span>Completion</span>
        <span className="text-right font-mono tabular text-fg">{d.total ? Math.round(d.rate * 100) : 0}%</span>
        <span>Tasks</span>
        <span className="text-right font-mono tabular">
          {d.tasksDone}/{d.tasksTotal}
        </span>
        <span>Habits</span>
        <span className="text-right font-mono tabular">
          {d.habitsDone}/{d.habitsTotal}
        </span>
        <span>XP</span>
        <span className="text-right font-mono tabular text-accent-text">+{d.xp}</span>
      </div>
    </div>
  );
}

export function StatsView() {
  const tasks = useApp((s) => s.tasks);
  const habits = useApp((s) => s.habits);
  const sessions = useApp((s) => s.sessions);
  const reviewLogs = useApp((s) => s.reviews);
  const ws = useApp((s) => s.settings.weekStartsOn);
  const [range, setRange] = useState<"7" | "28">("7");
  const today = todayKey();

  const all = useMemo(() => summarizeRange(tasks, habits, sessions, trailingStart(120), 120, ws, reviewLogs), [tasks, habits, sessions, ws, reviewLogs]);
  const last28 = all.slice(-28);
  const last7 = all.slice(-7);
  const prev7 = all.slice(-14, -7);
  const data = range === "7" ? last7 : last28;

  const xpTotal = all.reduce((n, d) => n + d.xp, 0);
  const lvl = levelFor(xpTotal);
  const ranking = useMemo(() => habitRanking(habits, today), [habits, today]);

  const sum = (arr: DaySummary[]) => {
    const t = arr.reduce((a, d) => ({ total: a.total + d.total, done: a.done + d.done, tasks: a.tasks + d.tasksDone, habits: a.habits + d.habitsDone, focus: a.focus + d.focus, xp: a.xp + d.xp, reviews: a.reviews + d.reviews }), { total: 0, done: 0, tasks: 0, habits: 0, focus: 0, xp: 0, reviews: 0 });
    return { ...t, rate: t.total ? t.done / t.total : 0 };
  };
  const wk = sum(last7);
  const pw = sum(prev7);
  const delta = wk.rate - pw.rate;
  const best = [...last7].filter((d) => d.total).sort((a, b) => b.rate - a.rate || b.done - a.done)[0];
  const consistency = consistencyScore(last28);
  const cards = useApp((s) => s.cards);
  const lstats = useMemo(() => learningStats(cards, reviewLogs), [cards, reviewLogs]);

  const milestones = ranking.flatMap((r) => MILESTONES.filter((m) => r.best >= m).map((m) => ({ habit: r.habit, m, unit: r.unit })));
  const upcoming = ranking
    .map((r) => ({ r, next: MILESTONES.find((m) => m > r.current) }))
    .filter((x) => x.next)
    .sort((a, b) => a.next! - a.r.current - (b.next! - b.r.current))
    .slice(0, 3);

  return (
    <Container>
      <PageHeader eyebrow="Your progress, gently measured" title="Stats" />

      <div className="flex flex-col gap-6 pb-16">
        {/* level card */}
        <Card className="relative overflow-hidden p-5 md:p-6">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full bg-[radial-gradient(closest-side,var(--ok-soft),transparent)]" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="grid size-16 place-items-center rounded-[18px] bg-ok-soft text-ok-text">
              <Sprout className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-fg-3">Level {lvl.level}</div>
              <div className="font-serif text-[32px] leading-tight">{lvl.name}</div>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={lvl.progress} barClass="bg-ok" className="h-2 max-w-[360px] flex-1" />
                <span className="font-mono text-[12px] tabular text-fg-3">{lvl.next ? `${lvl.toNext} XP to ${lvl.next.name}` : "Max level"}</span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-right max-sm:w-full max-sm:text-left">
              <div>
                <dt className="text-[11.5px] text-fg-3">Total XP</dt>
                <dd className="font-mono text-[22px] font-medium tabular">{xpTotal}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-fg-3">Today</dt>
                <dd className="font-mono text-[22px] font-medium tabular">
                  {all[all.length - 1].xp}
                  <span className="text-[13px] text-fg-4">/{MAX_DAILY_XP}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-fg-3">This week</dt>
                <dd className="font-mono text-[22px] font-medium tabular">{wk.xp}</dd>
              </div>
            </dl>
          </div>
          <div className="relative mt-5 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Level path">
            {LEVELS.map((l) => (
              <div key={l.level} className={cn("flex min-w-[88px] flex-1 flex-col gap-1 rounded-[8px] px-2 py-1.5 text-[11px]", l.level === lvl.level ? "bg-ok-soft text-fg" : l.level < lvl.level ? "text-fg-3" : "text-fg-4")}>
                <span className={cn("h-1 rounded-full", l.level <= lvl.level ? "bg-ok" : "bg-surface-3")} />
                <span className="truncate font-medium">{l.name}</span>
                <span className="font-mono tabular">{l.at} XP</span>
              </div>
            ))}
          </div>
          <p className="relative mt-3 text-[11.5px] text-fg-4">Earn up to {MAX_DAILY_XP} XP a day: completing what you planned (up to 7), focus sessions (up to 2) and learning reviews (up to 1). Steady days beat heroic ones.</p>
        </Card>

        {/* weekly summary */}
        <section aria-label="Weekly summary">
          <SectionLabel>Last 7 days</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            <SummaryTile label="Completion" value={`${Math.round(wk.rate * 100)}%`} icon={<CheckCircle2 className="text-ok-text" />} trend={delta} />
            <SummaryTile label="Tasks done" value={wk.tasks} icon={<CheckCircle2 className="text-fg-3" />} sub={`vs ${pw.tasks} prior week`} />
            <SummaryTile label="Habit check-ins" value={wk.habits} icon={<Repeat2 className="text-accent-text" />} sub={`vs ${pw.habits} prior week`} />
            <SummaryTile label="Focus sessions" value={wk.focus} icon={<Timer className="text-info" />} sub={`${wk.focus * 25} minutes`} />
            <SummaryTile label="Cards reviewed" value={wk.reviews} icon={<GraduationCap className="text-accent-text" />} sub={`${Math.round(lstats.accuracy7 * 100)}% accuracy`} />
          </div>
          {best && (
            <p className="mt-2.5 text-[12.5px] text-fg-3">
              Best day: <b className="font-medium text-fg-2">{relativeDayLabel(best.day)}</b> — {best.done} of {best.total} done · Consistency over 28 days <b className="font-medium text-fg-2">{Math.round(consistency * 100)}%</b>
            </p>
          )}
        </section>

        {/* chart */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold">Daily completion rate</h2>
              <p className="text-[12px] text-fg-3">Share of planned tasks and habits you finished each day</p>
            </div>
            <Segmented label="Range" size="xs" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "28", label: "28 days" }]} />
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {range === "7" ? (
                <BarChart data={data.map((d) => ({ ...d, pct: Math.round(d.rate * 100) }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" tickFormatter={(k) => format(fromKey(k), "EEE")} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-3)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-4)", fontSize: 11 }} />
                  <RTooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
                  <Bar dataKey="pct" radius={[6, 6, 2, 2]} maxBarSize={40} isAnimationActive={false}>
                    {data.map((d) => (
                      <Cell key={d.day} fill={d.day === today ? "var(--accent)" : "color-mix(in oklab, var(--accent) 30%, var(--surface-3))"} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={data.map((d) => ({ ...d, pct: Math.round(d.rate * 100) }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="day" tickFormatter={(k) => format(fromKey(k), "d")} tickLine={false} axisLine={false} interval={3} tick={{ fill: "var(--fg-3)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-4)", fontSize: 11 }} />
                  <RTooltip content={<ChartTip />} cursor={{ stroke: "var(--line-3)" }} />
                  <Area type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} fill="url(#area)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: "var(--accent)" }} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* daily breakdown */}
          <Card className="p-5">
            <h2 className="mb-3 text-[14px] font-semibold">Daily breakdown</h2>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-fg-4">
                  <th className="pb-2 font-medium">Day</th>
                  <th className="pb-2 text-right font-medium">Tasks</th>
                  <th className="pb-2 text-right font-medium">Habits</th>
                  <th className="pb-2 text-right font-medium">Focus</th>
                  <th className="pb-2 text-right font-medium">Cards</th>
                  <th className="pb-2 text-right font-medium">XP</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular">
                {[...last7].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className={cn("py-2 font-sans", d.day === today ? "font-medium text-accent-text" : "text-fg-2")}>{relativeDayLabel(d.day)}</td>
                    <td className="py-2 text-right">
                      {d.tasksDone}
                      <span className="text-fg-4">/{d.tasksTotal}</span>
                    </td>
                    <td className="py-2 text-right">
                      {d.habitsDone}
                      <span className="text-fg-4">/{d.habitsTotal}</span>
                    </td>
                    <td className="py-2 text-right">{d.focus}</td>
                    <td className="py-2 text-right">{d.reviews}</td>
                    <td className="py-2 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-surface-3 max-sm:hidden">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${(d.xp / MAX_DAILY_XP) * 100}%` }} />
                        </span>
                        {d.xp}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* habit ranking */}
          <Card className="p-5">
            <h2 className="mb-3 text-[14px] font-semibold">Habit ranking · 28 days</h2>
            {ranking.length === 0 ? (
              <EmptyState compact icon={<Repeat2 />} title="No habits yet" body="Create a habit to see how it ranks." />
            ) : (
              <ol className="flex flex-col gap-2.5">
                {ranking.map((r, i) => (
                  <li key={r.habit.id} className="flex items-center gap-3" style={toneVar(r.habit.tone)}>
                    <span className="w-4 text-right font-mono text-[12px] tabular text-fg-4">{i + 1}</span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-[8px] tone-soft tone-text [&_svg]:size-3.5">
                      <HabitIcon name={r.habit.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate">{r.habit.name}</span>
                        <span className="shrink-0 font-mono text-[12px] tabular text-fg-2">{Math.round(r.rate * 100)}%</span>
                      </span>
                      <ProgressBar value={r.rate} barClass="tone-solid" className="mt-1 h-1" />
                    </span>
                    <span className="flex w-10 shrink-0 items-center justify-end gap-0.5 font-mono text-[11.5px] tabular text-fg-3">
                      <Flame className="size-3 text-accent-2" />
                      {r.current}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* learning */}
        <Card className="flex flex-wrap items-center gap-5 p-5">
          <div className="grid size-11 place-items-center rounded-[12px] bg-accent-soft text-accent-text">
            <GraduationCap className="size-5" />
          </div>
          <div className="min-w-[180px] flex-1">
            <h2 className="text-[14px] font-semibold">Learning</h2>
            <p className="text-[12.5px] text-fg-3">
              {lstats.learned} cards learned · {lstats.dueToday} due today · {lstats.forecast.slice(1, 8).reduce((n, f) => n + f.count, 0)} due this week
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-fg-3"><Target className="size-3 text-ok-text" /> Accuracy 30d</dt>
              <dd className="font-mono text-[18px] font-medium tabular">{Math.round(lstats.accuracy30 * 100)}%</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-fg-3"><Brain className="size-3 text-accent-text" /> Strength</dt>
              <dd className="font-mono text-[18px] font-medium tabular">{Math.round(lstats.strength * 100)}%</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[11px] text-fg-3"><Flame className="size-3 text-accent-2" /> Streak</dt>
              <dd className="font-mono text-[18px] font-medium tabular">{lstats.streak}d</dd>
            </div>
          </dl>
          <Link href="/learn?tab=insights" className="text-[12.5px] font-medium text-accent-text hover:underline">
            Details
          </Link>
        </Card>

        {/* milestones */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="size-4 text-warn-text" />
            <h2 className="text-[14px] font-semibold">Milestone recap</h2>
            <span className="ml-auto text-[12px] text-fg-3">{milestones.length} earned</span>
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_280px]">
            <div className="flex flex-wrap gap-2">
              {milestones.length === 0 && <p className="text-[13px] text-fg-3">Your first milestone arrives at a 7-day streak.</p>}
              {milestones
                .sort((a, b) => b.m - a.m)
                .map(({ habit, m, unit }) => (
                  <span key={`${habit.id}${m}`} style={toneVar(habit.tone)} className="inline-flex h-8 items-center gap-2 rounded-full tone-soft pl-1 pr-3 text-[12.5px]">
                    <span className="grid size-6 place-items-center rounded-full tone-solid text-white [&_svg]:size-3">
                      <HabitIcon name={habit.icon} />
                    </span>
                    <span className="font-mono font-medium tabular">
                      {m}
                      {unit === "week" ? "w" : "d"}
                    </span>
                    <span className="max-w-[140px] truncate text-fg-2">{habit.name}</span>
                  </span>
                ))}
            </div>
            <div>
              <div className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-4">Coming up</div>
              <ul className="flex flex-col gap-2">
                {upcoming.map(({ r, next }) => (
                  <li key={r.habit.id} className="flex items-center gap-2 text-[12.5px]">
                    <Zap className="size-3.5 shrink-0 text-accent-text" />
                    <span className="min-w-0 flex-1 truncate">{r.habit.name}</span>
                    <span className="shrink-0 font-mono tabular text-fg-3">
                      {next! - r.current} to {next}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Container>
  );
}

function SummaryTile({ label, value, icon, trend, sub }: { label: string; value: React.ReactNode; icon: React.ReactNode; trend?: number; sub?: string }) {
  const T = trend == null ? null : trend > 0.02 ? TrendingUp : trend < -0.02 ? TrendingDown : Minus;
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-[24px] font-medium leading-none tabular">{value}</div>
      {T ? (
        <div className={cn("mt-1.5 flex items-center gap-1 text-[11.5px]", trend! > 0.02 ? "text-ok-text" : trend! < -0.02 ? "text-danger-text" : "text-fg-3")}>
          <T className="size-3" />
          {trend! > 0 ? "+" : ""}
          {Math.round(trend! * 100)} pts vs last week
        </div>
      ) : (
        sub && <div className="mt-1.5 text-[11.5px] text-fg-4">{sub}</div>
      )}
    </Card>
  );
}
