"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X, Move, Check, PencilLine, Ban, Plus, Repeat2, CalendarRange } from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { useOccurrences } from "@/data/selectors";
import type { DayKey, Habit, TaskOccurrence } from "@/domain/types";
import { isScheduledOn, weekProgress } from "@/domain/habits";
import { addDaysKey, fromKey, isDayKey, nowMinutes, rangeKeys, relativeDayLabel, todayKey, weekStartKey, weekdayOf, WEEKDAY_SHORT, fmtTime } from "@/lib/dates";
import { useNow } from "@/hooks/use-now";
import { useCoarsePointer, useIsMobile } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { toneVar, EmptyState } from "@/components/ui/misc";
import { STATUS_META } from "@/components/tasks/status";
import { TaskRow } from "@/components/tasks/task-row";
import { HabitCheckTile } from "@/components/habits/habit-check";
import { moveOccurrence, setOccurrenceStatus, toggleHabitCheckIn, toggleOccurrence } from "@/features/tasks/task-actions";
import { isTypingTarget } from "@/components/shell/shortcuts";
import { cn, pluralize } from "@/lib/utils";
import { DayColumn, type DragGhost } from "./day-column";
import { AnytimeCell } from "./anytime-lane";
import { ALL_STATUSES, usePlannerPrefs, type PlannerView } from "./planner-store";
import { snap } from "./layout";

const HOUR_PX = { desktop: 52, mobile: 60 };

