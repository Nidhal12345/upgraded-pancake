"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Plus, Repeat2, NotebookPen, Play, Moon, Sun, Keyboard, CalendarDays, CheckCircle2, Search, CornerDownLeft, GraduationCap, Layers } from "lucide-react";
import { isDue } from "@/domain/learning";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { NAV } from "./nav-config";
import { useFocus } from "@/features/focus/focus-store";
import { HabitIcon } from "@/components/habits/habit-icon";
import { ToneDot } from "@/components/ui/misc";
import { Kbd } from "@/components/ui/kbd";
import { relativeDayLabel, todayKey } from "@/lib/dates";
import { expandOccurrences } from "@/domain/recurrence";
import { toggleHabitCheckIn, toggleOccurrence } from "@/features/tasks/task-actions";
import { StatusIcon } from "@/components/tasks/status";
import { parseQuickAdd } from "@/domain/parse";

const itemCls =
  "flex h-10 cursor-default select-none items-center gap-3 rounded-[9px] px-2.5 text-[13.5px] text-fg outline-none data-[selected=true]:bg-hover [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-fg-3";
const groupCls =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-fg-4";

/** ⌘K — navigate, search everything, and run any action without the mouse. */
export function CommandMenu() {
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommandOpen);
  const ui = useUI.getState;
  const router = useRouter();
  const [q, setQ] = useState("");
  const tasks = useApp((s) => s.tasks);
  const habits = useApp((s) => s.habits);
  const notes = useApp((s) => s.notes);
  const theme = useApp((s) => s.settings.theme);
  const cards = useApp((s) => s.cards);
  const dueCount = useMemo(() => (open ? cards.filter((c) => isDue(c)).length : 0), [open, cards]);

  const today = todayKey();
  const todays = useMemo(() => (open ? expandOccurrences(tasks, today, today) : []), [open, tasks, today]);
  const searchable = useMemo(() => (open && q.length > 1 ? tasks.slice(0, 400) : []), [open, q, tasks]);

  const run = (fn: () => void) => {
    setOpen(false);
    setQ("");
    fn();
  };
  const go = (href: string) => run(() => router.push(href));
  const parsed = q.trim().length > 2 ? parseQuickAdd(q) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[oklch(0.25_0.03_270/0.2)] dark:bg-black/55" />
        <Dialog.Content className="fixed left-1/2 top-[max(10vh,16px)] z-[71] w-[calc(100vw-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-[16px] bg-elevated shadow-lg outline-none animate-in">
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <Dialog.Description className="sr-only">Search and run commands</Dialog.Description>
          <Command loop className="flex max-h-[min(560px,80dvh)] flex-col">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-fg-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="Search or type a command…"
                className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-fg-4"
              />
              <Kbd className="max-md:hidden">esc</Kbd>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              <Command.Empty className="px-3 py-10 text-center text-[13px] text-fg-3">No results for “{q}”.</Command.Empty>

              {parsed?.title && (
                <Command.Group heading="Create" className={groupCls}>
                  <Command.Item
                    value={`create task ${q}`}
                    onSelect={() =>
                      run(() => {
                        const t = useApp.getState().addTask({ title: parsed.title, date: parsed.date ?? today, start: parsed.start ?? null, duration: parsed.duration ?? 30, recurrence: parsed.recurrence });
                        router.push("/today");
                        void t;
                      })
                    }
                    className={itemCls}
                  >
                    <Plus className="!text-accent" />
                    <span className="min-w-0 flex-1 truncate">
                      Create task <b className="font-medium">“{parsed.title}”</b>
                      {parsed.tokens.length > 0 && <span className="text-fg-3"> · {parsed.tokens.map((t) => t.label).join(" · ")}</span>}
                    </span>
                    <CornerDownLeft className="!size-3.5" />
                  </Command.Item>
                </Command.Group>
              )}

              <Command.Group heading="Actions" className={groupCls}>
                <Command.Item value="new task create add" onSelect={() => run(() => ui().openQuickAdd())} className={itemCls}>
                  <Plus /> New task <Kbd className="ml-auto">Q</Kbd>
                </Command.Item>
                <Command.Item value="new habit create" onSelect={() => run(() => ui().openHabitEditor())} className={itemCls}>
                  <Repeat2 /> New habit
                </Command.Item>
                <Command.Item
                  value="new note create write"
                  onSelect={() =>
                    run(() => {
                      const n = useApp.getState().createNote();
                      router.push(`/notes?id=${n.id}`);
                    })
                  }
                  className={itemCls}
                >
                  <NotebookPen /> New note
                </Command.Item>
                <Command.Item value="new learning card flashcard memorize" onSelect={() => run(() => ui().openCardComposer(parsed?.title && q.toLowerCase().startsWith("card ") ? { prefill: { front: q.slice(5) } } : undefined))} className={itemCls}>
                  <GraduationCap /> New learning card
                </Command.Item>
                <Command.Item value="start review learning flashcards study due" onSelect={() => go("/learn?review=1")} className={itemCls}>
                  <Play /> Start review
                  {dueCount > 0 && <span className="ml-auto rounded-full bg-accent-soft px-1.5 font-mono text-[11px] text-accent-text">{dueCount} due</span>}
                </Command.Item>
                <Command.Item value="new deck learning category" onSelect={() => run(() => ui().openDeckEditor())} className={itemCls}>
                  <Layers /> New deck
                </Command.Item>
                <Command.Item
                  value="start focus pomodoro timer"
                  onSelect={() =>
                    run(() => {
                      useFocus.getState().start();
                      router.push("/focus");
                    })
                  }
                  className={itemCls}
                >
                  <Play /> Start focus session
                </Command.Item>
                <Command.Item value="toggle theme dark light appearance" onSelect={() => run(() => useApp.getState().updateSettings({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" }))} className={itemCls}>
                  {theme === "dark" ? <Sun /> : <Moon />} Toggle dark mode
                </Command.Item>
                <Command.Item value="keyboard shortcuts help" onSelect={() => run(() => ui().setShortcutsOpen(true))} className={itemCls}>
                  <Keyboard /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Go to" className={groupCls}>
                {NAV.map((n) => (
                  <Command.Item key={n.href} value={`go ${n.label}`} onSelect={() => go(n.href)} className={itemCls}>
                    <n.icon /> {n.label}
                    <span className="ml-auto flex gap-0.5">
                      <Kbd>G</Kbd>
                      <Kbd>{n.key.toUpperCase()}</Kbd>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {todays.length > 0 && (
                <Command.Group heading="Complete today" className={groupCls}>
                  {todays
                    .filter((o) => o.status !== "done" && o.status !== "cancelled")
                    .slice(0, 6)
                    .map((o) => (
                      <Command.Item key={o.key} value={`complete ${o.title} ${o.key}`} onSelect={() => run(() => toggleOccurrence(o))} className={itemCls}>
                        <CheckCircle2 /> <span className="truncate">{o.title}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              )}

              <Command.Group heading="Habits" className={groupCls}>
                {habits
                  .filter((h) => !h.archived)
                  .map((h) => (
                    <Command.Item key={h.id} value={`habit check in ${h.name}`} onSelect={() => run(() => toggleHabitCheckIn(h, today))} className={itemCls}>
                      <HabitIcon name={h.icon} />
                      <span className="truncate">{h.log.includes(today) ? "Undo check-in:" : "Check in:"} {h.name}</span>
                    </Command.Item>
                  ))}
              </Command.Group>

              {searchable.length > 0 && (
                <Command.Group heading="Tasks" className={groupCls}>
                  {searchable.map((t) => (
                    <Command.Item key={t.id} value={`task ${t.title} ${t.project ?? ""} ${t.id}`} onSelect={() => run(() => ui().openEditor({ taskId: t.id }))} className={itemCls}>
                      <StatusIcon status={t.status} />
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <ToneDot tone={t.tone} />
                      {t.date && <span className="text-[12px] text-fg-4">{relativeDayLabel(t.date)}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {q.length > 1 && (
                <Command.Group heading="Learning cards" className={groupCls}>
                  {cards.slice(0, 300).map((c) => (
                    <Command.Item key={c.id} value={`card ${c.front} ${c.back.slice(0, 120)} ${c.tags.join(" ")} ${c.id}`} onSelect={() => run(() => ui().openCardComposer({ cardId: c.id }))} className={itemCls}>
                      <GraduationCap />
                      <span className="min-w-0 flex-1 truncate">{c.front}</span>
                      <span className="max-w-[40%] truncate text-[12px] text-fg-4">{c.back}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {q.length > 1 && (
                <Command.Group heading="Notes" className={groupCls}>
                  {notes
                    .filter((n) => n.state !== "trashed")
                    .map((n) => (
                      <Command.Item key={n.id} value={`note ${n.title} ${n.body.slice(0, 300)} ${n.id}`} onSelect={() => go(`/notes?id=${n.id}`)} className={itemCls}>
                        <NotebookPen />
                        <span className="min-w-0 flex-1 truncate">{n.title || "Untitled"}</span>
                        {n.state === "archived" && <span className="text-[12px] text-fg-4">Archived</span>}
                      </Command.Item>
                    ))}
                </Command.Group>
              )}

              <Command.Group heading="Jump" className={groupCls}>
                <Command.Item value="jump calendar today date" onSelect={() => go(`/calendar`)} className={itemCls}>
                  <CalendarDays /> Open calendar
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-fg-4 max-md:hidden">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> select
              </span>
              <span className="ml-auto">Tip: type “Call Sam tomorrow 3pm” to create instantly</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
