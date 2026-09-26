"use client";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useApp, flushSync } from "@/data/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CommandMenu } from "./command-menu";
import { GlobalShortcuts, ShortcutsDialog } from "./shortcuts";
import { ThemeSync } from "./theme";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskEditor } from "@/components/tasks/task-editor";
import { HabitEditor } from "@/components/habits/habit-editor";
import { CardComposer } from "@/components/learning/card-composer";
import { DeckEditor } from "@/components/learning/deck-editor";
import { useFocus } from "@/features/focus/focus-store";
import { ReminderWatcher } from "./reminders";
import { useIsMobile } from "@/hooks/use-media-query";

/** Background ticker so the timer completes even when /focus isn't mounted. */
function FocusTicker() {
  const running = useFocus((s) => s.status === "running");
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => useFocus.getState().tick(), 500);
    return () => clearInterval(id);
  }, [running]);
  return null;
}

export function AppShell({ accountId, children }: { accountId: string; children: React.ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const mobile = useIsMobile();

  useEffect(() => {
    void hydrate(accountId);
  }, [accountId, hydrate]);

  // Cloud refresh: on focus/visibility and every 60 s while visible. Flush on hide.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void useApp.getState().refresh();
      else flushSync();
    };
    const onOnline = () => void useApp.getState().refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    const id = setInterval(() => document.visibilityState === "visible" && void useApp.getState().refresh(), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      clearInterval(id);
    };
  }, []);

  return (
    <TooltipProvider>
      <ThemeSync />
      <GlobalShortcuts />
      <FocusTicker />
      <ReminderWatcher />
      <div className="flex min-h-dvh">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 pb-[calc(58px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
      <CommandMenu />
      <QuickAdd />
      <TaskEditor />
      <HabitEditor />
      <CardComposer />
      <DeckEditor />
      <ShortcutsDialog />
      <Toaster
        position={mobile ? "top-center" : "bottom-right"}
        offset={16}
        mobileOffset={{ top: 12, left: 12, right: 12 }}
        gap={8}
        toastOptions={{
          classNames: {
            toast: "!rounded-[12px] !bg-elevated !text-fg !shadow-lg !border-0 !text-[13px] !gap-2.5 !py-3 !px-3.5",
            description: "!text-fg-3 !text-[12.5px]",
            actionButton: "!bg-surface-3 !text-fg !font-medium !rounded-[6px] !h-6 !px-2 !text-[12px]",
            success: "[&_[data-icon]]:!text-ok-text",
          },
        }}
      />
    </TooltipProvider>
  );
}
