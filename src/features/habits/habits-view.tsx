"use client";
import { memo, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Flame, Trophy, MoreHorizontal, Pencil, Trash2, Archive, ArchiveRestore, Repeat2, Check, Award } from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { Container, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, toneVar, Badge, Bar } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Confirm } from "@/components/ui/dialog";
import { HabitIcon } from "@/components/habits/habit-icon";
import { MILESTONES, describeSchedule, isScheduledOn, nextMilestone, streaks, successRate, weekProgress } from "@/domain/habits";
import type { Habit } from "@/domain/types";
import { addDaysKey, fromKey, rangeKeys, todayKey, weekStartKey, WEEKDAY_MIN } from "@/lib/dates";
import { deleteHabit, toggleHabitCheckIn } from "@/features/tasks/task-actions";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export function HabitsView() {
  const habits = useApp((s) => s.habits);
  const ws = useApp((s) => s.settings.weekStartsOn);
  const openHabitEditor = useUI((s) => s.openHabitEditor);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const today = todayKey();

  const list = habits.filter((h) => (tab === "active" ? !h.archived : h.archived));
  const doneToday = habits.filter((h) => !h.archived && h.log.includes(today)).length;
  const scheduledToday = habits.filter((h) => !h.archived && isScheduledOn(h, today)).length;
  const active = habits.filter((h) => !h.archived);
  const avgRate = active.length ? active.reduce((n, h) => n + successRate(h, today), 0) / active.length : 0;

  return (
    <Container>
      <PageHeader
        eyebrow={`${doneToday} of ${scheduledToday} checked in today · ${Math.round(avgRate * 100)}% average over 28 days`}
        title="Habits"
        actions={
          <>
            <Segmented
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: "active", label: "Active" },
                { value: "archived", label: `Archived${habits.some((h) => h.archived) ? ` · ${habits.filter((h) => h.archived).length}` : ""}` },
              ]}
            />
            <Button variant="primary" onClick={() => openHabitEditor()}>
              <Plus /> New habit
            </Button>
          </>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<Repeat2 />}
          title={tab === "active" ? "Start with one small habit" : "No archived habits"}
          body={tab === "active" ? "Pick something you can do in two minutes. Consistency beats intensity." : "Archived habits keep their history and can be restored anytime."}
          action={
            tab === "active" && (
              <Button variant="primary" onClick={() => openHabitEditor()}>
                <Plus /> Create a habit
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 pb-16 md:grid-cols-2">
          {list.map((h) => (
            <HabitCard key={h.id} habit={h} ws={ws} />
          ))}
        </div>
      )}
    </Container>
  );
}