export function WeekView() {
  const router = useRouter();
  const params = useSearchParams();
  const today = todayKey();
  const now = useNow();
  const mobile = useIsMobile();
  const coarse = useCoarsePointer();
  const settings = useApp((s) => s.settings);
  const habitsAll = useApp((s) => s.habits);
  const openEditor = useUI((s) => s.openEditor);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const { view: prefView, setView, statuses, toggleStatus, setStatuses, showHabits, setShowHabits } = usePlannerPrefs();

  // On phones, the grid view is always single-day with a week strip above it.
  const view: PlannerView = mobile && prefView !== "list" ? "day" : prefView;
  const paramDate = params.get("date");
  const anchor = isDayKey(paramDate) ? paramDate : today;
  const ws = settings.weekStartsOn;

  const days = useMemo<DayKey[]>(() => {
    if (view === "day") return [anchor];
    if (view === "3day") return rangeKeys(anchor, 3);
    return rangeKeys(weekStartKey(anchor, ws), 7);
  }, [view, anchor, ws]);
  const weekDays = useMemo(() => rangeKeys(weekStartKey(anchor, ws), 7), [anchor, ws]);
  const from = view === "day" && mobile ? weekDays[0] : days[0];
  const to = view === "day" && mobile ? weekDays[6] : days[days.length - 1];

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<DayKey>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [dragging, setDragging] = useState<TaskOccurrence | null>(null);

  const allOcc = useOccurrences(from, to);
  // Selection is stored by key and resolved against live data, so it never goes stale.
  const selected = useMemo(() => (selectedKey ? (allOcc.find((o) => o.key === selectedKey) ?? null) : null), [allOcc, selectedKey]);
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allOcc.filter((o) => statuses.includes(o.status) && (!q || o.title.toLowerCase().includes(q) || o.task.project?.toLowerCase().includes(q)));
  }, [allOcc, statuses, query]);

  const byDay = useMemo(() => {
    const m = new Map<DayKey, { timed: TaskOccurrence[]; anytime: TaskOccurrence[] }>();
    for (const d of rangeKeys(from, 7 + 7)) m.set(d, { timed: [], anytime: [] });
    for (const o of filtered) {
      const e = m.get(o.date) ?? { timed: [], anytime: [] };
      (o.start == null ? e.anytime : e.timed).push(o);
      m.set(o.date, e);
    }
    return m;
  }, [filtered, from]);

  const habitsByDay = useMemo(() => {
    const m = new Map<DayKey, { habit: Habit; done: boolean }[]>();
    if (!showHabits) return m;
    for (const d of rangeKeys(from, 7)) {
      const list = habitsAll
        .filter((h) => !h.archived && isScheduledOn(h, d))
        .filter((h) => {
          if (h.schedule.kind !== "weekly") return true;
          // flexible weekly habit: show on days it was done, or on any day while quota is open
          const wp = weekProgress(h, d, ws);
          return h.log.includes(d) || wp.done < wp.target;
        })
        .map((h) => ({ habit: h, done: h.log.includes(d) }));
      m.set(d, list);
    }
    return m;
  }, [habitsAll, from, showHabits, ws]);

  const startHour = settings.plannerStartHour;
  const endHour = settings.plannerEndHour;
  const hourPx = mobile ? HOUR_PX.mobile : HOUR_PX.desktop;
  const pxPerMin = hourPx / 60;
  const nowMin = nowMinutes(now);

  // ── navigation ──────────────────────────────────────────
  const setAnchor = useCallback(
    (d: DayKey, v?: PlannerView) => {
      const sp = new URLSearchParams(params.toString());
      if (d === today) sp.delete("date");
      else sp.set("date", d);
      if (v) setView(v);
      router.replace(`/week${sp.size ? `?${sp}` : ""}`, { scroll: false });
    },
    [params, router, today, setView],
  );
  const step = view === "day" ? 1 : view === "3day" ? 3 : 7;
  const go = useCallback((dir: -1 | 1) => setAnchor(addDaysKey(anchor, dir * (view === "list" ? 7 : step))), [anchor, step, view, setAnchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "t") setAnchor(today);
      else if (e.key === "1") setView("day");
      else if (e.key === "3") setView("3day");
      else if (e.key === "7") setView("week");
      else if (e.key === "l") setView(prefView === "list" ? "week" : "list");
      else if (e.key === "Escape") {
        setSelectedKey(null);
        setMoving(false);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, setAnchor, today, setView, prefView]);

  // ── scroll to morning / now on mount ────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !scrollRef.current || view === "list") return;
    didScroll.current = true;
    const target = days.includes(today) ? Math.max(startHour * 60, nowMin - 90) : 8 * 60;
    scrollRef.current.scrollTop = (target - startHour * 60) * pxPerMin;
  }, [view, days, today, nowMin, startHour, pxPerMin]);

  // ── drag and drop ───────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 320, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const resolveDrop = (e: DragMoveEvent | DragEndEvent): DragGhost | null => {
    const occ = e.active.data.current?.occ as TaskOccurrence | undefined;
    const rect = e.active.rect.current.translated;
    const act = e.activatorEvent as PointerEvent | TouchEvent;
    if (!occ || !rect) return null;
    const pt = "touches" in act ? act.touches[0] ?? act.changedTouches[0] : act;
    const x = pt.clientX + e.delta.x;
    const y = pt.clientY + e.delta.y;
    const el = document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).dataset?.dropDay) as HTMLElement | undefined;
    if (!el) return null;
    const day = el.dataset.dropDay!;
    const tone = `var(--c-${occ.task.tone})`;
    if (el.dataset.dropKind === "anytime") return { day, start: null, duration: occ.duration, title: occ.title, tone };
    const col = el.getBoundingClientRect();
    const top = occ.start == null ? y - col.top - 10 : rect.top - col.top;
    const start = Math.max(startHour * 60, Math.min(endHour * 60 - 15, snap(startHour * 60 + top / pxPerMin)));
    return { day, start, duration: occ.duration, title: occ.title, tone };
  };

  const onDragStart = (e: DragStartEvent) => {
    setDragging((e.active.data.current?.occ as TaskOccurrence) ?? null);
    setSelectedKey(null);
    setMoving(false);
    if ("vibrate" in navigator) navigator.vibrate?.(8);
  };
  const onDragMove = (e: DragMoveEvent) => {
    const g = resolveDrop(e);
    setGhost((prev) => (prev?.day === g?.day && prev?.start === g?.start ? prev : g));
  };
  const onDragEnd = (e: DragEndEvent) => {
    const occ = e.active.data.current?.occ as TaskOccurrence | undefined;
    const g = resolveDrop(e);
    setGhost(null);
    setDragging(null);
    if (occ && g) moveOccurrence(occ, g.day, g.start);
  };

  // ── interactions ────────────────────────────────────────
  const onOpen = useCallback((o: TaskOccurrence) => openEditor({ taskId: o.taskId, originalDate: o.recurring ? o.originalDate : undefined }), [openEditor]);
  const onTapSelect = useCallback((o: TaskOccurrence) => {
    setMoving(false);
    setSelectedKey((k) => (k === o.key ? null : o.key));
  }, []);
  const onResize = useCallback((o: TaskOccurrence, duration: number) => moveOccurrence(o, o.date, o.start, duration), []);
  const onCreate = useCallback((day: DayKey, start: number, duration: number) => openQuickAdd({ date: day, start, duration }), [openQuickAdd]);
  const onSlotTap = useCallback(
    (day: DayKey, start: number) => {
      if (moving && selected) {
        moveOccurrence(selected, day, start);
        setMoving(false);
        setSelectedKey(null);
      } else if (coarse) {
        setSelectedKey(null);
        openQuickAdd({ date: day, start, duration: 30 });
      }
    },
    [moving, selected, coarse, openQuickAdd],
  );
  const onAnytimeTap = useCallback(
    (day: DayKey) => {
      if (moving && selected) {
        moveOccurrence(selected, day, null);
        setMoving(false);
        setSelectedKey(null);
      }
    },
    [moving, selected],
  );
  const onHabitToggle = useCallback((h: Habit, d: DayKey) => toggleHabitCheckIn(h, d), []);


  const rangeLabel = useMemo(() => {
    const a = fromKey(days[0]);
    const b = fromKey(days[days.length - 1]);
    if (view === "day") return format(a, "EEEE, MMM d");
    if (a.getMonth() === b.getMonth()) return `${format(a, "MMM d")} – ${format(b, "d")}`;
    return `${format(a, "MMM d")} – ${format(b, "MMM d")}`;
  }, [days, view]);

  const listDays = view === "list" ? rangeKeys(weekStartKey(anchor, ws), 7) : days;
  const weekTotal = useMemo(() => {
    const occ = allOcc.filter((o) => o.status !== "cancelled" && o.date >= weekDays[0] && o.date <= weekDays[6]);
    return { total: occ.length, done: occ.filter((o) => o.status === "done").length };
  }, [allOcc, weekDays]);
  const filtersActive = statuses.length !== ALL_STATUSES.length || !showHabits;

  return (
    <div className="flex h-[calc(100dvh-58px-env(safe-area-inset-bottom))] flex-col md:h-dvh">
      {/* ── toolbar ─────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 pb-3 pt-4 md:px-6 md:pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex min-w-0 items-baseline gap-3">
            <h1 className="truncate font-serif text-[28px] leading-none tracking-[-0.01em] md:text-[32px]">{view === "list" ? "This week" : rangeLabel}</h1>
            <span className="hidden font-mono text-[12px] tabular text-fg-3 sm:inline">
              {weekTotal.done}/{weekTotal.total} done
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content="Previous" shortcut={["←"]}>
              <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} aria-label="Previous period">
                <ChevronLeft />
              </Button>
            </Tooltip>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(today)} disabled={days.includes(today) && view !== "list"}>
              Today
            </Button>
            <Tooltip content="Next" shortcut={["→"]}>
              <Button variant="ghost" size="icon-sm" onClick={() => go(1)} aria-label="Next period">
                <ChevronRight />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Planner view"
            value={mobile ? (prefView === "list" ? "list" : "day") : prefView}
            onChange={(v) => setView(v as PlannerView)}
            options={
              mobile
                ? [
                    { value: "day", label: "Day" },
                    { value: "list", label: "List" },
                  ]
                : [
                    { value: "day", label: "Day", title: "Day (1)" },
                    { value: "3day", label: "3 days", title: "3 days (3)" },
                    { value: "week", label: "Week", title: "Week (7)" },
                    { value: "list", label: "List", title: "List (L)" },
                  ]
            }
          />
          <div className="relative ml-auto min-w-0 flex-1 sm:max-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tasks…"
              aria-label="Filter tasks"
              className="h-8 w-full rounded-[8px] bg-input pl-8 pr-7 text-[13px] shadow-sm outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)]"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear filter" className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-fg-3 hover:text-fg">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm" className={cn(filtersActive && "text-accent-text")}>
                <SlidersHorizontal />
                <span className="max-sm:hidden">Filter</span>
                {filtersActive && <span className="size-1.5 rounded-full bg-accent" />}
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-[220px]">
              <MenuLabel>Status</MenuLabel>
              {ALL_STATUSES.map((s) => {
                const M = STATUS_META[s];
                return (
                  <MenuCheckItem key={s} checked={statuses.includes(s)} onCheckedChange={() => toggleStatus(s)} onSelect={(e) => e.preventDefault()}>
                    <M.icon className={M.cls} /> {M.label}
                  </MenuCheckItem>
                );
              })}
              <MenuSeparator />
              <MenuCheckItem checked={showHabits} onCheckedChange={setShowHabits} onSelect={(e) => e.preventDefault()}>
                <Repeat2 /> Show habits
              </MenuCheckItem>
              {filtersActive && (
                <>
                  <MenuSeparator />
                  <MenuCheckItem
                    checked={false}
                    onCheckedChange={() => {
                      setStatuses(ALL_STATUSES);
                      setShowHabits(true);
                    }}
                  >
                    Reset filters
                  </MenuCheckItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>

        {/* mobile day panel: week strip */}
        {mobile && (
          <div className="-mx-1 grid grid-cols-7 gap-1" role="tablist" aria-label="Days of the week">
            {weekDays.map((d) => {
              const e = byDay.get(d);
              const n = (e?.timed.length ?? 0) + (e?.anytime.length ?? 0);
              const doneN = [...(e?.timed ?? []), ...(e?.anytime ?? [])].filter((o) => o.status === "done").length;
              const active = d === anchor;
              return (
                <button
                  key={d}
                  role="tab"
                  aria-selected={active}
                  onClick={() => (moving && selected ? onAnytimeTap(d) : setAnchor(d))}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-[10px] py-1.5 outline-none transition-colors",
                    active ? "bg-fg text-bg" : "text-fg-2",
                    moving && !active && "bg-accent-soft",
                  )}
                >
                  <span className={cn("text-[10.5px] font-medium uppercase", active ? "text-bg/70" : "text-fg-4")}>{WEEKDAY_SHORT[weekdayOf(d)].slice(0, 2)}</span>
                  <span className={cn("font-mono text-[15px] font-medium tabular", d === today && !active && "text-accent-text")}>{fromKey(d).getDate()}</span>
                  <span className="flex h-1 gap-[2px]">
                    {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
                      <span key={i} className={cn("size-1 rounded-full", i < doneN ? (active ? "bg-bg/60" : "bg-ok") : active ? "bg-bg/30" : "bg-fg-4")} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {view === "list" ? (
        <WeekList days={listDays} byDay={byDay} habitsByDay={habitsByDay} anchor={anchor} ws={ws} query={query} />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => (setGhost(null), setDragging(null))} autoScroll={{ threshold: { x: 0.1, y: 0.12 } }}>
          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
            <div className={cn("min-w-full", view === "week" && "min-w-[760px]")}>
              {/* sticky header: day names + anytime lane */}
              <div className="sticky top-0 z-[20] bg-bg">
                {!mobile && (
                  <div className="flex border-b border-line">
                    <div className="w-14 shrink-0" />
                    {days.map((d) => {
                      const isT = d === today;
                      const e = byDay.get(d);
                      const n = (e?.timed.length ?? 0) + (e?.anytime.length ?? 0);
                      return (
                        <button
                          key={d}
                          onClick={() => setAnchor(d, "day")}
                          className="group flex min-w-0 flex-1 items-center gap-2 border-l border-line px-2.5 py-2 text-left outline-none hover:bg-hover focus-visible:bg-surface-3/40"
                          aria-label={`${format(fromKey(d), "EEEE MMMM d")}, ${pluralize(n, "task")}. Open day view`}
                        >
                          <span className={cn("text-[11.5px] font-medium uppercase tracking-[0.06em]", isT ? "text-accent-text" : "text-fg-3")}>{WEEKDAY_SHORT[weekdayOf(d)]}</span>
                          <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[13px] font-medium tabular", isT ? "bg-accent text-accent-fg" : "text-fg")}>
                            {fromKey(d).getDate()}
                          </span>
                          {n > 0 && <span className="ml-auto font-mono text-[11px] tabular text-fg-4 opacity-0 transition-opacity group-hover:opacity-100">{n}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex border-b border-line-2">
                  <div className="flex w-14 shrink-0 items-start justify-end pr-2 pt-2 text-[10.5px] font-medium text-fg-4">all-day</div>
                  {days.map((d) => (
                    <AnytimeCell
                      key={d}
                      day={d}
                      items={byDay.get(d)?.anytime ?? []}
                      habits={(habitsByDay.get(d) ?? []).filter((h) => h.habit.time == null)}
                      expanded={expanded.has(d) || view === "day"}
                      onExpand={() => setExpanded((s) => new Set(s).add(d))}
                      coarse={coarse}
                      moving={moving}
                      selectedKey={selected?.key}
                      ghostHere={ghost && ghost.day === d && ghost.start == null ? { title: ghost.title } : null}
                      isToday={d === today}
                      onOpen={onOpen}
                      onTapSelect={onTapSelect}
                      onTap={onAnytimeTap}
                      onHabitToggle={onHabitToggle}
                    />
                  ))}
                </div>
              </div>

              {/* time grid */}
              <div className="flex">
                <div className="relative w-14 shrink-0" style={{ height: (endHour - startHour) * hourPx }} aria-hidden>
                  {Array.from({ length: endHour - startHour }).map((_, i) => (
                    <div key={i} className="absolute right-2 -translate-y-1/2 font-mono text-[10.5px] tabular text-fg-4" style={{ top: i * hourPx }}>
                      {i === 0 ? "" : `${(startHour + i) % 24}:00`}
                    </div>
                  ))}
                  {days.includes(today) && nowMin >= startHour * 60 && (
                    <div className="absolute right-1 z-[8] -translate-y-1/2 rounded-[4px] bg-accent px-1 font-mono text-[10px] font-medium tabular text-accent-fg" style={{ top: (nowMin - startHour * 60) * pxPerMin }}>
                      {fmtTime(nowMin)}
                    </div>
                  )}
                </div>
                {days.map((d) => (
                  <DayColumn
                    key={d}
                    day={d}
                    items={byDay.get(d)?.timed ?? []}
                    habits={(habitsByDay.get(d) ?? []).filter((h) => h.habit.time != null)}
                    startHour={startHour}
                    endHour={endHour}
                    pxPerMin={pxPerMin}
                    isToday={d === today}
                    nowMin={nowMin}
                    ghost={ghost}
                    selectedKey={selected?.key}
                    coarse={coarse}
                    moving={moving}
                    isWeekend={weekdayOf(d) === 0 || weekdayOf(d) === 6}
                    onOpen={onOpen}
                    onTapSelect={onTapSelect}
                    onResize={onResize}
                    onCreate={onCreate}
                    onSlotTap={onSlotTap}
                    onHabitToggle={onHabitToggle}
                  />
                ))}
              </div>
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div style={toneVar(dragging.task.tone)} className="pointer-events-none flex h-7 max-w-[220px] items-center gap-2 rounded-[8px] bg-elevated px-2.5 text-[12px] font-medium shadow-lg">
                <span className="h-3.5 w-[3px] shrink-0 rounded-full tone-solid" />
                <span className="truncate">{dragging.title}</span>
                {ghost && <span className="shrink-0 font-mono text-[10.5px] tabular text-fg-3">{ghost.start != null ? fmtTime(ghost.start) : "anytime"}</span>}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* touch: selection action bar / move mode */}
      {selected && (
        <div className="fixed inset-x-3 bottom-[calc(70px+env(safe-area-inset-bottom))] z-40 animate-in md:bottom-4 md:left-auto md:right-4 md:w-[380px]">
          <div className="rounded-[14px] bg-elevated p-2 shadow-lg" style={toneVar(selected.task.tone)}>
            {moving ? (
              <div className="flex items-center gap-2 px-1.5">
                <Move className="size-4 shrink-0 text-accent-text" />
                <span className="min-w-0 flex-1 text-[13px]">
                  Tap a time slot or day to move <b className="font-medium">“{selected.title}”</b>
                </span>
                <Button size="sm" variant="ghost" onClick={() => setMoving(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-1.5 pb-2 pt-0.5">
                  <span className="h-4 w-[3px] rounded-full tone-solid" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{selected.title}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-fg-3">
                    {relativeDayLabel(selected.date)}
                    {selected.start != null && ` · ${fmtTime(selected.start)}`}
                  </span>
                  <button onClick={() => setSelectedKey(null)} aria-label="Deselect" className="grid size-6 place-items-center rounded text-fg-3">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <ActionBtn icon={<Move />} label="Move" onClick={() => setMoving(true)} />
                  <ActionBtn
                    icon={<Check />}
                    label={selected.status === "done" ? "Undo" : "Done"}
                    onClick={() => {
                      toggleOccurrence(selected);
                      setSelectedKey(null);
                    }}
                  />
                  <ActionBtn
                    icon={<Ban />}
                    label="Cancel"
                    onClick={() => {
                      setOccurrenceStatus(selected, "cancelled");
                      setSelectedKey(null);
                    }}
                  />
                  <ActionBtn
                    icon={<PencilLine />}
                    label="Edit"
                    onClick={() => {
                      onOpen(selected);
                      setSelectedKey(null);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-surface-2 text-[11.5px] font-medium text-fg-2 outline-none active:bg-surface-3 [&_svg]:size-4">
      {icon}
      {label}
    </button>
  );
}

function WeekList({
  days,
  byDay,
  habitsByDay,
  anchor,
  ws,
  query,
}: {
  days: DayKey[];
  byDay: Map<DayKey, { timed: TaskOccurrence[]; anytime: TaskOccurrence[] }>;
  habitsByDay: Map<DayKey, { habit: Habit; done: boolean }[]>;
  anchor: DayKey;
  ws: 0 | 1;
  query: string;
}) {
  const today = todayKey();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const habits = useApp((s) => s.habits);
  const total = days.reduce((n, d) => n + (byDay.get(d)?.timed.length ?? 0) + (byDay.get(d)?.anytime.length ?? 0), 0);
  if (total === 0 && query)
    return <EmptyState icon={<Search />} title="No matching tasks" body={`Nothing this week matches “${query}”.`} />;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-4 pb-16 pt-2 md:px-6">
        {days.map((d) => {
          const e = byDay.get(d);
          const items = [...(e?.timed ?? []), ...(e?.anytime ?? [])];
          const hs = (habitsByDay.get(d) ?? []).map((x) => x.habit);
          const isT = d === today;
          const past = d < today;
          return (
            <section key={d} className="border-b border-line py-4 last:border-0" aria-label={format(fromKey(d), "EEEE MMMM d")}>
              <div className="mb-1.5 flex items-center gap-2.5 px-3">
                <span className={cn("font-mono text-[20px] font-medium tabular leading-none", isT ? "text-accent-text" : past ? "text-fg-3" : "text-fg")}>{fromKey(d).getDate()}</span>
                <span className={cn("text-[13px] font-medium", isT ? "text-accent-text" : "text-fg-2")}>{relativeDayLabel(d)}</span>
                <span className="text-[12px] text-fg-4">{format(fromKey(d), "EEEE")}</span>
                <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label={`Add task on ${format(fromKey(d), "EEEE")}`} onClick={() => openQuickAdd({ date: d })}>
                  <Plus />
                </Button>
              </div>
              {items.length === 0 && hs.length === 0 ? (
                <p className="px-3 py-2 text-[12.5px] text-fg-4">{past ? "Nothing was planned." : "Free day."}</p>
              ) : (
                <>
                  {items.map((o) => (
                    <TaskRow key={o.key} occ={o} dense />
                  ))}
                  {hs.length > 0 && (
                    <div className="mt-2 grid gap-1.5 px-1 sm:grid-cols-2">
                      {hs.map((h) => (
                        <HabitCheckTile key={h.id} habit={habits.find((x) => x.id === h.id) ?? h} day={d} weekStartsOn={ws} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
        <p className="flex items-center justify-center gap-1.5 pt-6 text-[12px] text-fg-4">
          <CalendarRange className="size-3.5" /> Week of {format(fromKey(weekStartKey(anchor, ws)), "MMMM d")}
        </p>
      </div>
    </div>
  );
}


