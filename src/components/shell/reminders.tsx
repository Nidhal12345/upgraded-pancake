"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApp } from "@/data/store";
import { expandOccurrences } from "@/domain/recurrence";
import { habitsForDay } from "@/domain/habits";
import { fmtTime, nowMinutes, todayKey } from "@/lib/dates";
import { useUI } from "@/data/ui-store";

/**
 * In-app reminders: once a minute, surface tasks whose reminder window just
 * opened (and habits at their preferred time). De-duplicated per session.
 */
export function ReminderWatcher() {
  const fired = useRef(new Set<string>());
  useEffect(() => {
    const check = () => {
      const s = useApp.getState();
      if (!s.hydrated) return;
      const day = todayKey();
      const now = nowMinutes();
      for (const o of expandOccurrences(s.tasks, day, day)) {
        if (o.start == null || o.task.reminder == null || o.status === "done" || o.status === "cancelled") continue;
        const at = o.start - o.task.reminder;
        const key = `${o.key}@${at}`;
        if (now >= at && now < o.start && !fired.current.has(key)) {
          fired.current.add(key);
          toast(`Starting at ${fmtTime(o.start)}`, {
            description: o.title,
            duration: 10_000,
            action: { label: "Open", onClick: () => useUI.getState().openEditor({ taskId: o.taskId, originalDate: o.recurring ? o.originalDate : undefined }) },
          });
        }
      }
      for (const h of habitsForDay(s.habits, day, s.settings.weekStartsOn)) {
        if (!h.reminder || h.time == null || h.log.includes(day)) continue;
        const key = `${h.id}@${day}`;
        if (now >= h.time && now < h.time + 30 && !fired.current.has(key)) {
          fired.current.add(key);
          toast(`Time for ${h.name}`, { description: "Check in from Today when you're done.", duration: 8000 });
        }
      }
    };
    const first = setTimeout(check, 4000);
    const id = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return null;
}
