"use client";
import { useMemo, useRef, useState } from "react";
import { CornerDownLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { parseQuickAdd } from "@/domain/parse";
import { DateChip, DurationChip, RecurrenceChip, TimeChip, ToneChip } from "./pickers";
import type { DayKey, Recurrence, Task, Tone } from "@/domain/types";
import { relativeDayLabel, todayKey, fmtTime } from "@/lib/dates";
import { describeRecurrence } from "@/domain/recurrence";

/**
 * Global task creation. Natural language in the title ("tomorrow 3pm 45m
 * every mon") is parsed live and shown as tokens; chips override the parse.
 */
export function QuickAdd() {
  const { open, defaults } = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  // A new session key per open remounts the form so state initialises from `defaults`.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return <QuickAddForm key={session} open={open} defaults={defaults} close={close} />;
}

function QuickAddForm({ open, defaults, close }: { open: boolean; defaults?: Partial<Task>; close: () => void }) {
  const addTask = useApp((s) => s.addTask);
  const ws = useApp((s) => s.settings.weekStartsOn);

  const [text, setText] = useState(defaults?.title ?? "");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<DayKey | undefined>(() => ("date" in (defaults ?? {}) ? defaults?.date : todayKey()));
  const [start, setStart] = useState<number | null>(defaults?.start ?? null);
  const [duration, setDuration] = useState(defaults?.duration ?? 30);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(defaults?.recurrence);
  const [tone, setTone] = useState<Tone>(defaults?.tone ?? "slate");
  const [touched, setTouched] = useState<Record<string, boolean>>(() => (defaults ? Object.fromEntries(Object.keys(defaults).map((k) => [k, true])) : {}));
  const [keepOpen, setKeepOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const eff = {
    date: touched.date ? date : (parsed.date ?? date),
    start: touched.start ? start : (parsed.start ?? start),
    duration: touched.duration ? duration : (parsed.duration ?? duration),
    recurrence: touched.recurrence ? recurrence : (parsed.recurrence ?? recurrence),
  };
  const title = parsed.title;

  const submit = () => {
    if (!title.trim()) {
      inputRef.current?.focus();
      return;
    }
    const t = addTask({
      title,
      notes: notes.trim() || undefined,
      date: eff.date ?? (eff.recurrence ? todayKey() : undefined),
      start: eff.start,
      duration: eff.duration,
      recurrence: eff.recurrence,
      tone,
      reminder: eff.start != null ? 10 : null,
    });
    const where = t.date ? `${relativeDayLabel(t.date)}${t.start != null ? ` at ${fmtTime(t.start)}` : ""}` : "Inbox";
    toast.success("Task created", {
      description: `${t.title} · ${where}${t.recurrence ? ` · ${describeRecurrence(t.recurrence, t.date)}` : ""}`,
      action: { label: "Open", onClick: () => useUI.getState().openEditor({ taskId: t.id }) },
    });
    if (keepOpen) {
      setText("");
      setNotes("");
      inputRef.current?.focus();
    } else close();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title="New task"
      description="Type naturally — dates, times, durations and repeats are detected."
      hideTitle
      footer={
        <>
          <label className="mr-auto hidden items-center gap-2 text-[12.5px] text-fg-3 md:flex">
            <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="accent-[var(--accent)]" />
            Create more
          </label>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim()}>
            Create task
            <span className="hidden items-center gap-0.5 md:flex">
              <Kbd className="border-white/20 bg-white/15 text-accent-fg/80 shadow-none">
                <CornerDownLeft className="size-3" />
              </Kbd>
            </span>
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs doing?  e.g. “Review deck tomorrow 3pm 45m”"
          aria-label="Task title"
          className="w-full bg-transparent text-[17px] font-medium tracking-[-0.01em] outline-none placeholder:font-normal placeholder:text-fg-4"
          maxLength={500}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add notes…"
          rows={2}
          aria-label="Notes"
          className="mt-2 w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-fg-2 outline-none placeholder:text-fg-4"
        />
        {parsed.tokens.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3" aria-live="polite">
            <Sparkles className="size-3.5 text-accent-text" />
            Detected
            {parsed.tokens.map((t, i) => (
              <span key={i} className="rounded-[5px] bg-accent-soft px-1.5 py-0.5 font-medium text-fg-2">
                {t.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <DateChip
            value={eff.date}
            weekStartsOn={ws}
            onChange={(d) => {
              setDate(d);
              setTouched((t) => ({ ...t, date: true }));
            }}
          />
          <TimeChip
            value={eff.start}
            onChange={(m) => {
              setStart(m);
              setTouched((t) => ({ ...t, start: true }));
            }}
          />
          {eff.start != null && (
            <DurationChip
              value={eff.duration}
              onChange={(m) => {
                setDuration(m);
                setTouched((t) => ({ ...t, duration: true }));
              }}
            />
          )}
          <RecurrenceChip
            value={eff.recurrence}
            anchor={eff.date}
            onChange={(r) => {
              setRecurrence(r);
              setTouched((t) => ({ ...t, recurrence: true }));
            }}
          />
          <ToneChip value={tone} onChange={setTone} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
