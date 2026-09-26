"use client";
import { useState } from "react";
import { Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Link2, Code, Smile, Table } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ToolbarAction =
  | "bold" | "italic" | "strike" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "checkbox" | "quote" | "link" | "code";

const btn =
  "grid size-8 shrink-0 place-items-center rounded-[7px] text-fg-3 outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40 data-[state=open]:bg-pressed data-[state=open]:text-fg [&_svg]:size-4";

const GROUPS: { id: ToolbarAction; label: string; icon: typeof Bold; keys?: string[] }[][] = [
  [
    { id: "h1", label: "Heading 1", icon: Heading1 },
    { id: "h2", label: "Heading 2", icon: Heading2 },
    { id: "h3", label: "Heading 3", icon: Heading3 },
  ],
  [
    { id: "bold", label: "Bold", icon: Bold, keys: ["⌘", "B"] },
    { id: "italic", label: "Italic", icon: Italic, keys: ["⌘", "I"] },
    { id: "strike", label: "Strikethrough", icon: Strikethrough, keys: ["⌘", "⇧", "X"] },
    { id: "code", label: "Inline code", icon: Code },
  ],
  [
    { id: "bullet", label: "Bulleted list", icon: List },
    { id: "numbered", label: "Numbered list", icon: ListOrdered },
    { id: "checkbox", label: "Checklist", icon: ListChecks },
    { id: "quote", label: "Quote", icon: Quote },
    { id: "link", label: "Link", icon: Link2, keys: ["⌘", "K"] },
  ],
];

const EMOJI: Record<string, string[]> = {
  Smileys: ["😀", "😊", "🙂", "😉", "😍", "🤔", "😅", "😌", "😴", "🥳", "😎", "🙃", "😬", "🥲", "🤯", "😤"],
  Gestures: ["👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "✌️", "🤝", "👀", "🫡", "🤞"],
  Symbols: ["✅", "❌", "⚠️", "⭐", "🔥", "✨", "💡", "📌", "🎯", "🚀", "❤️", "💯", "⏰", "📅", "🔁", "➡️"],
  Objects: ["📝", "📚", "💼", "🧠", "☕", "🌱", "🏃", "🧘", "🎨", "🎧", "💻", "📈", "🏠", "✈️", "🍎", "💧"],
};

function EmojiPicker({ onPick, disabled }: { onPick: (e: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Emoji">
        <PopoverTrigger asChild>
          <button className={btn} aria-label="Insert emoji" disabled={disabled} onMouseDown={(e) => e.preventDefault()}>
            <Smile />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-[292px] p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="max-h-[260px] overflow-y-auto">
          {Object.entries(EMOJI).map(([g, list]) => (
            <div key={g} className="mb-2">
              <div className="px-1 pb-1 text-[10.5px] font-medium uppercase tracking-[0.07em] text-fg-4">{g}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {list.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      onPick(e);
                      setOpen(false);
                    }}
                    aria-label={`Insert ${e}`}
                    className="grid size-8 place-items-center rounded-[6px] text-[18px] outline-none hover:bg-surface-3 focus-visible:bg-surface-3"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TablePicker({ onPick, disabled }: { onPick: (rows: number, cols: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<[number, number]>([2, 3]);
  const R = 6, C = 6;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Table">
        <PopoverTrigger asChild>
          <button className={btn} aria-label="Insert table" disabled={disabled} onMouseDown={(e) => e.preventDefault()}>
            <Table />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="p-3" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${C}, 1fr)` }} onMouseLeave={() => setHover([2, 3])}>
          {Array.from({ length: R * C }).map((_, i) => {
            const r = Math.floor(i / C) + 1;
            const c = (i % C) + 1;
            const on = r <= hover[0] && c <= hover[1];
            return (
              <button
                key={i}
                onMouseEnter={() => setHover([r, c])}
                onFocus={() => setHover([r, c])}
                onClick={() => {
                  onPick(r, c);
                  setOpen(false);
                }}
                aria-label={`${r} by ${c} table`}
                className={cn("size-[22px] rounded-[4px] border outline-none transition-colors", on ? "border-accent bg-accent-soft" : "border-line-2 bg-surface-2")}
              />
            );
          })}
        </div>
        <div className="mt-2 text-center font-mono text-[11.5px] tabular text-fg-3">
          {hover[0]} × {hover[1]} <span className="text-fg-4">· rows × columns</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar({ onAction, onEmoji, onTable, disabled, trailing }: { onAction: (a: ToolbarAction) => void; onEmoji: (e: string) => void; onTable: (r: number, c: number) => void; disabled?: boolean; trailing?: React.ReactNode }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex w-full items-center gap-0.5 overflow-x-auto no-scrollbar">
      {GROUPS.map((g, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-1 h-4 w-px shrink-0 bg-line-2" />}
          {g.map((b) => (
            <Tooltip key={b.id} content={b.label} shortcut={b.keys}>
              <button
                className={btn}
                aria-label={b.label}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault() /* keep textarea selection */}
                onClick={() => onAction(b.id)}
              >
                <b.icon />
              </button>
            </Tooltip>
          ))}
        </div>
      ))}
      <span className="mx-1 h-4 w-px shrink-0 bg-line-2" />
      <TablePicker onPick={onTable} disabled={disabled} />
      <EmojiPicker onPick={onEmoji} disabled={disabled} />
      {trailing}
    </div>
  );
}
