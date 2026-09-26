"use client";
import { useState } from "react";
import { Repeat, Trash2, SkipForward, Ban, RotateCcw, MoreHorizontal, Copy, Bell, BellOff, Info, GraduationCap } from "lucide-react";
import { format } from "date-fns";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { DateChip, DurationChip, RecurrenceChip, TimeChip, ToneChip, chipClass } from "./pickers";
import { StatusMenu } from "./status";
import { describeRecurrence, occurrenceOf } from "@/domain/recurrence";
import { deleteTasks, skipOccurrence } from "@/features/tasks/task-actions";
import { fromKey, relativeDayLabel } from "@/lib/dates";
import type { Task, TaskOccurrence } from "@/domain/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Task inspector. For recurring tasks opened from a specific day, a scope
 * switch toggles between editing *this occurrence* (stored as an override)
 * and the whole *series*.
 */
export function TaskEditor() {
  const target = useUI((s) => s.editor);
  const close = useUI((s) => s.closeEditor);
  const task = useApp((s) => (target ? s.tasks.find((t) => t.id === target.taskId) : undefined));
  if (!target || !task) return <Sheet open={false} onOpenChange={() => {}} title="Task">{null}</Sheet>;
  return <TaskEditorBody key={`${target.taskId}:${target.originalDate ?? ""}`} task={task} originalDate={target.originalDate} close={close} />;
}

