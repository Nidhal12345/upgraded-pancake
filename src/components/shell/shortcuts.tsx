"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/data/ui-store";
import { NAV } from "./nav-config";
import { Modal } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export const isTypingTarget = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
};

/** Global keyboard layer. View-specific keys live in their views. */
export function GlobalShortcuts() {
  const router = useRouter();
  const pendingG = useRef<number>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setCommandOpen(!ui.commandOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;

      if (Date.now() - pendingG.current < 900) {
        const item = NAV.find((n) => n.key === e.key.toLowerCase());
        pendingG.current = 0;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      switch (e.key) {
        case "g":
          pendingG.current = Date.now();
          break;
        case "q":
        case "c":
          if (e.key === "c" && location.pathname.startsWith("/notes")) return;
          e.preventDefault();
          ui.openQuickAdd();
          break;
        case "/":
          e.preventDefault();
          ui.setCommandOpen(true);
          break;
        case "?":
          e.preventDefault();
          ui.setShortcutsOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

const SECTIONS: { title: string; items: [string[], string][] }[] = [
  {
    title: "General",
    items: [
      [["⌘", "K"], "Command menu & search"],
      [["Q"], "New task"],
      [["/"], "Search"],
      [["?"], "Show shortcuts"],
    ],
  },
  { title: "Navigate", items: NAV.map((n) => [["G", n.key.toUpperCase()], n.label] as [string[], string]) },
  {
    title: "Planner & calendar",
    items: [
      [["←", "→"], "Previous / next period"],
      [["T"], "Jump to today"],
      [["1", "3", "7"], "Day / 3-day / week view"],
      [["L"], "Toggle list view"],
    ],
  },
  {
    title: "Notes",
    items: [
      [["⌘", "S"], "Save note"],
      [["⌘", "B"], "Bold"],
      [["⌘", "I"], "Italic"],
      [["⌘", "E"], "Cycle edit / split / read"],
    ],
  },
  {
    title: "Learning review",
    items: [
      [["Space"], "Reveal answer / Good"],
      [["1", "2", "3", "4"], "Didn't know · Hard · Good · Easy"],
      [["U"], "Undo last answer"],
      [["E"], "Edit card"],
    ],
  },
  {
    title: "Focus",
    items: [
      [["Space"], "Start / pause timer"],
      [["R"], "Reset"],
      [["S"], "Skip to next"],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcutsOpen);
  const setOpen = useUI((s) => s.setShortcutsOpen);
  return (
    <Modal open={open} onOpenChange={setOpen} title="Keyboard shortcuts" description="Meridian is built to be driven from the keyboard." size="lg">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.07em] text-fg-4">{s.title}</h3>
            <ul className="flex flex-col">
              {s.items.map(([keys, label]) => (
                <li key={label} className="flex h-8 items-center justify-between border-b border-line text-[13px] last:border-0">
                  <span className="text-fg-2">{label}</span>
                  <span className="flex gap-0.5">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