const HabitCard = memo(function HabitCard({ habit, ws }: { habit: Habit; ws: 0 | 1 }) {
  const today = todayKey();
  const openHabitEditor = useUI((s) => s.openHabitEditor);
  const updateHabit = useApp((s) => s.updateHabit);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(habit.name);
  const [confirm, setConfirm] = useState(false);

  const st = useMemo(() => streaks(habit, today, ws), [habit, today, ws]);
  const rate = useMemo(() => successRate(habit, today), [habit, today]);
  const wk = useMemo(() => weekProgress(habit, today, ws), [habit, today, ws]);
  const set = useMemo(() => new Set(habit.log), [habit.log]);
  const weekDays = rangeKeys(weekStartKey(today, ws), 7);
  const heat = useMemo(() => {
    // 12 weeks, column-major (each column = a week)
    const start = addDaysKey(weekStartKey(today, ws), -7 * 25);
    return rangeKeys(start, 182);
  }, [today, ws]);
  const next = nextMilestone(st.best);
  const unit = st.unit === "week" ? "wk" : "d";
  const created = habit.createdAt.slice(0, 10);

  const commitRename = () => {
    const v = name.trim();
    if (v && v !== habit.name) updateHabit(habit.id, { name: v });
    else setName(habit.name);
    setRenaming(false);
  };

  return (
    <Card className="flex flex-col p-5" style={toneVar(habit.tone)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] tone-soft tone-text [&_svg]:size-5">
          <HabitIcon name={habit.icon} />
        </span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setName(habit.name);
                  setRenaming(false);
                }
              }}
              aria-label="Habit name"
              maxLength={80}
              className="-ml-1 w-full rounded-[6px] bg-surface-2 px-1 text-[15px] font-semibold outline-none ring-2 ring-accent-line"
            />
          ) : (
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
              {habit.name}
            </h3>
          )}
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {describeSchedule(habit)}
            {habit.time != null && ` · ${Math.floor(habit.time / 60)}:${String(habit.time % 60).padStart(2, "0")}`}
          </p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${habit.name}`}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => openHabitEditor(habit.id)}>
              <Pencil /> Edit
            </MenuItem>
            <MenuItem onSelect={() => setTimeout(() => setRenaming(true), 50)}>
              <Pencil /> Rename
            </MenuItem>
            <MenuItem onSelect={() => updateHabit(habit.id, { archived: !habit.archived })}>
              {habit.archived ? <ArchiveRestore /> : <Archive />}
              {habit.archived ? "Restore" : "Archive"}
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => setConfirm(true)}>
              <Trash2 /> Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {/* stats row */}
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <dt className="flex items-center gap-1 text-[11.5px] text-fg-3">
            <Flame className="size-3 text-accent-2" /> Current
          </dt>
          <dd className="mt-1 font-mono text-[22px] font-medium leading-none tabular">
            {st.current}
            <span className="text-[12px] text-fg-3">{unit}</span>
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[11.5px] text-fg-3">
            <Trophy className="size-3 text-warn-text" /> Best
          </dt>
          <dd className="mt-1 font-mono text-[22px] font-medium leading-none tabular">
            {st.best}
            <span className="text-[12px] text-fg-3">{unit}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-fg-3">28-day rate</dt>
          <dd className="mt-1 font-mono text-[22px] font-medium leading-none tabular">
            {Math.round(rate * 100)}
            <span className="text-[12px] text-fg-3">%</span>
          </dd>
        </div>
      </dl>

      {/* this week */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[11.5px] text-fg-3">
          <span>This week</span>
          <span className="font-mono tabular">
            {wk.done}/{wk.target}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d) => {
            const done = set.has(d);
            const sched = isScheduledOn(habit, d);
            const future = d > today;
            const isT = d === today;
            const disabled = future || d < created;
            return (
              <Tooltip key={d} content={format(fromKey(d), "EEE, MMM d")}>
                <button
                  disabled={disabled || habit.archived}
                  onClick={() => toggleHabitCheckIn(habit, d)}
                  aria-pressed={done}
                  aria-label={`${format(fromKey(d), "EEEE")}${done ? ", done" : ""}`}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center gap-0.5 rounded-[9px] text-[10.5px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-95 disabled:active:scale-100",
                    done ? "tone-soft tone-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--tone)_30%,transparent)]" : sched && !future ? "bg-surface-2 text-fg-2 hover:tone-softer" : "bg-surface-2/50 text-fg-4",
                    isT && !done && "shadow-[inset_0_0_0_1.5px_var(--tone)]",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className={done ? "opacity-70" : ""}>{WEEKDAY_MIN[fromKey(d).getDay()]}</span>
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="font-mono tabular">{fromKey(d).getDate()}</span>}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* 12-week heat strip */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[11.5px] text-fg-3">
          <span>Last 26 weeks</span>
          <span className="font-mono tabular">{heat.filter((d) => set.has(d)).length} check-ins</span>
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Check-in history for the last 26 weeks`}>
          {heat.map((d) => {
            const done = set.has(d);
            const sched = isScheduledOn(habit, d);
            return (
              <span
                key={d}
                title={format(fromKey(d), "MMM d")}
                className={cn("aspect-square rounded-[2.5px]", d > today || d < created ? "bg-surface-2/60" : done ? "tone-solid opacity-90" : sched ? "bg-surface-3" : "bg-surface-2")}
              />
            );
          })}
        </div>
      </div>

      {/* milestones */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between text-[11.5px] text-fg-3">
          <span className="flex items-center gap-1">
            <Award className="size-3" /> Milestones
          </span>
          {st.best < MILESTONES[MILESTONES.length - 1] && (
            <span>
              <span className="font-mono tabular">{Math.max(0, next - st.current)}</span> {unit === "wk" ? "weeks" : "days"} to {next}
            </span>
          )}
        </div>
        <Bar value={st.current / next} barClass="tone-solid" className="mb-3" />
        <div className="flex flex-wrap gap-1.5">
          {[7, 30, 100].map((m) => {
            const got = st.best >= m;
            return (
              <Badge key={m} tone={got ? habit.tone : undefined} variant={got ? "soft" : "outline"} className={cn(!got && "text-fg-4")}>
                {got ? <Check /> : null}
                {m} {unit === "wk" ? "weeks" : "days"}
              </Badge>
            );
          })}
        </div>
      </div>

      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${habit.name}"?`}
        description={`This removes ${habit.log.length} check-ins. You can undo right after.`}
        onConfirm={() => deleteHabit(habit)}
      />
    </Card>
  );
});
