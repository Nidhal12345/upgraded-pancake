"use client";
import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysKey, fromKey, rangeKeys, toKey, todayKey, weekStartKey, WEEKDAY_MIN, diffDays } from "@/lib/dates";
import type { DayKey } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Compact keyboard-navigable month grid. Arrow keys move, Enter selects. */
export function MiniCalendar({
  value,
  onChange,
  weekStartsOn = 1,
  marks,
}: {
  value?: DayKey;
  onChange: (d: DayKey) => void;
  weekStartsOn?: 0 | 1;
  marks?: Set<DayKey>;
}) {
  const today = todayKey();
  const [month, setMonth] = useState(() => startOfMonth(fromKey(value ?? today)));
  const [focus, setFocus] = useState<DayKey>(value ?? today);
  const days = useMemo(() => {
    const first = weekStartKey(toKey(month), weekStartsOn);
    const last = toKey(endOfMonth(month));
    const n = Math.ceil((diffDays(last, first) + 1) / 7) * 7;
    return rangeKeys(first, n);
  }, [month, weekStartsOn]);
  const heads = weekStartsOn === 1 ? [...WEEKDAY_MIN.slice(1), WEEKDAY_MIN[0]] : WEEKDAY_MIN;

  const move = (d: number) => {
    const n = addDaysKey(focus, d);
    setFocus(n);
    if (fromKey(n).getMonth() !== month.getMonth()) setMonth(startOfMonth(fromKey(n)));
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-mc-day="${n}"]`)?.focus());
  };

  return (
    <div className="w-[252px] p-2">
      <div className="mb-1 flex items-center justify-between pl-1.5">
        <span className="text-[13px] font-medium">{format(month, "MMMM yyyy")}</span>
        <div className="flex">
          <button aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))} className="grid size-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg [&_svg]:size-4">
            <ChevronLeft />
          </button>
          <button aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} className="grid size-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg [&_svg]:size-4">
            <ChevronRight />
          </button>
        </div>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-px text-center">
        {heads.map((h, i) => (
          <div key={i} className="py-1 text-[11px] font-medium text-fg-4">
            {h}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = fromKey(d).getMonth() === month.getMonth();
          const sel = d === value;
          const isToday = d === today;
          return (
            <button
              key={d}
              data-mc-day={d}
              tabIndex={d === focus ? 0 : -1}
              onClick={() => onChange(d)}
              onKeyDown={(e) => {
                const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                if (k) {
                  e.preventDefault();
                  move(k);
                }
              }}
              aria-label={format(fromKey(d), "EEEE, MMMM d")}
              aria-pressed={sel}
              className={cn(
                "relative mx-auto grid size-8 place-items-center rounded-[7px] font-mono text-[12px] tabular outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                !inMonth && "text-fg-4",
                inMonth && !sel && "text-fg hover:bg-surface-3",
                sel && "bg-accent text-accent-fg",
                isToday && !sel && "font-semibold text-accent-text",
              )}
            >
              {fromKey(d).getDate()}
              {marks?.has(d) && !sel && <span className="absolute bottom-1 size-[3px] rounded-full bg-fg-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
