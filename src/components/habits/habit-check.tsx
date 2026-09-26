"use client";
import { memo, useMemo } from "react";
import { Check, Flame } from "lucide-react";
import type { DayKey, Habit } from "@/domain/types";
import { HabitIcon } from "./habit-icon";
import { toneVar } from "@/components/ui/misc";
import { streaks, weekProgress, describeSchedule } from "@/domain/habits";
import { toggleHabitCheckIn } from "@/features/tasks/task-actions";
import { fmtTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** A tappable habit tile for a specific day. */
export const HabitCheckTile = memo(function HabitCheckTile({ habit, day, weekStartsOn = 1 }: { habit: Habit; day: DayKey; weekStartsOn?: 0 | 1 }) {
  const done = habit.log.includes(day);
  const { current } = useMemo(() => streaks(habit, day, weekStartsOn), [habit, day, weekStartsOn]);
  const wk = useMemo(() => (habit.schedule.kind === "weekly" ? weekProgress(habit, day, weekStartsOn) : null), [habit, day, weekStartsOn]);

  return (
    <button
      onClick={() => toggleHabitCheckIn(habit, day)}
      aria-pressed={done}
      aria-label={`${habit.name}${done ? ", done" : ""}`}
      style={toneVar(habit.tone)}
      className={cn(
        "group relative flex min-h-[60px] w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.985]",
        done ? "tone-softer shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--tone)_28%,transparent)]" : "bg-surface shadow-sm hover:shadow-md",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors [&_svg]:size-[18px]", done ? "tone-solid text-white" : "tone-soft tone-text")}>
        <HabitIcon name={habit.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px] font-medium", done && "text-fg-2")}>{habit.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-3">
          {wk ? (
            <span className="font-mono tabular">
              {wk.done}/{wk.target} this week
            </span>
          ) : (
            <span className="truncate">{habit.time != null ? fmtTime(habit.time) : describeSchedule(habit)}</span>
          )}
          {current > 0 && (
            <span className="flex items-center gap-0.5 font-mono tabular text-fg-2">
              <Flame className="size-3 text-accent-2" />
              {current}
              {habit.schedule.kind === "weekly" ? "w" : "d"}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full transition-all duration-200",
          done ? "tone-solid text-white" : "border-[1.5px] border-line-3 text-transparent group-hover:border-[var(--tone)] group-hover:text-[var(--tone)]",
        )}
      >
        <Check className={cn("size-3.5", done && "animate-pop")} strokeWidth={3} />
      </span>
    </button>
  );
});
