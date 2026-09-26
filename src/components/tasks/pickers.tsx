"use client";
import { useMemo, useState } from "react";
import { CalendarDays, Clock, Repeat, Hourglass, Check, X, Sunrise, ArrowRight, CalendarOff } from "lucide-react";
import type { DayKey, Recurrence, Tone } from "@/domain/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { addDaysKey, fmtDuration, fmtTime, relativeDayLabel, todayKey, weekdayOf, WEEKDAY_MIN, WEEKDAY_SHORT } from "@/lib/dates";
import { describeRecurrence } from "@/domain/recurrence";
import { TONES, TONE_LABEL, toneVar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const chipClass =
  "inline-flex h-7 max-w-full items-center gap-1.5 rounded-[7px] border border-line-2 bg-surface px-2 text-[12.5px] text-fg-2 outline-none transition-colors hover:border-line-3 hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[active=true]:border-accent-line data-[active=true]:bg-accent-soft data-[active=true]:text-fg [&_svg]:size-3.5 [&_svg]:shrink-0";

const opt =
  "flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2 text-left text-[13px] outline-none hover:bg-surface-3/80 focus-visible:bg-surface-3/80 [&_svg]:size-4 [&_svg]:text-fg-3";

export function DateChip({ value, onChange, weekStartsOn = 1, allowClear = true }: { value?: DayKey; onChange: (d?: DayKey) => void; weekStartsOn?: 0 | 1; allowClear?: boolean }) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const pick = (d?: DayKey) => {
    onChange(d);
    setOpen(false);
  };
  const nextMon = addDaysKey(today, ((8 - weekdayOf(today)) % 7) || 7);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={chipClass} data-active={!!value}>
          <CalendarDays />
          <span className="truncate">{value ? relativeDayLabel(value) : "No date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-line p-1">
          <button className={opt} onClick={() => pick(today)}>
            <Sunrise /> Today <span className="ml-auto text-[11.5px] text-fg-4">{WEEKDAY_SHORT[weekdayOf(today)]}</span>
          </button>
          <button className={opt} onClick={() => pick(addDaysKey(today, 1))}>
            <ArrowRight /> Tomorrow <span className="ml-auto text-[11.5px] text-fg-4">{WEEKDAY_SHORT[weekdayOf(addDaysKey(today, 1))]}</span>
          </button>
          <button className={opt} onClick={() => pick(nextMon)}>
            <CalendarDays /> Next week <span className="ml-auto text-[11.5px] text-fg-4">Mon</span>
          </button>
          {allowClear && (
            <button className={opt} onClick={() => pick(undefined)}>
              <CalendarOff /> No date
            </button>
          )}
        </div>
        <MiniCalendar value={value} onChange={(d) => pick(d)} weekStartsOn={weekStartsOn} />
      </PopoverContent>
    </Popover>
  );
}

