"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X, Inbox, Repeat, Trash2, CalendarDays, Check, ListFilter, ArrowUpDown } from "lucide-react";
import { useApp } from "@/data/store";
import { useUI } from "@/data/ui-store";
import { Container, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, SectionLabel, Card } from "@/components/ui/misc";
import { TaskRow } from "@/components/tasks/task-row";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuCheckItem, MenuLabel } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MiniCalendar } from "@/components/ui/mini-calendar";
import { STATUS_META, STATUSES, StatusIcon } from "@/components/tasks/status";
import { expandOccurrences, describeRecurrence } from "@/domain/recurrence";
import type { DayKey, TaskOccurrence, TaskStatus } from "@/domain/types";
import { addDaysKey, relativeDayLabel, todayKey, weekStartKey, fmtTime } from "@/lib/dates";
import { bulkStatus, deleteTasks, moveOccurrence } from "./task-actions";
import { cn, pluralize } from "@/lib/utils";
import { toneVar } from "@/components/ui/misc";
import { isTypingTarget } from "@/components/shell/shortcuts";

type Range = "week" | "upcoming" | "past" | "all" | "recurring" | "inbox";
const RANGES: { value: Range; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All time" },
  { value: "recurring", label: "Recurring" },
  { value: "inbox", label: "Unscheduled" },
];

const PAGE = 80;

