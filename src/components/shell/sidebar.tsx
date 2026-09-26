"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { NAV } from "./nav-config";
import { BrandMark } from "./brand";
import { AccountMenu } from "./account-menu";
import { SyncStatus } from "./sync-status";
import { FocusPill } from "./focus-pill";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { todayIntentions } from "@/domain/progress";
import { todayKey } from "@/lib/dates";
import { isDue } from "@/domain/learning";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function useLearnDue() {
  const cards = useApp((s) => s.cards);
  return useMemo(() => cards.filter((c) => isDue(c)).length, [cards]);
}

function useTodayRemaining() {
  const tasks = useApp((s) => s.tasks);
  const habits = useApp((s) => s.habits);
  const ws = useApp((s) => s.settings.weekStartsOn);
  return useMemo(() => {
    const r = todayIntentions(tasks, habits, todayKey(), ws);
    return r.total - r.done;
  }, [tasks, habits, ws]);
}

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const remaining = useTodayRemaining();
  const learnDue = useLearnDue();

  const groups = [
    { id: "plan", label: "Plan" },
    { id: "track", label: "Reflect" },
    { id: "grow", label: "Grow" },
  ] as const;

  return (
    <aside className="sticky top-0 hidden h-dvh w-[64px] shrink-0 flex-col border-r border-line [background:var(--grad-sidebar)] px-2.5 py-3 md:flex lg:w-[232px]">
      <div className="flex h-9 items-center gap-2.5 px-1.5 max-lg:justify-center">
        <BrandMark />
        <span className="hidden font-serif text-[21px] leading-none tracking-[-0.01em] lg:block">Meridian</span>
      </div>

      <div className="mt-4 flex flex-col gap-1.5 max-lg:items-center">
        <Tooltip content="New task" shortcut={["Q"]} side="right">
          <button
            onClick={() => openQuickAdd()}
            className="flex h-8 items-center gap-2 rounded-[8px] bg-accent-grad px-2.5 text-[13px] font-medium text-accent-fg shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_1px_2px_oklch(0.3_0.1_280/0.25)] outline-none transition-[filter] hover:brightness-[1.06] focus-visible:ring-2 focus-visible:ring-[var(--ring)] max-lg:size-9 max-lg:justify-center max-lg:px-0 [&_svg]:size-4"
          >
            <Plus />
            <span className="hidden lg:inline">New task</span>
            <Kbd className="ml-auto hidden border-white/20 bg-white/15 text-accent-fg/80 shadow-none lg:inline-flex">Q</Kbd>
          </button>
        </Tooltip>
        <Tooltip content="Search & commands" shortcut={["⌘", "K"]} side="right">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-[13px] text-fg-3 outline-none transition-colors hover:bg-hover hover:text-fg-2 focus-visible:ring-2 focus-visible:ring-[var(--ring)] max-lg:size-9 max-lg:justify-center max-lg:px-0 [&_svg]:size-4"
          >
            <Search />
            <span className="hidden lg:inline">Search</span>
            <span className="ml-auto hidden gap-0.5 lg:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        </Tooltip>
      </div>

      <nav aria-label="Primary" className="mt-5 flex min-h-0 flex-col gap-4 overflow-y-auto no-scrollbar">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="mb-1 hidden px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-4 lg:block">{g.label}</div>
            <ul className="flex flex-col gap-px max-lg:items-center">
              {NAV.filter((n) => n.group === g.id).map((n) => {
                const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
                const I = n.icon;
                return (
                  <li key={n.href}>
                    <Tooltip content={n.label} shortcut={["G", n.key.toUpperCase()]} side="right">
                      <Link
                        href={n.href}
                        prefetch
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] max-lg:size-9 max-lg:justify-center max-lg:px-0 lg:w-[208px]",
                          active ? "bg-surface font-medium text-fg shadow-[var(--highlight),var(--shadow-sm)]" : "text-fg-2 hover:bg-hover hover:text-fg",
                        )}
                      >
                        <I className={cn("size-[17px] shrink-0", active ? "text-accent-text" : "text-fg-3 group-hover:text-fg-2")} strokeWidth={active ? 2.1 : 1.8} />
                        <span className="hidden lg:inline">{n.label}</span>
                        {n.href === "/today" && remaining > 0 && (
                          <span className="ml-auto hidden font-mono text-[11px] tabular text-fg-3 lg:inline">{remaining}</span>
                        )}
                        {n.href === "/today" && remaining > 0 && (
                          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent lg:hidden" />
                        )}
                        {n.href === "/learn" && learnDue > 0 && (
                          <span className="ml-auto hidden h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1.5 font-mono text-[10.5px] font-medium tabular text-accent-text lg:grid">{learnDue}</span>
                        )}
                      </Link>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <FocusPill className="hidden lg:flex" />
        <div className="hidden items-center justify-between px-0.5 lg:flex">
          <SyncStatus />
        </div>
        <div className="flex justify-center lg:hidden">
          <SyncStatus compact />
        </div>
        <AccountMenu />
      </div>
    </aside>
  );
});