export function TimeChip({ value, onChange }: { value?: number | null; onChange: (m: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const slots = useMemo(() => Array.from({ length: (24 - 5) * 4 }, (_, i) => 5 * 60 + i * 15), []);
  const commitText = () => {
    const m = text.trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
    if (m) {
      let h = parseInt(m[1], 10);
      if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
      const mm = m[2] ? parseInt(m[2], 10) : 0;
      if (h < 24 && mm < 60) {
        onChange(h * 60 + mm);
        setOpen(false);
      }
    }
    setText("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={chipClass} data-active={value != null}>
          <Clock />
          {value != null ? fmtTime(value) : "Anytime"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            }
          }}
          placeholder="Type a time, e.g. 14:30"
          className="mb-1 h-8 w-full rounded-[7px] bg-surface-2 px-2.5 text-[13px] outline-none placeholder:text-fg-4"
        />
        <button
          className={opt}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          <X /> Anytime
        </button>
        <div className="max-h-[220px] overflow-y-auto" ref={(el) => el?.querySelector("[data-selected=true]")?.scrollIntoView({ block: "center" })}>
          {slots.map((m) => (
            <button
              key={m}
              data-selected={value === m || (value == null && m === 9 * 60)}
              className={cn(opt, "font-mono text-[12.5px] tabular", value === m && "bg-accent-soft text-fg")}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              {fmtTime(m)}
              {value === m && <Check className="ml-auto !text-accent" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
export function DurationChip({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={chipClass}>
          <Hourglass />
          {fmtDuration(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px]">
        {DURATIONS.map((d) => (
          <button
            key={d}
            className={cn(opt, value === d && "bg-accent-soft")}
            onClick={() => {
              onChange(d);
              setOpen(false);
            }}
          >
            {fmtDuration(d)}
            {value === d && <Check className="ml-auto !text-accent" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function RecurrenceChip({ value, onChange, anchor }: { value?: Recurrence; onChange: (r?: Recurrence) => void; anchor?: DayKey }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<number[]>(value?.freq === "custom" ? (value.days ?? []) : []);
  const [interval, setInterval] = useState(value?.interval ?? 1);
  const wd = weekdayOf(anchor ?? todayKey());
  const presets: { label: string; r?: Recurrence }[] = [
    { label: "Does not repeat", r: undefined },
    { label: "Every day", r: { freq: "daily" } },
    { label: "Every weekday", r: { freq: "weekdays" } },
    { label: `Every week on ${WEEKDAY_SHORT[wd]}`, r: { freq: "weekly", days: [wd] } },
    { label: "Every month", r: { freq: "monthly" } },
  ];
  const isSel = (r?: Recurrence) => (!r && !value) || (r && value && r.freq === value.freq && value.freq !== "custom");
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setCustom(value?.freq === "custom" ? (value.days ?? []) : value?.freq === "weekly" ? (value.days ?? [wd]) : [wd]);
          setInterval(value?.interval ?? 1);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button className={chipClass} data-active={!!value}>
          <Repeat />
          <span className="truncate">{value ? describeRecurrence(value, anchor) : "Repeat"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px]">
        {presets.map((p) => (
          <button
            key={p.label}
            className={cn(opt, isSel(p.r) && "bg-accent-soft")}
            onClick={() => {
              onChange(p.r);
              setOpen(false);
            }}
          >
            {p.label}
            {isSel(p.r) && <Check className="ml-auto !text-accent" />}
          </button>
        ))}
        <div className="mt-1 border-t border-line px-2 pb-1.5 pt-2.5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-4">Custom days</div>
          <div className="flex justify-between gap-1">
            {order.map((d) => {
              const on = custom.includes(d);
              return (
                <button
                  key={d}
                  aria-pressed={on}
                  aria-label={WEEKDAY_SHORT[d]}
                  onClick={() => setCustom((c) => (on ? c.filter((x) => x !== d) : [...c, d]))}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[11.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    on ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2 hover:bg-surface-3",
                  )}
                >
                  {WEEKDAY_MIN[d]}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-fg-2">
            Every
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="h-7 rounded-[6px] bg-surface-2 px-1.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {interval === 1 ? "week" : "weeks"}
            <button
              disabled={!custom.length}
              onClick={() => {
                onChange({ freq: "custom", days: [...custom].sort(), interval: interval > 1 ? interval : undefined });
                setOpen(false);
              }}
              className="ml-auto h-7 rounded-[6px] bg-accent px-2.5 text-[12px] font-medium text-accent-fg disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TonePicker({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5">
      {TONES.map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={value === t}
          aria-label={TONE_LABEL[t]}
          title={TONE_LABEL[t]}
          onClick={() => onChange(t)}
          style={toneVar(t)}
          className={cn(
            "grid size-6 place-items-center rounded-full tone-solid outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-elevated",
            value === t && "ring-2 ring-[var(--tone)] ring-offset-2 ring-offset-elevated",
          )}
        >
          {value === t && <Check className="size-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

export function ToneChip({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={chipClass} aria-label={`Colour: ${TONE_LABEL[value]}`}>
          <span style={toneVar(value)} className="size-2.5 rounded-full tone-solid" />
          {TONE_LABEL[value]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3">
        <TonePicker
          value={value}
          onChange={(t) => {
            onChange(t);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