export function TasksView() {
  const router = useRouter();
  const params = useSearchParams();
  const tasks = useApp((s) => s.tasks);
  const ws = useApp((s) => s.settings.weekStartsOn);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const openEditor = useUI((s) => s.openEditor);
  const today = todayKey();

  const range = (RANGES.find((r) => r.value === params.get("range"))?.value ?? "week") as Range;
  const setRange = (r: Range) => {
    setSelected(new Set());
    setLimit(PAGE);
    router.replace(r === "week" ? "/tasks" : `/tasks?range=${r}`, { scroll: false });
  };
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<TaskStatus[]>(["todo", "in_progress", "done", "cancelled"]);
  const [sort, setSort] = useState<"date" | "title" | "status">("date");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const lastClicked = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const window_ = useMemo((): [DayKey, DayKey] => {
    const ws_ = weekStartKey(today, ws);
    switch (range) {
      case "week":
        return [ws_, addDaysKey(ws_, 6)];
      case "upcoming":
        return [today, addDaysKey(today, 60)];
      case "past":
        return [addDaysKey(today, -90), addDaysKey(today, -1)];
      default:
        return [addDaysKey(today, -90), addDaysKey(today, 60)];
    }
  }, [range, today, ws]);

  const counts = useMemo(() => {
    const c = { inbox: 0, recurring: 0 };
    for (const t of tasks) {
      if (!t.date) c.inbox++;
      if (t.recurrence) c.recurring++;
    }
    return c;
  }, [tasks]);

  /** Rows are occurrences for dated ranges; series/plain tasks for recurring & inbox. */
  const rows = useMemo<TaskOccurrence[]>(() => {
    let list: TaskOccurrence[];
    if (range === "inbox") {
      list = tasks
        .filter((t) => !t.date)
        .map((t) => ({ key: t.id, taskId: t.id, task: t, originalDate: "", date: "", start: t.start ?? null, duration: t.duration ?? 30, title: t.title, status: t.status, recurring: false, moved: false }));
    } else if (range === "recurring") {
      list = tasks
        .filter((t) => t.recurrence)
        .map((t) => ({ key: t.id, taskId: t.id, task: t, originalDate: t.date!, date: t.date!, start: t.start ?? null, duration: t.duration ?? 30, title: t.title, status: "todo" as TaskStatus, recurring: true, moved: false }));
    } else {
      const occ = expandOccurrences(tasks, window_[0], window_[1]);
      // "All time" includes non-recurring tasks outside the expansion window
      if (range === "all") {
        const seen = new Set(occ.map((o) => o.taskId));
        for (const t of tasks) if (t.date && !t.recurrence && !seen.has(t.id)) occ.push(...expandOccurrences([t], t.date, t.date));
      }
      list = occ;
    }
    const needle = q.trim().toLowerCase();
    list = list.filter((o) => (range === "recurring" || statuses.includes(o.status)) && (!needle || o.title.toLowerCase().includes(needle) || o.task.notes?.toLowerCase().includes(needle) || o.task.project?.toLowerCase().includes(needle)));
    const order = { in_progress: 0, todo: 1, done: 2, cancelled: 3 };
    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "status") return order[a.status] - order[b.status] || (a.date < b.date ? -1 : 1);
      const dir = range === "past" ? -1 : 1;
      if (a.date !== b.date) return (a.date < b.date ? -1 : 1) * dir;
      return (a.start ?? 9999) - (b.start ?? 9999);
    });
    return list;
  }, [tasks, range, window_, q, statuses, sort]);

  const groups = useMemo(() => {
    if (range === "recurring" || range === "inbox" || sort !== "date") return [{ key: "all", label: "", items: rows.slice(0, limit) }];
    const g: { key: string; label: string; items: TaskOccurrence[] }[] = [];
    for (const o of rows.slice(0, limit)) {
      const last = g[g.length - 1];
      if (last?.key === o.date) last.items.push(o);
      else g.push({ key: o.date, label: relativeDayLabel(o.date), items: [o] });
    }
    return g;
  }, [rows, range, sort, limit]);

  const flat = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const toggleSel = useCallback(
    (o: TaskOccurrence, shift: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shift && lastClicked.current) {
          const a = flat.findIndex((x) => x.key === lastClicked.current);
          const b = flat.findIndex((x) => x.key === o.key);
          if (a >= 0 && b >= 0) {
            for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(flat[i].key);
            return next;
          }
        }
        if (next.has(o.key)) next.delete(o.key);
        else next.add(o.key);
        lastClicked.current = o.key;
        return next;
      });
    },
    [flat],
  );

  const selectedOcc = rows.filter((o) => selected.has(o.key));
  const selectedTasks = [...new Map(selectedOcc.map((o) => [o.taskId, o.task])).values()];
  const clear = () => setSelected(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setSelected(new Set(flat.map((o) => o.key)));
      } else if (e.key === "Escape") clear();
      else if (e.key === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat]);

  const statusCounts = useMemo(() => {
    const c: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
    for (const o of rows) c[o.status]++;
    return c;
  }, [rows]);

  return (
    <Container>
      <PageHeader
        eyebrow={range === "recurring" ? pluralize(rows.length, "series", "series") : `${pluralize(rows.length, "task")} · ${statusCounts.done} done`}
        title="Tasks"
        actions={
          <Button variant="primary" onClick={() => openQuickAdd(range === "inbox" ? { date: undefined } : undefined)}>
            <Plus /> New task
          </Button>
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({
              value: r.value,
              label: (
                <>
                  {r.label}
                  {r.value === "inbox" && counts.inbox > 0 && <span className="font-mono text-[11px] text-fg-4">{counts.inbox}</span>}
                  {r.value === "recurring" && counts.recurring > 0 && <span className="font-mono text-[11px] text-fg-4">{counts.recurring}</span>}
                </>
              ),
            }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search titles, notes, projects…"
              aria-label="Search tasks"
              className="h-8 w-full rounded-[8px] bg-input pl-8 pr-7 text-[13px] shadow-sm outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)]"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-fg-3 hover:text-fg">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {range !== "recurring" && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Status filter">
              {STATUSES.map((s) => {
                const on = statuses.includes(s);
                const M = STATUS_META[s];
                return (
                  <button
                    key={s}
                    aria-pressed={on}
                    onClick={() => setStatuses((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== s) : cur) : [...cur, s]))}
                    onDoubleClick={() => setStatuses([s])}
                    title="Click to toggle · double-click to isolate"
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-3.5",
                      on ? "bg-surface text-fg shadow-sm" : "text-fg-4 hover:text-fg-2",
                    )}
                  >
                    <M.icon className={on ? M.cls : ""} />
                    <span className="max-sm:hidden">{M.label}</span>
                    <span className="font-mono text-[11px] tabular text-fg-4">{statusCounts[s]}</span>
                  </button>
                );
              })}
            </div>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost" className="ml-auto">
                <ArrowUpDown /> <span className="max-sm:hidden">Sort</span>
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Sort by</MenuLabel>
              {(["date", "status", "title"] as const).map((s) => (
                <MenuCheckItem key={s} checked={sort === s} onCheckedChange={() => setSort(s)}>
                  {s === "date" ? "Date" : s === "status" ? "Status" : "Title"}
                </MenuCheckItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      </PageHeader>

      <div className="pb-28">
        {rows.length === 0 ? (
          <EmptyState
            icon={q ? <Search /> : range === "inbox" ? <Inbox /> : range === "recurring" ? <Repeat /> : <ListFilter />}
            title={q ? "No tasks match your search" : range === "inbox" ? "Inbox zero" : range === "recurring" ? "No recurring tasks" : "Nothing here"}
            body={
              q
                ? "Try a different word, or clear filters."
                : range === "inbox"
                  ? "Every task has a home on the calendar."
                  : range === "recurring"
                    ? "Try “Standup every weekday 9:00” in quick add."
                    : "No tasks in this range with the selected statuses."
            }
            action={
              <Button onClick={() => (q ? setQ("") : openQuickAdd())}>
                {q ? "Clear search" : (
                  <>
                    <Plus /> New task
                  </>
                )}
              </Button>
            }
          />
        ) : range === "recurring" ? (
          <Card className="divide-y divide-line">
            {rows.map((o) => {
              const t = o.task;
              const ov = Object.values(t.overrides ?? {});
              const doneN = ov.filter((x) => x.status === "done").length;
              return (
                <button
                  key={t.id}
                  onClick={() => openEditor({ taskId: t.id })}
                  style={toneVar(t.tone)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface-2/70 focus-visible:bg-surface-2/70"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px] tone-soft tone-text">
                    <Repeat className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{t.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                      {describeRecurrence(t.recurrence, t.date)}
                      {t.start != null && ` · ${fmtTime(t.start)}`}
                      {t.recurrence?.until && ` · until ${relativeDayLabel(t.recurrence.until)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-fg-3">
                    <span className="font-mono tabular text-fg-2">{doneN}</span> completed
                    <span className="block text-fg-4">{ov.filter((x) => x.skipped).length} skipped · {ov.filter((x) => x.date).length} moved</span>
                  </span>
                </button>
              );
            })}
          </Card>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} className="mb-4" aria-label={g.label || "Tasks"}>
                {g.label && (
                  <SectionLabel className="sticky top-0 z-[1] -mx-2 bg-bg px-2">
                    <span className={cn(g.key === today && "text-accent-text", g.key < today && g.items.some((o) => o.status === "todo") && "text-fg-2")}>{g.label}</span>
                  </SectionLabel>
                )}
                <div className="flex flex-col">
                  {g.items.map((o) => (
                    <TaskRow key={o.key} occ={o} selectable selected={selected.has(o.key)} onSelectToggle={toggleSel} showDate={sort !== "date"} />
                  ))}
                </div>
              </section>
            ))}
            {rows.length > limit && (
              <div className="flex justify-center py-4">
                <Button variant="subtle" onClick={() => setLimit((l) => l + PAGE)}>
                  Show {Math.min(PAGE, rows.length - limit)} more · {rows.length - limit} remaining
                </Button>
              </div>
            )}
            <p className="pt-2 text-center text-[11.5px] text-fg-4 max-md:hidden">⌘/Shift-click to select · ⌘A select all · right-click for actions</p>
          </>
        )}
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(70px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[640px] items-center gap-1 rounded-[14px] bg-fg p-1.5 pl-3.5 text-bg shadow-lg animate-in md:bottom-6 dark:bg-surface-3 dark:text-fg">
          <span className="mr-auto text-[13px] font-medium">
            <span className="font-mono tabular">{selected.size}</span> selected
          </span>
          <Menu>
            <MenuTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium hover:bg-white/10 dark:hover:bg-black/20 [&_svg]:size-4">
                <Check /> Status
              </button>
            </MenuTrigger>
            <MenuContent side="top">
              {STATUSES.map((s) => (
                <MenuItem
                  key={s}
                  onSelect={() => {
                    const recurring = selectedOcc.filter((o) => o.recurring);
                    recurring.forEach((o) => useApp.getState().setOccurrenceStatus(o, s));
                    const plain = selectedTasks.filter((t) => !t.recurrence);
                    if (plain.length) bulkStatus(plain, s);
                    clear();
                  }}
                >
                  <StatusIcon status={s} /> {STATUS_META[s].label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium hover:bg-white/10 dark:hover:bg-black/20 [&_svg]:size-4">
                <CalendarDays /> Reschedule
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="p-0">
              <MiniCalendar
                weekStartsOn={ws}
                onChange={(d) => {
                  selectedOcc.forEach((o) => moveOccurrence(o, d, o.start, undefined, true));
                  clear();
                }}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={() => {
              deleteTasks(selectedTasks.map((t) => t.id));
              clear();
            }}
            className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium text-[color-mix(in_oklab,var(--danger)_70%,white)] hover:bg-white/10 dark:text-danger-text dark:hover:bg-black/20 [&_svg]:size-4"
          >
            <Trash2 /> Delete
          </button>
          <button onClick={clear} aria-label="Clear selection" className="grid size-8 place-items-center rounded-[8px] hover:bg-white/10 dark:hover:bg-black/20">
            <X className="size-4" />
          </button>
        </div>
      )}
    </Container>
  );
}
