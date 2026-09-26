"use client";
import { memo, useMemo, useRef, useState } from "react";
import type { DayKey, Habit, TaskOccurrence } from "@/domain/types";
import { EventBlock, HabitBlock, type BlockGeometry } from "./event-block";
import { layoutDay, snap } from "./layout";
import { fmtRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface DragGhost {
  day: DayKey;
  start: number | null;
  duration: number;
  title: string;
  tone: string;
}

/**
 * One day of the time grid. Owns: block layout, drag-to-create on empty
 * space (mouse/pen), tap-a-slot (touch / move mode), now-line, drop ghost.
 */
export const DayColumn = memo(function DayColumn({
  day,
  items,
  habits,
  startHour,
  endHour,
  pxPerMin,
  isToday,
  nowMin,
  ghost,
  selectedKey,
  coarse,
  moving,
  isWeekend,
  onOpen,
  onTapSelect,
  onResize,
  onCreate,
  onSlotTap,
  onHabitToggle,
}: {
  day: DayKey;
  items: TaskOccurrence[];
  habits: { habit: Habit; done: boolean }[];
  startHour: number;
  endHour: number;
  pxPerMin: number;
  isToday: boolean;
  nowMin: number;
  ghost: DragGhost | null;
  selectedKey?: string;
  coarse: boolean;
  moving: boolean;
  isWeekend: boolean;
  onOpen: (o: TaskOccurrence) => void;
  onTapSelect: (o: TaskOccurrence) => void;
  onResize: (o: TaskOccurrence, duration: number) => void;
  onCreate: (day: DayKey, start: number, duration: number) => void;
  onSlotTap: (day: DayKey, start: number) => void;
  onHabitToggle: (h: Habit, day: DayKey) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const base = startHour * 60;
  const maxEnd = endHour * 60;
  const [creating, setCreating] = useState<{ a: number; b: number } | null>(null);
  const createRef = useRef<{ a: number; id: number } | null>(null);

  const geos = useMemo(() => {
    const visible = items.map((o) => ({ id: o.key, start: Math.max(base, o.start!), end: Math.min(maxEnd, o.start! + Math.max(o.duration, 15)) }));
    const lay = layoutDay(visible);
    const m = new Map<string, BlockGeometry>();
    for (const v of visible) {
      const l = lay.get(v.id)!;
      const w = 100 / l.lanes;
      m.set(v.id, {
        top: (v.start - base) * pxPerMin + 1,
        height: Math.max(20, (v.end - v.start) * pxPerMin - 2),
        left: `calc(${l.lane * w}% + 2px)`,
        width: `calc(${w * l.span}% - ${l.lanes > 1 ? 3 : 6}px)`,
      });
    }
    return m;
  }, [items, base, maxEnd, pxPerMin]);

  const minuteAt = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(base, Math.min(maxEnd - 15, base + (clientY - r.top) / pxPerMin));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType === "touch" || moving) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const a = Math.floor(minuteAt(e.clientY) / 15) * 15;
    createRef.current = { a, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setCreating({ a, b: a + 30 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!createRef.current) return;
    const m = snap(minuteAt(e.clientY));
    const a = createRef.current.a;
    setCreating(m >= a ? { a, b: Math.max(a + 15, m) } : { a: m, b: a + 15 });
  };
  const onPointerUp = () => {
    if (!createRef.current || !creating) return;
    createRef.current = null;
    const { a, b } = creating;
    setCreating(null);
    onCreate(day, a, Math.max(15, b - a));
  };

  const slotTap = (e: React.MouseEvent) => {
    if (!coarse && !moving) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    onSlotTap(day, Math.floor(minuteAt(e.clientY) / 15) * 15);
  };

  const height = (endHour - startHour) * 60 * pxPerMin;

  return (
    <div
      ref={ref}
      data-drop-day={day}
      data-drop-kind="timed"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        createRef.current = null;
        setCreating(null);
      }}
      onClick={slotTap}
      className={cn(
        "relative min-w-0 flex-1 border-l border-line",
        isWeekend && "bg-bg-sunken/60",
        isToday && "bg-accent-soft/25",
        moving && "cursor-copy",
        !coarse && "cursor-crosshair",
      )}
      style={{ height }}
    >
      {/* half-hour guides */}
      {Array.from({ length: endHour - startHour }).map((_, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: i * 60 * pxPerMin }}>
          <div className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: 30 * pxPerMin }} />
        </div>
      ))}

      {items.map((o) => (
        <EventBlock
          key={o.key}
          occ={o}
          geo={geos.get(o.key)!}
          pxPerMin={pxPerMin}
          maxEnd={maxEnd}
          selected={selectedKey === o.key}
          coarse={coarse}
          onOpen={onOpen}
          onTapSelect={onTapSelect}
          onResize={onResize}
        />
      ))}

      {habits.map(({ habit, done }) =>
        habit.time != null && habit.time >= base && habit.time < maxEnd ? (
          <HabitBlock key={habit.id} habit={habit} done={done} top={(habit.time - base) * pxPerMin + 2} onToggle={() => onHabitToggle(habit, day)} />
        ) : null,
      )}

      {creating && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 z-[6] rounded-[7px] border border-accent bg-accent-soft px-2 py-1 shadow-md"
          style={{ top: (creating.a - base) * pxPerMin, height: Math.max(14, (creating.b - creating.a) * pxPerMin) }}
        >
          <div className="font-mono text-[10.5px] font-medium tabular text-accent-text">{fmtRange(creating.a, creating.b - creating.a)}</div>
        </div>
      )}

      {ghost && ghost.day === day && ghost.start != null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 z-[6] rounded-[7px] border-[1.5px] border-dashed border-[var(--tone)] bg-[color-mix(in_oklab,var(--tone)_16%,transparent)] px-2 py-1"
          style={{ ["--tone" as string]: ghost.tone, top: (ghost.start - base) * pxPerMin, height: Math.max(16, ghost.duration * pxPerMin - 2) }}
        >
          <div className="truncate text-[11.5px] font-medium">{ghost.title}</div>
          <div className="font-mono text-[10.5px] tabular text-fg-2">{fmtRange(ghost.start, ghost.duration)}</div>
        </div>
      )}

      {isToday && nowMin >= base && nowMin <= maxEnd && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[7] flex items-center" style={{ top: (nowMin - base) * pxPerMin - 1 }}>
          <span className="-ml-[5px] size-[9px] rounded-full bg-accent" />
          <span className="h-[2px] flex-1 bg-accent" />
        </div>
      )}
    </div>
  );
});