function TaskEditorBody({ task, originalDate, close }: { task: Task; originalDate?: string; close: () => void }) {
  const ws = useApp((s) => s.settings.weekStartsOn);
  const a = useApp.getState;
  const occ: TaskOccurrence | undefined = task.recurrence && originalDate ? occurrenceOf(task, originalDate) : undefined;
  const [scope, setScopeState] = useState<"this" | "series">(originalDate ? "this" : "series");
  const occurrenceMode = !!occ && scope === "this";
  const override = occ ? task.overrides?.[occ.originalDate] : undefined;

  // Draft fields; re-seeded whenever the underlying value or scope changes (render-time sync).
  const sourceTitle = occurrenceMode ? occ!.title : task.title;
  const [title, setTitle] = useState(sourceTitle);
  const [seenTitle, setSeenTitle] = useState(sourceTitle);
  if (seenTitle !== sourceTitle) {
    setSeenTitle(sourceTitle);
    setTitle(sourceTitle);
  }
  const [notes, setNotes] = useState(task.notes ?? "");
  const setScope = (s: "this" | "series") => setScopeState(s);

  const commitTitle = () => {
    const v = title.trim();
    if (!v) return setTitle(occurrenceMode ? occ!.title : task.title);
    if (occurrenceMode) {
      if (v !== occ!.title) a().patchOccurrence(occ!, { title: v === task.title ? undefined : v });
    } else if (v !== task.title) a().updateTask(task.id, { title: v });
  };
  const commitNotes = () => {
    if ((task.notes ?? "") !== notes) a().updateTask(task.id, { notes: notes || undefined });
  };

  const header = (
    <>
      {occ && (
        <Segmented
          size="xs"
          label="Edit scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: "this", label: "This occurrence" },
            { value: "series", label: "Entire series" },
          ]}
        />
      )}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions" className={cn(!occ && "ml-auto", occ && "ml-auto md:ml-1")}>
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem
            onSelect={() => {
              const { id: _id, createdAt: _c, updatedAt: _u, overrides: _o, ...rest } = task;
              void _id; void _c; void _u; void _o;
              const copy = a().addTask({ ...rest, title: `${task.title} (copy)`, status: "todo" });
              toast("Task duplicated", { action: { label: "Open", onClick: () => useUI.getState().openEditor({ taskId: copy.id }) } });
            }}
          >
            <Copy /> Duplicate
          </MenuItem>
          <MenuItem
            onSelect={() => {
              close();
              useUI.getState().openCardComposer({ prefill: { front: task.title, back: task.notes ?? "", source: { kind: "task", id: task.id, label: task.title } } });
            }}
          >
            <GraduationCap /> Turn into learning card
          </MenuItem>
          {occ && (
            <MenuItem
              onSelect={() => {
                skipOccurrence(occ);
                close();
              }}
            >
              <SkipForward /> Skip this occurrence
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem
            danger
            onSelect={() => {
              close();
              deleteTasks([task.id]);
            }}
          >
            <Trash2 /> {task.recurrence ? "Delete entire series" : "Delete task"}
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );

  return (
    <Sheet open onOpenChange={(o) => !o && close()} title={task.title} header={header}>
      <div className="flex flex-col gap-5">
        {occ && (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
            <Repeat className="mt-0.5 size-3.5 shrink-0 text-accent-text" />
            <div className="min-w-0">
              {occurrenceMode ? (
                <>
                  Editing <b className="font-medium text-fg">{format(fromKey(occ.originalDate), "EEEE, MMM d")}</b> only. Other
                  occurrences keep the series settings.
                </>
              ) : (
                <>Changes apply to every occurrence of <b className="font-medium text-fg">{describeRecurrence(task.recurrence, task.date).toLowerCase()}</b>, except ones you edited individually.</>
              )}
              {override && occurrenceMode && Object.keys(override).length > 0 && (
                <button onClick={() => a().resetOccurrence(occ)} className="mt-1 flex items-center gap-1 font-medium text-accent-text hover:underline">
                  <RotateCcw className="size-3" /> Reset to series
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            rows={1}
            aria-label="Title"
            className={cn(
              "field-sizing-content w-full resize-none bg-transparent text-[20px] font-semibold leading-snug tracking-[-0.015em] outline-none",
              (occurrenceMode ? occ!.status : task.status) === "done" && "text-fg-3",
              (occurrenceMode ? occ!.status : task.status) === "cancelled" && "text-fg-3 line-through",
            )}
          />
        </div>

        <dl className="grid grid-cols-[92px_1fr] items-center gap-x-3 gap-y-2.5 text-[13px]">
          <dt className="text-fg-3">Status</dt>
          <dd>
            {occurrenceMode ? (
              <StatusMenu value={occ!.status} onChange={(s) => a().setOccurrenceStatus(occ!, s)} />
            ) : task.recurrence ? (
              <span className="text-[12.5px] text-fg-3">Tracked per occurrence</span>
            ) : (
              <StatusMenu value={task.status} onChange={(s) => a().updateTask(task.id, { status: s })} />
            )}
          </dd>

          <dt className="text-fg-3">{task.recurrence && !occurrenceMode ? "Starts" : "Date"}</dt>
          <dd>
            {occurrenceMode ? (
              <DateChip value={occ!.date} allowClear={false} weekStartsOn={ws} onChange={(d) => d && a().patchOccurrence(occ!, { date: d })} />
            ) : (
              <DateChip value={task.date} allowClear={!task.recurrence} weekStartsOn={ws} onChange={(d) => a().updateTask(task.id, { date: d })} />
            )}
            {occurrenceMode && occ!.moved && <span className="ml-2 text-[12px] text-fg-3">moved from {relativeDayLabel(occ!.originalDate)}</span>}
          </dd>

          <dt className="text-fg-3">Time</dt>
          <dd className="flex flex-wrap gap-1.5">
            {occurrenceMode ? (
              <>
                <TimeChip value={occ!.start} onChange={(m) => a().patchOccurrence(occ!, { start: m })} />
                {occ!.start != null && <DurationChip value={occ!.duration} onChange={(m) => a().patchOccurrence(occ!, { duration: m })} />}
              </>
            ) : (
              <>
                <TimeChip value={task.start} onChange={(m) => a().updateTask(task.id, { start: m })} />
                {task.start != null && <DurationChip value={task.duration ?? 30} onChange={(m) => a().updateTask(task.id, { duration: m })} />}
              </>
            )}
          </dd>

          <dt className="text-fg-3">Repeat</dt>
          <dd>
            {occurrenceMode ? (
              <button className={chipClass} onClick={() => setScope("series")}>
                <Repeat /> {describeRecurrence(task.recurrence, task.date)}
              </button>
            ) : (
              <RecurrenceChip
                value={task.recurrence}
                anchor={task.date}
                onChange={(r) => a().updateTask(task.id, { recurrence: r, date: task.date ?? (r ? occ?.originalDate : undefined), status: r ? "todo" : task.status })}
              />
            )}
          </dd>

          <dt className="text-fg-3">Colour</dt>
          <dd>
            <ToneChip value={task.tone} onChange={(t) => a().updateTask(task.id, { tone: t })} />
          </dd>

          <dt className="text-fg-3">Reminder</dt>
          <dd>
            <button
              className={chipClass}
              data-active={task.reminder != null}
              disabled={(occurrenceMode ? occ!.start : task.start) == null}
              onClick={() => a().updateTask(task.id, { reminder: task.reminder != null ? null : 10 })}
            >
              {task.reminder != null ? <Bell /> : <BellOff />}
              {(occurrenceMode ? occ!.start : task.start) == null ? "Needs a time" : task.reminder != null ? "10 min before" : "Off"}
            </button>
          </dd>
        </dl>

        {occurrenceMode && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => { skipOccurrence(occ!); close(); }}>
              <SkipForward /> Skip once
            </Button>
            <Button size="sm" variant="subtle" onClick={() => a().setOccurrenceStatus(occ!, occ!.status === "cancelled" ? "todo" : "cancelled")}>
              <Ban /> {occ!.status === "cancelled" ? "Restore" : "Cancel once"}
            </Button>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[12px] font-medium text-fg-3">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={commitNotes}
            placeholder="Add context, links, or a checklist…"
            className="field-sizing-content min-h-24 w-full resize-none rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13.5px] leading-relaxed outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)]"
          />
        </div>

        <p className="flex items-center gap-1.5 text-[11.5px] text-fg-4">
          <Info className="size-3" />
          Created {format(new Date(task.createdAt), "MMM d, yyyy")} · updated {format(new Date(task.updatedAt), "MMM d, HH:mm")}
        </p>
      </div>
    </Sheet>
  );
}
