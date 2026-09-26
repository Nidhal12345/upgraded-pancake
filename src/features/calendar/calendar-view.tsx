"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowUpRight, Plus, Repeat2, CalendarPlus } from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { useOccurrences } from "@/data/selectors";
import { Container, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, toneVar } from "@/components/ui/misc";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitCheckTile } from "@/components/habits/habit-check";
import { Tooltip } from "@/components/ui/tooltip";
import { isScheduledOn } from "@/domain/habits";
import type { DayKey } from "@/domain/types";
import { addDaysKey, diffDays, fromKey, rangeKeys, relativeDayLabel, toKey, todayKey, weekStartKey, WEEKDAY_SHORT } from "@/lib/dates";
import { isTypingTarget } from "@/components/shell/shortcuts";
import { cn, pluralize } from "@/lib/utils";

export function CalendarView() {
  const router = useRouter();
  const params = useSearchParams();
  const today = todayKey();
  const ws = useApp((s) => s.settings.weekStartsOn);
  const habits = useApp((s) => s.habits);
  const openQuickAdd = useUI((s) => s.openQuickAdd);

  const m = params.get("m");
  const month = useMemo(() => (m && /^\d{4}-\d{2}$/.test(m) ? fromKey(`${m}-01`) : startOfMonth(new Date())), [m]);
  const [selected, setSelected] = useState<DayKey>(today);

  const grid = useMemo(() => {
    const first = weekStartKey(toKey(month), ws);
    const last = toKey(endOfMonth(month));
    return rangeKeys(first, Math.ceil((diffDays(last, first) + 1) / 7) * 7);
  }, [month, ws]);
  const occ = useOccurrences(grid[0], grid[grid.length - 1]);

  const stats = useMemo(() => {
    const map = new Map<DayKey, { tasks: number; done: number; habits: number; habitsDone: number; tones: string[] }>();
    for (const d of grid) map.set(d, { tasks: 0, done: 0, habits: 0, habitsDone: 0, tones: [] });
    for (const o of occ) {
      const s = map.get(o.date);
      if (!s || o.status === "cancelled") continue;
      s.tasks++;
      if (o.status === "done") s.done++;
      if (s.tones.length < 4) s.tones.push(o.task.tone);
    }
    for (const h of habits) {
      if (h.archived) continue;
      const set = new Set(h.log);
      for (const d of grid) {
        const s = map.get(d)!;
        const sched = h.schedule.kind === "weekly" ? set.has(d) : isScheduledOn(h, d);
        if (sched && d <= today) s.habits++;
        else if (sched && h.schedule.kind !== "weekly") s.habits++;
        if (set.has(d)) s.habitsDone++;
      }
    }
    return map;
  }, [grid, occ, habits, today]);

  const setMonth = (d: Date) => {
    const k = format(d, "yyyy-MM");
    router.replace(k === format(new Date(), "yyyy-MM") ? "/calendar" : `/calendar?m=${k}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (moves[e.key] != null) {
        e.preventDefault();
        const n = addDaysKey(selected, moves[e.key]);
        setSelected(n);
        if (fromKey(n).getMonth() !== month.getMonth()) setMonth(fromKey(n));
      } else if (e.key === "t") {
        setSelected(today);
        setMonth(new Date());
      } else if (e.key === "[") setMonth(addMonths(month, -1));
      else if (e.key === "]") setMonth(addMonths(month, 1));
      else if (e.key === "Enter") router.push(`/week?date=${selected}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const heads = ws === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const selOcc = occ.filter((o) => o.date === selected);
  const selHabits = habits.filter((h) => !h.archived && isScheduledOn(h, selected) && (h.schedule.kind !== "weekly" || h.log.includes(selected) || selected >= today));
  const monthTotals = useMemo(() => {
    let t = 0, d = 0, active = 0;
    for (const [k, s] of stats) {
      if (fromKey(k).getMonth() !== month.getMonth()) continue;
      t += s.tasks;
      d += s.done;
      if (s.tasks || s.habitsDone) active++;
    }
    return { t, d, active };
  }, [stats, month]);

  return (
    <Container wide>
      <PageHeader
        eyebrow={`${monthTotals.active} active days · ${monthTotals.d}/${monthTotals.t} tasks done`}
        title={
          <>
            {format(month, "MMMM")} <span className="text-fg-3">{format(month, "yyyy")}</span>
          </>
        }
        actions={
          <>
            <Tooltip content="Previous month" shortcut={["["]}>
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                <ChevronLeft />
              </Button>
            </Tooltip>
            <Button
              size="sm"
              onClick={() => {
                setSelected(today);
                setMonth(new Date());
              }}
            >
              Today
            </Button>
            <Tooltip content="Next month" shortcut={["]"]}>
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight />
              </Button>
            </Tooltip>
          </>
        }
      />

      <div className="grid gap-6 pb-16 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line">
            {heads.map((d) => (
              <div key={d} className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.07em] text-fg-4 max-sm:px-0 max-sm:text-center">
                {WEEKDAY_SHORT[d]}
              </div>
            ))}
          </div>
          <div role="grid" aria-label={format(month, "MMMM yyyy")} className="grid grid-cols-7">
            {grid.map((d, i) => {
              const s = stats.get(d)!;
              const inMonth = fromKey(d).getMonth() === month.getMonth();
              const isT = d === today;
              const sel = d === selected;
              const past = d < today;
              const has = s.tasks > 0 || s.habitsDone > 0;
              const intensity = s.tasks + s.habitsDone;
              return (
                <button
                  key={d}
                  role="gridcell"
                  aria-selected={sel}
                  aria-label={`${format(fromKey(d), "EEEE, MMMM d")}: ${pluralize(s.tasks, "task")}, ${s.habitsDone} of ${s.habits} habits`}
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => router.push(`/week?date=${d}`)}
                  className={cn(
                    "group relative flex min-h-[64px] flex-col items-start gap-1 border-line p-2 text-left outline-none transition-colors sm:min-h-[108px] sm:p-2.5",
                    i % 7 !== 0 && "border-l",
                    i >= 7 && "border-t",
                    !inMonth && "bg-surface-2/70",
                    sel ? "bg-selected shadow-[inset_0_0_0_1.5px_var(--accent-line)]" : "hover:bg-hover",
                    "focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full font-mono text-[12.5px] font-medium tabular",
                        isT ? "bg-accent text-accent-fg" : !inMonth ? "text-fg-4" : has ? "text-fg" : "text-fg-3",
                      )}
                    >
                      {fromKey(d).getDate()}
                    </span>
                    {has && intensity > 0 && (
                      <span className="hidden font-mono text-[10.5px] tabular text-fg-4 group-hover:inline max-sm:!hidden">{intensity}</span>
                    )}
                  </div>
                  {/* desktop detail */}
                  <div className="mt-auto hidden w-full flex-col gap-1 sm:flex">
                    {s.tasks > 0 && (
                      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-2">
                        <span className="flex -space-x-0.5">
                          {s.tones.map((t, j) => (
                            <span key={j} style={toneVar(t as never)} className="size-2 rounded-full tone-solid ring-2 ring-surface" />
                          ))}
                        </span>
                        <span className="font-mono tabular">
                          {past || isT ? `${s.done}/${s.tasks}` : s.tasks}
                        </span>
                        <span className="text-fg-4">{s.tasks === 1 ? "task" : "tasks"}</span>
                      </div>
                    )}
                    {s.habits > 0 && (past || isT) && (
                      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
                        <Repeat2 className="size-3 text-fg-4" />
                        <span className="font-mono tabular">
                          {s.habitsDone}/{s.habits}
                        </span>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-ok" style={{ width: `${(s.habitsDone / Math.max(1, s.habits)) * 100}%` }} />
                        </span>
                      </div>
                    )}
                  </div>
                  {/* mobile dots */}
                  <div className="mt-auto flex gap-[3px] sm:hidden">
                    {s.tasks > 0 && <span className="size-[5px] rounded-full bg-fg-3" />}
                    {s.habitsDone > 0 && <span className="size-[5px] rounded-full bg-ok" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* selected day panel */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-medium text-fg-3">{format(fromKey(selected), "EEEE")}</div>
              <h2 className="font-serif text-[28px] leading-tight">{relativeDayLabel(selected) === format(fromKey(selected), "EEEE") ? format(fromKey(selected), "MMMM d") : relativeDayLabel(selected)}</h2>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => openQuickAdd({ date: selected })}>
                <Plus /> Add
              </Button>
              <Button size="sm" asChild>
                <Link href={`/week?date=${selected}`}>
                  Plan <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
          {selOcc.length === 0 && selHabits.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={<CalendarPlus />}
                title="Nothing on this day"
                body={selected < today ? "No tasks or habits were logged." : "An open day. Add something, or leave it free."}
                action={
                  selected >= today ? (
                    <Button size="sm" variant="primary" onClick={() => openQuickAdd({ date: selected })}>
                      <Plus /> Add task
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <>
              {selOcc.length > 0 && (
                <Card className="p-1.5">
                  {selOcc.map((o) => (
                    <TaskRow key={o.key} occ={o} dense />
                  ))}
                </Card>
              )}
              {selHabits.length > 0 && (
                <div className="grid gap-1.5">
                  {selHabits.map((h) => (
                    <HabitCheckTile key={h.id} habit={h} day={selected} weekStartsOn={ws} />
                  ))}
                </div>
              )}
            </>
          )}
          <p className="text-[11.5px] text-fg-4 max-md:hidden">Arrow keys move the selection · Enter opens the day in the planner</p>
        </aside>
      </div>
    </Container>
  );
}
