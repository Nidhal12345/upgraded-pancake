"use client";
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, Repeat, Flame, Trophy, Sparkles, Minus, Plus } from "lucide-react";
import { useFocus, fmtClock, remainingOf, durationFor, MODE_LABEL, ROUNDS_PER_CYCLE } from "./focus-store";
import { useApp } from "@/data/store";
import { useNow } from "@/hooks/use-now";
import { Container } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/misc";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { addDaysKey, todayKey, rangeKeys, fromKey, WEEKDAY_MIN } from "@/lib/dates";
import { isTypingTarget } from "@/components/shell/shortcuts";
import type { FocusMode } from "@/domain/types";
import { cn } from "@/lib/utils";

export function FocusView() {
  const f = useFocus();
  useNow(f.status === "running" ? 250 : 60_000);
  const sessions = useApp((s) => s.sessions);
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const today = todayKey();

  const ms = remainingOf(f);
  const total = durationFor(f.mode);
  const progress = 1 - ms / total;

  // keep idle timer in sync with duration settings
  useEffect(() => {
    if (f.status === "idle") useFocus.setState({ remainingMs: durationFor(f.mode) });
  }, [settings.focusMinutes, settings.shortBreakMinutes, settings.longBreakMinutes, f.mode, f.status]);

  useEffect(() => {
    document.title = f.status !== "idle" ? `${fmtClock(ms)} · ${MODE_LABEL[f.mode]}` : "Focus · Meridian";
  }, [ms, f.status, f.mode]);
  useEffect(() => () => void (document.title = "Meridian"), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      const s = useFocus.getState();
      if (e.key === " ") {
        e.preventDefault();
        if (s.status === "running") s.pause();
        else s.start();
      } else if (e.key === "r") s.reset();
      else if (e.key === "s") s.skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => {
    const focus = sessions.filter((s) => s.mode === "focus");
    const byDay = new Map<string, number>();
    for (const s of focus) byDay.set(s.day, (byDay.get(s.day) ?? 0) + 1);
    let streak = 0;
    let d = byDay.has(today) ? today : addDaysKey(today, -1);
    while (byDay.has(d)) {
      streak++;
      d = addDaysKey(d, -1);
    }
    const todayCount = byDay.get(today) ?? 0;
    const minutesToday = focus.filter((s) => s.day === today).reduce((n, s) => n + s.minutes, 0);
    const week = rangeKeys(addDaysKey(today, -6), 7).map((k) => ({ day: k, n: byDay.get(k) ?? 0 }));
    const best = Math.max(0, ...byDay.values());
    return { streak, todayCount, minutesToday, week, total: focus.length, cycles: Math.floor(todayCount / ROUNDS_PER_CYCLE), best };
  }, [sessions, today]);
  const maxWeek = Math.max(4, ...stats.week.map((w) => w.n));

  const isBreak = f.mode !== "focus";
  const R = 132;
  const C = 2 * Math.PI * R;
  const celebrate = f.lastCompletedMode === "focus" && f.mode === "long";

  return (
    <Container className="pb-16">
      <div className="grid gap-8 pt-6 md:pt-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* timer */}
        <section aria-label="Timer" className="flex flex-col items-center">
          <Segmented<FocusMode>
            label="Timer mode"
            value={f.mode}
            onChange={f.setMode}
            options={[
              { value: "focus", label: "Focus" },
              { value: "short", label: "Short break" },
              { value: "long", label: "Long break" },
            ]}
          />

          <div className="relative mt-8 grid place-items-center">
            <div
              aria-hidden
              className={cn("absolute inset-6 rounded-full blur-3xl transition-colors duration-700", isBreak ? "bg-ok-soft" : "bg-accent-soft", f.status === "running" && "animate-pulse [animation-duration:4s]")}
            />
            <svg width={300} height={300} viewBox="0 0 300 300" className="relative -rotate-90 max-sm:size-[260px]">
              <circle cx={150} cy={150} r={R} fill="none" strokeWidth={4} className="stroke-surface-3" />
              {Array.from({ length: 60 }).map((_, i) => (
                <line key={i} x1={150} y1={10} x2={150} y2={i % 5 === 0 ? 18 : 14} transform={`rotate(${i * 6} 150 150)`} className="stroke-line-2" strokeWidth={1} />
              ))}
              <circle
                cx={150}
                cy={150}
                r={R}
                fill="none"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                className={cn("transition-[stroke-dashoffset] duration-300 ease-linear", isBreak ? "stroke-ok" : "stroke-accent")}
                style={{ opacity: progress <= 0.001 ? 0 : 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-[12px] font-medium uppercase tracking-[0.12em]", isBreak ? "text-ok-text" : "text-accent-text")}>{MODE_LABEL[f.mode]}</span>
              <span className="mt-1 font-mono text-[64px] font-light leading-none tabular tracking-[-0.04em] max-sm:text-[54px]" role="timer" aria-live="off" aria-label={`${fmtClock(ms)} remaining`}>
                {fmtClock(ms)}
              </span>
              <div className="mt-4 flex items-center gap-1.5" aria-label={`Round ${f.round} of ${ROUNDS_PER_CYCLE}`}>
                {Array.from({ length: ROUNDS_PER_CYCLE }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i + 1 < f.round || (i + 1 === f.round && isBreak) ? "w-4 bg-accent" : i + 1 === f.round ? "w-6 bg-fg-2" : "w-4 bg-surface-3",
                    )}
                  />
                ))}
              </div>
              <span className="mt-2 text-[11.5px] text-fg-3">
                Round {f.round} of {ROUNDS_PER_CYCLE}
              </span>
            </div>
          </div>

          <input
            value={f.label}
            onChange={(e) => f.setLabel(e.target.value)}
            placeholder="What are you focusing on?"
            aria-label="Session focus"
            maxLength={80}
            className="mt-6 h-9 w-full max-w-[340px] rounded-[9px] bg-transparent px-3 text-center text-[14px] outline-none placeholder:text-fg-4 hover:bg-surface/60 focus:bg-surface focus:shadow-sm"
          />

          <div className="mt-5 flex items-center gap-3">
            <Tooltip content="Reset" shortcut={["R"]}>
              <Button variant="secondary" size="icon" className="size-11 rounded-full" onClick={f.reset} aria-label="Reset timer" disabled={f.status === "idle" && ms === total}>
                <RotateCcw />
              </Button>
            </Tooltip>
            <button
              onClick={f.status === "running" ? f.pause : f.start}
              aria-label={f.status === "running" ? "Pause" : f.status === "paused" ? "Resume" : "Start"}
              className={cn(
                "grid size-16 place-items-center rounded-full text-accent-fg shadow-md outline-none transition-transform focus-visible:ring-4 focus-visible:ring-[var(--ring)] active:scale-95 [&_svg]:size-6",
                isBreak ? "bg-ok" : "bg-accent-grad hover:brightness-[1.06]",
              )}
            >
              {f.status === "running" ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-0.5" />}
            </button>
            <Tooltip content="Skip to next" shortcut={["S"]}>
              <Button variant="secondary" size="icon" className="size-11 rounded-full" onClick={f.skip} aria-label="Skip to next session">
                <SkipForward />
              </Button>
            </Tooltip>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-fg-4 max-md:hidden">
            <Kbd>Space</Kbd> start / pause · Timer keeps running across pages and reloads
          </p>
        </section>

        {/* side panel */}
        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Sparkles className="text-accent-text" />} label="Today" value={stats.todayCount} sub={`${stats.minutesToday} min`} />
            <Stat icon={<Flame className="text-accent-2" />} label="Streak" value={stats.streak} sub={stats.streak === 1 ? "day" : "days"} />
            <Stat icon={<Trophy className="text-warn-text" />} label="Cycles" value={stats.cycles} sub="today" />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between text-[12px] text-fg-3">
              <span className="font-medium">Sessions this week</span>
              <span className="font-mono tabular">{stats.week.reduce((n, w) => n + w.n, 0)} total</span>
            </div>
            <div className="mt-3 flex h-20 items-end gap-2">
              {stats.week.map((w) => (
                <div key={w.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-14 w-full flex-col-reverse gap-[2px]" title={`${w.n} sessions`}>
                    {Array.from({ length: Math.min(w.n, maxWeek) }).map((_, i) => (
                      <span key={i} className={cn("w-full rounded-[2px]", w.day === today ? "bg-accent" : "bg-[color-mix(in_oklab,var(--accent)_28%,var(--surface-3))]")} style={{ height: `${100 / maxWeek}%` }} />
                    ))}
                  </div>
                  <span className={cn("text-[10.5px] font-medium", w.day === today ? "text-accent-text" : "text-fg-4")}>{WEEKDAY_MIN[fromKey(w.day).getDay()]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-[12px] font-medium text-fg-3">Durations</div>
            {(
              [
                ["focusMinutes", "Focus", 5, 90],
                ["shortBreakMinutes", "Short break", 1, 30],
                ["longBreakMinutes", "Long break", 5, 60],
              ] as const
            ).map(([key, label, min, max]) => (
              <div key={key} className="flex h-10 items-center justify-between">
                <span className="text-[13px]">{label}</span>
                <div className="flex items-center rounded-[8px] bg-surface-2 p-0.5">
                  <Button size="icon-xs" variant="ghost" aria-label={`Decrease ${label}`} onClick={() => updateSettings({ [key]: Math.max(min, settings[key] - (key === "shortBreakMinutes" ? 1 : 5)) })}>
                    <Minus />
                  </Button>
                  <span className="w-12 text-center font-mono text-[13px] tabular">{settings[key]}m</span>
                  <Button size="icon-xs" variant="ghost" aria-label={`Increase ${label}`} onClick={() => updateSettings({ [key]: Math.min(max, settings[key] + (key === "shortBreakMinutes" ? 1 : 5)) })}>
                    <Plus />
                  </Button>
                </div>
              </div>
            ))}
            <div className="mt-2 flex gap-2 border-t border-line pt-3">
              <Toggle on={f.autoStart} onClick={() => f.setAutoStart(!f.autoStart)} icon={<Repeat />} label="Auto-start next" />
              <Toggle on={f.sound} onClick={() => f.setSound(!f.sound)} icon={f.sound ? <Volume2 /> : <VolumeX />} label="Chime" />
            </div>
          </Card>
          <p className="text-[11.5px] leading-relaxed text-fg-4">
            Four focus rounds make a cycle, then a long break. Timer state is kept on this device; completed sessions sync to your account.
          </p>
        </aside>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-bg/70 p-6 backdrop-blur-sm"
            onClick={f.dismissCelebration}
            role="dialog"
            aria-label="Cycle complete"
          >
            <Confetti />
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="relative max-w-sm rounded-[20px] bg-elevated p-7 text-center shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent-text">
                <Trophy className="size-7" />
              </div>
              <h2 className="mt-4 font-serif text-[30px] leading-tight">Cycle complete</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
                Four focused rounds — {ROUNDS_PER_CYCLE * settings.focusMinutes} minutes of deep work. Take a proper {settings.longBreakMinutes}-minute break.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="ghost" onClick={f.dismissCelebration}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    f.dismissCelebration();
                    f.start();
                  }}
                >
                  <Play /> Start long break
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-[11px] font-medium text-fg-3 [&_svg]:size-3">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[22px] font-medium leading-none tabular">{value}</div>
      <div className="mt-1 text-[11px] text-fg-4">{sub}</div>
    </Card>
  );
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-3.5",
        on ? "bg-accent-soft text-fg" : "bg-surface-2 text-fg-3 hover:text-fg-2",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        x: (i * 37) % 100,
        d: 1.6 + ((i * 13) % 10) / 10,
        delay: ((i * 7) % 10) / 20,
        c: ["--c-persimmon", "--c-amber", "--c-moss", "--c-sky", "--c-iris", "--c-rose"][i % 6],
        r: (i * 47) % 360,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "105vh", rotate: p.r + 360, opacity: [1, 1, 0] }}
          transition={{ duration: p.d, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
          className="absolute top-0 h-2.5 w-1.5 rounded-[2px]"
          style={{ left: `${p.x}%`, background: `var(${p.c})` }}
        />
      ))}
    </div>
  );
}
