"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Drawer } from "vaul";
import { Plus, LayoutGrid, Search } from "lucide-react";
import { NAV } from "./nav-config";
import { useUI } from "@/data/ui-store";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { SyncStatus } from "./sync-status";
import { FocusPill } from "./focus-pill";

function Tab({ pathname, href, label, Icon }: { pathname: string; href: string; label: string; Icon: (typeof NAV)[number]["icon"] }) {
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-medium outline-none", active ? "text-fg" : "text-fg-3")}
    >
      <Icon className={cn("size-[21px]", active && "text-accent-text")} strokeWidth={active ? 2.1 : 1.8} />
      {label}
    </Link>
  );
}

/**
 * Phone navigation: four primary destinations in thumb reach, a raised
 * create button, and "More" as a bottom sheet for the remaining views.
 */
export function MobileNav() {
  const pathname = usePathname();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) => n.mobile);
  const secondary = NAV.filter((n) => !n.mobile);
  const secondaryActive = secondary.some((n) => pathname.startsWith(n.href));

  return (
    <>
      <FocusPill className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 md:hidden" />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(58px+env(safe-area-inset-bottom))] items-stretch border-t border-line bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      >
        <Tab pathname={pathname} href={primary[0].href} label="Today" Icon={primary[0].icon} />
        <Tab pathname={pathname} href={primary[1].href} label="Week" Icon={primary[1].icon} />
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={() => openQuickAdd()}
            aria-label="New task"
            className="grid size-11 place-items-center rounded-[14px] bg-accent-grad text-accent-fg shadow-md outline-none active:scale-95 [&_svg]:size-5"
          >
            <Plus strokeWidth={2.4} />
          </button>
        </div>
        <Tab pathname={pathname} href={primary[2].href} label="Habits" Icon={primary[2].icon} />
        <button
          onClick={() => setMore(true)}
          className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10.5px] font-medium outline-none", secondaryActive ? "text-fg" : "text-fg-3")}
        >
          <LayoutGrid className={cn("size-[21px]", secondaryActive && "text-accent-text")} strokeWidth={1.8} />
          More
        </button>
      </nav>

      <Drawer.Root open={more} onOpenChange={setMore}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/35" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[20px] bg-elevated px-4 pb-[max(16px,env(safe-area-inset-bottom))] outline-none">
            <div className="mx-auto mb-3 mt-2.5 h-1 w-9 rounded-full bg-line-3" />
            <Drawer.Title className="sr-only">More</Drawer.Title>
            <button
              onClick={() => {
                setMore(false);
                setCommandOpen(true);
              }}
              className="mb-3 flex h-11 w-full items-center gap-2.5 rounded-[12px] bg-surface-2 px-3.5 text-[15px] text-fg-3"
            >
              <Search className="size-4" /> Search tasks, notes, habits…
            </button>
            <div className="grid grid-cols-4 gap-2">
              {secondary.map((n) => {
                const I = n.icon;
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMore(false)}
                    className={cn("flex flex-col items-center gap-1.5 rounded-[14px] py-3 text-[12px] font-medium", active ? "bg-accent-soft text-fg" : "bg-surface-2 text-fg-2")}
                  >
                    <I className={cn("size-5", active ? "text-accent-text" : "text-fg-3")} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <div className="min-w-0 flex-1">
                <AccountMenu />
              </div>
              <SyncStatus />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
