"use client";
import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Check, Repeat } from "lucide-react";
import type { DayKey, Habit, TaskOccurrence } from "@/domain/types";
import { toneVar } from "@/components/ui/misc";
import { HabitIcon } from "@/components/habits/habit-icon";
import { StatusCheck } from "@/components/ui/check";
import { toggleOccurrence } from "@/features/tasks/task-actions";
import { Context, ContextContent, ContextTrigger } from "@/components/ui/menu";
import { OccurrenceMenuItems } from "@/components/tasks/task-row";
import { cn } from "@/lib/utils";

export const ANYTIME_LIMIT = 3;

const AnytimeChip = memo(function AnytimeChip({
  occ,
  coarse,
  selected,
  onOpen,
  onTapSelect,
}: {
  occ: TaskOccurrence;
  coarse: boolean;
  selected: boolean;
  onOpen: (o: TaskOccurrence) => void;
  onTapSelect: (o: TaskOccurrence) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: occ.key, data: { occ } });
  const done = occ.status === "done";
  return (
    <Context>
      <ContextTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          data-block
          role="button"
          aria-label={`${occ.title}, anytime`}
          onClick={(e) => {
            e.stopPropagation();
            if (coarse) onTapSelect(occ);
            else onOpen(occ);
          }}
          onKeyDown={(e) => e.key === "Enter" && onOpen(occ)}
          style={{ ...toneVar(occ.task.tone), touchAction: "manipulation" }}
          className={cn(
            "group flex h-[26px] min-w-0 select-none items-center gap-1.5 rounded-[6px] bg-surface pl-1.5 pr-2 text-[12px] shadow-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            done && "opacity-55",
            occ.status === "cancelled" && "opacity-40 line-through",
            isDragging && "opacity-30",
            selected && "ring-2 ring-[var(--tone)]",
          )}
        >
          <StatusCheck status={occ.status} size={13} onToggle={() => toggleOccurrence(occ)} label={`Complete ${occ.title}`} />
          <span className={cn("min-w-0 flex-1 truncate", done && "text-fg-3")}>{occ.title}</span>
          {occ.recurring && <Repeat className="size-2.5 shrink-0 text-fg-4" />}
          <span className="h-3 w-[2px] shrink-0 rounded-full tone-solid" />
        </div>
      </ContextTrigger>
      <ContextContent>
        <OccurrenceMenuItems occ={occ} />
      </ContextContent>
    </Context>
  );
});

export const AnytimeCell = memo(function AnytimeCell({
  day,
  items,
  habits,
  expanded,
  onExpand,
  coarse,
  moving,
  selectedKey,
  ghostHere,
  isToday,
  onOpen,
  onTapSelect,
  onTap,
  onHabitToggle,
}: {
  day: DayKey;
  items: TaskOccurrence[];
  habits: { habit: Habit; done: boolean }[];
  expanded: boolean;
  onExpand: () => void;
  coarse: boolean;
  moving: boolean;
  selectedKey?: string;
  ghostHere: { title: string } | null;
  isToday: boolean;
  onOpen: (o: TaskOccurrence) => void;
  onTapSelect: (o: TaskOccurrence) => void;
  onTap: (day: DayKey) => void;
  onHabitToggle: (h: Habit, day: DayKey) => void;
}) {
  const total = items.length + habits.length;
  const visible = expanded ? items : items.slice(0, ANYTIME_LIMIT);
  const hidden = items.length - visible.length;
  return (
    <div
      data-drop-day={day}
      data-drop-kind="anytime"
      onClick={() => (moving || coarse) && onTap(day)}
      className={cn(
        "flex min-h-[40px] min-w-0 flex-1 flex-col gap-1 border-l border-line p-1",
        isToday && "bg-accent-soft/25",
        ghostHere && "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent-line)]",
        moving && "cursor-copy",
      )}
    >
      {habits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {habits.map(({ habit, done }) => (
            <button
              key={habit.id}
              onClick={(e) => {
                e.stopPropagation();
                onHabitToggle(habit, day);
              }}
              aria-pressed={done}
              aria-label={`${habit.name}${done ? ", done" : ""}`}
              title={habit.name}
              style={toneVar(habit.tone)}
              className={cn(
                "grid size-[22px] place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-3",
                done ? "tone-solid text-white" : "border border-dashed tone-line tone-text hover:tone-soft",
              )}
            >
              {done ? <Check strokeWidth={3} /> : <HabitIcon name={habit.icon} />}
            </button>
          ))}
        </div>
      )}
      {visible.map((o) => (
        <AnytimeChip key={o.key} occ={o} coarse={coarse} selected={selectedKey === o.key} onOpen={onOpen} onTapSelect={onTapSelect} />
      ))}
      {hidden > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="h-[22px] rounded-[5px] px-1.5 text-left text-[11.5px] font-medium text-fg-3 outline-none hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          +{hidden} more
        </button>
      )}
      {ghostHere && <div className="truncate rounded-[6px] border border-dashed border-accent px-2 py-1 text-[11.5px] text-fg-2">{ghostHere.title}</div>}
      {total === 0 && !ghostHere && <span className="sr-only">No anytime items</span>}
    </div>
  );
});
