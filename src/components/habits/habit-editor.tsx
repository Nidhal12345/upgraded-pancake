"use client";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, Minus, Plus } from "lucide-react";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { Modal, Confirm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TonePicker, TimeChip } from "@/components/tasks/pickers";
import { HABIT_ICONS } from "./habit-icon";
import { toneVar } from "@/components/ui/misc";
import { WEEKDAY_MIN, WEEKDAY_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteHabit } from "@/features/tasks/task-actions";
import type { HabitSchedule, Tone } from "@/domain/types";

const schema = z
  .object({
    name: z.string().trim().min(1, "Give your habit a name").max(80, "Keep it under 80 characters"),
    icon: z.string(),
    tone: z.enum(["slate", "persimmon", "amber", "moss", "teal", "sky", "iris", "rose"]),
    kind: z.enum(["daily", "weekdays", "weekly"]),
    days: z.array(z.number().int().min(0).max(6)),
    times: z.number().int().min(1).max(7),
    time: z.number().nullable(),
  })
  .refine((v) => v.kind !== "weekdays" || v.days.length > 0, { message: "Pick at least one day", path: ["days"] });
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { name: "", icon: "sparkles", tone: "persimmon", kind: "daily", days: [1, 2, 3, 4, 5], times: 3, time: null };

export function HabitEditor() {
  const { open, habitId } = useUI((s) => s.habitEditor);
  const close = useUI((s) => s.closeHabitEditor);
  const habit = useApp((s) => (habitId ? s.habits.find((h) => h.id === habitId) : undefined));
  const [confirm, setConfirm] = useState(false);

  const { register, handleSubmit, control, reset, watch, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (!open) return;
    if (habit)
      reset({
        name: habit.name,
        icon: habit.icon,
        tone: habit.tone,
        kind: habit.schedule.kind,
        days: habit.schedule.kind === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5],
        times: habit.schedule.kind === "weekly" ? habit.schedule.times : 3,
        time: habit.time ?? null,
      });
    else reset(DEFAULTS);
  }, [open, habit, reset]);

  const kind = watch("kind");
  const tone = watch("tone");

  const onSubmit = (v: Values) => {
    const schedule: HabitSchedule = v.kind === "daily" ? { kind: "daily" } : v.kind === "weekdays" ? { kind: "weekdays", days: [...v.days].sort() } : { kind: "weekly", times: v.times };
    if (habit) {
      useApp.getState().updateHabit(habit.id, { name: v.name, icon: v.icon, tone: v.tone as Tone, schedule, time: v.time });
      toast.success("Habit updated");
    } else {
      useApp.getState().addHabit({ name: v.name, icon: v.icon, tone: v.tone as Tone, schedule, time: v.time, reminder: v.time != null });
      toast.success("Habit created", { description: "It'll appear on Today whenever it's scheduled." });
    }
    close();
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && close()}
        title={habit ? "Edit habit" : "New habit"}
        description={habit ? undefined : "Small, specific, and repeatable works best."}
        footer={
          <>
            {habit && (
              <Button variant="danger-ghost" className="mr-auto" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)}>
              {habit ? "Save changes" : "Create habit"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Field label="Name" error={formState.errors.name?.message}>
            <Input autoFocus placeholder="e.g. Read 20 pages" aria-invalid={!!formState.errors.name} {...register("name")} />
          </Field>

          <div className="grid gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">Icon</span>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Icon" className="grid grid-cols-10 gap-1">
                  {Object.entries(HABIT_ICONS).map(([k, { icon: I, label }]) => (
                    <button
                      type="button"
                      key={k}
                      role="radio"
                      aria-checked={field.value === k}
                      aria-label={label}
                      title={label}
                      onClick={() => field.onChange(k)}
                      style={toneVar(tone as Tone)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-[8px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-4",
                        field.value === k ? "tone-soft tone-text shadow-[inset_0_0_0_1.5px_var(--tone)]" : "text-fg-3 hover:bg-surface-2 hover:text-fg-2",
                      )}
                    >
                      <I />
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">Colour</span>
            <Controller control={control} name="tone" render={({ field }) => <TonePicker value={field.value as Tone} onChange={field.onChange} />} />
          </div>

          <div className="grid gap-2">
            <span className="text-[12px] font-medium text-fg-2">Frequency</span>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Segmented
                  label="Frequency"
                  value={field.value}
                  onChange={field.onChange}
                  className="w-full [&>button]:flex-1"
                  options={[
                    { value: "daily", label: "Every day" },
                    { value: "weekdays", label: "Specific days" },
                    { value: "weekly", label: "Times per week" },
                  ]}
                />
              )}
            />
            {kind === "weekdays" && (
              <Controller
                control={control}
                name="days"
                render={({ field }) => (
                  <div className="flex justify-between gap-1 pt-1">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = field.value.includes(d);
                      return (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={on}
                          aria-label={WEEKDAY_SHORT[d]}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== d) : [...field.value, d])}
                          className={cn(
                            "grid h-9 flex-1 place-items-center rounded-[8px] text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                            on ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2 hover:bg-surface-3",
                          )}
                        >
                          {WEEKDAY_MIN[d]}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            )}
            {formState.errors.days && <span className="text-[12px] text-danger-text">{formState.errors.days.message}</span>}
            {kind === "weekly" && (
              <Controller
                control={control}
                name="times"
                render={({ field }) => (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center rounded-[9px] bg-surface-2 p-0.5">
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Fewer" onClick={() => field.onChange(Math.max(1, field.value - 1))}>
                        <Minus />
                      </Button>
                      <span className="w-8 text-center font-mono text-[15px] tabular">{field.value}</span>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="More" onClick={() => field.onChange(Math.min(7, field.value + 1))}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="text-[13px] text-fg-2">times a week, on any days</span>
                  </div>
                )}
              />
            )}
          </div>

          <div className="grid gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">Preferred time</span>
            <div className="flex items-center gap-2">
              <Controller control={control} name="time" render={({ field }) => <TimeChip value={field.value} onChange={field.onChange} />} />
              <span className="text-[12px] text-fg-3">Shows in the week planner and reminders</span>
            </div>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>
      {habit && (
        <Confirm
          open={confirm}
          onOpenChange={setConfirm}
          title={`Delete "${habit.name}"?`}
          description="Its full check-in history will be removed. You can undo right after."
          onConfirm={() => {
            close();
            deleteHabit(habit);
          }}
        />
      )}
    </>
  );
}
