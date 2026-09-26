"use client";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Link2, Trash2, Check, X, Layers, RotateCcw, Pause, Play } from "lucide-react";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator } from "@/components/ui/menu";
import { chipClass } from "@/components/tasks/pickers";
import { toneVar } from "@/components/ui/misc";
import { DeckIcon } from "./deck-icon";
import { parseTags } from "@/domain/learning";
import { difficultyLabel, memoryStrength, formatInterval } from "@/domain/srs";
import { deleteCardsWithUndo, toggleSuspend } from "@/features/learning/learning-actions";
import type { CardSource, ID } from "@/domain/types";
import { cn, pluralize } from "@/lib/utils";

const field =
  "w-full resize-none rounded-[10px] bg-input px-3 py-2.5 text-[14px] leading-relaxed outline-none shadow-[0_0_0_1px_var(--line-2)] placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)] field-sizing-content";

/** Global composer for creating / editing learning cards (single or batch). */
export function CardComposer() {
  const state = useUI((s) => s.cardComposer);
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(state.open);
  if (state.open !== wasOpen) {
    setWasOpen(state.open);
    if (state.open) setSession((n) => n + 1);
  }
  return <ComposerBody key={session} />;
}

function DeckPicker({ value, onChange }: { value?: ID; onChange: (id: ID) => void }) {
  const decks = useApp((s) => s.decks).filter((d) => !d.archived);
  const openDeckEditor = useUI((s) => s.openDeckEditor);
  const cur = decks.find((d) => d.id === value);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className={chipClass} data-active={!!cur} style={cur ? toneVar(cur.tone) : undefined}>
          {cur ? <DeckIcon name={cur.icon} className="tone-text" /> : <Layers />}
          <span className="truncate">{cur?.name ?? "Choose deck"}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-[240px]">
        {decks.map((d) => (
          <MenuItem key={d.id} onSelect={() => onChange(d.id)} style={toneVar(d.tone)}>
            <DeckIcon name={d.icon} className="!text-[var(--tone)]" />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            {d.id === value && <Check className="!text-accent-text" />}
          </MenuItem>
        ))}
        {decks.length > 0 && <MenuSeparator />}
        <MenuItem onSelect={() => openDeckEditor()}>
          <Plus /> New deck…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Remembers the last deck used so rapid capture keeps landing in the same place. */
let lastDeckMemory: string | undefined;

function ComposerBody() {
  const { open, cardId, prefill, batch } = useUI((s) => s.cardComposer);
  const close = useUI((s) => s.closeCardComposer);
  const decks = useApp((s) => s.decks);
  const card = useApp((s) => (cardId ? s.cards.find((c) => c.id === cardId) : undefined));
  const addCards = useApp((s) => s.addCards);
  const updateCard = useApp((s) => s.updateCard);
  const [now] = useState(() => Date.now());

  const defaultDeck = card?.deckId ?? prefill?.deckId ?? lastDeckMemory ?? decks.find((d) => !d.archived)?.id;
  const [deckId, setDeckId] = useState<ID | undefined>(defaultDeck);
  const [front, setFront] = useState(card?.front ?? prefill?.front ?? "");
  const [back, setBack] = useState(card?.back ?? prefill?.back ?? "");
  const [example, setExample] = useState(card?.example ?? prefill?.example ?? "");
  const [note, setNote] = useState(card?.note ?? "");
  const [tags, setTags] = useState((card?.tags ?? prefill?.tags ?? []).join(", "));
  const [more, setMore] = useState(!!(card?.example || card?.note || prefill?.example));
  const [rows, setRows] = useState(() => (batch ?? []).map((b) => ({ ...b, on: true })));
  const [count, setCount] = useState(0);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const source: CardSource | undefined = card?.source ?? prefill?.source;
  const isBatch = !card && rows.length > 0;
  const canSave = !!deckId && (isBatch ? rows.some((r) => r.on && r.front.trim() && r.back.trim()) : front.trim() && back.trim());

  const deck = decks.find((d) => d.id === deckId);
  const strength = useMemo(() => (card ? memoryStrength(card.memory) : 0), [card]);

  const save = (again = false) => {
    if (!canSave || !deckId) return;
    lastDeckMemory = deckId;
    if (isBatch) {
      const made = addCards(rows.filter((r) => r.on && r.front.trim() && r.back.trim()).map((r) => ({ deckId, front: r.front, back: r.back, source, tags: parseTags(tags) })));
      toast.success(`${pluralize(made.length, "card")} added to ${deck?.name}`, { description: "They'll appear as new cards in your next review." });
      close();
      return;
    }
    const payload = { deckId, front, back, example: example.trim() || undefined, note: note.trim() || undefined, tags: parseTags(tags) };
    if (card) {
      updateCard(card.id, payload);
      toast.success("Card updated");
      close();
    } else {
      addCards([{ ...payload, source }]);
      setCount((n) => n + 1);
      if (again) {
        setFront("");
        setBack("");
        setExample("");
        setNote("");
        frontRef.current?.focus();
        toast.success("Card added", { description: `${front.trim().slice(0, 60)} → ${deck?.name}` });
      } else {
        toast.success("Card added", { description: `${deck?.name} · first review today` });
        close();
      }
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save(e.shiftKey);
    }
  };

  const title = card ? "Edit card" : isBatch ? `Create ${rows.filter((r) => r.on).length} cards` : "New learning card";

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      description={isBatch ? "Review the extracted cards, then add them in one go." : card ? undefined : "Capture it now — the scheduler decides when you'll see it again."}
      size={isBatch ? "lg" : "md"}
      footer={
        <>
          {card && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" className="mr-auto">
                  More
                </Button>
              </MenuTrigger>
              <MenuContent side="top">
                <MenuItem onSelect={() => toggleSuspend(card)}>
                  {card.suspended ? <Play /> : <Pause />} {card.suspended ? "Resume reviews" : "Pause reviews"}
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    useApp.getState().resetCard(card.id);
                    toast("Progress reset — card is new again");
                  }}
                >
                  <RotateCcw /> Reset progress
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  danger
                  onSelect={() => {
                    close();
                    deleteCardsWithUndo([card.id]);
                  }}
                >
                  <Trash2 /> Delete card
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
          {!card && !isBatch && count > 0 && <span className="mr-auto self-center text-[12px] text-fg-3 max-md:hidden">{pluralize(count, "card")} added</span>}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {!card && !isBatch && (
            <Button onClick={() => save(true)} disabled={!canSave} className="max-md:hidden">
              Save & add another
            </Button>
          )}
          <Button variant="primary" onClick={() => save(false)} disabled={!canSave}>
            {card ? "Save" : isBatch ? `Add ${rows.filter((r) => r.on).length} cards` : "Add card"}
            <Kbd className="border-white/20 bg-white/15 text-accent-fg/80 shadow-none max-md:hidden">⌘↵</Kbd>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" onKeyDown={onKey}>
        <div className="flex flex-wrap items-center gap-2">
          <DeckPicker value={deckId} onChange={setDeckId} />
          {source && source.kind !== "manual" && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-surface-2 px-2 text-[12px] text-fg-3">
              <Link2 className="size-3.5" /> From {source.kind}
              {source.label && <b className="max-w-[180px] truncate font-medium text-fg-2">{source.label}</b>}
            </span>
          )}
          {card && (
            <span className="ml-auto text-[12px] text-fg-3">
              {card.memory.state === "new" ? "New · not yet reviewed" : `${Math.round(strength * 100)}% strength · ${difficultyLabel(card.memory.difficulty)} · ${card.memory.reps} reviews`}
            </span>
          )}
        </div>

        {isBatch ? (
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i} className={cn("grid grid-cols-[auto_1fr_1fr_auto] items-start gap-2 rounded-[10px] p-2 transition-opacity", r.on ? "bg-surface-2" : "opacity-45")}>
                <input
                  type="checkbox"
                  checked={r.on}
                  onChange={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                  aria-label={`Include card ${i + 1}`}
                  className="mt-2.5 size-4 accent-[var(--accent)]"
                />
                <textarea value={r.front} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))} rows={1} aria-label="Front" className={cn(field, "font-medium")} />
                <textarea value={r.back} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))} rows={1} aria-label="Back" className={field} />
                <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove" className="mt-2 grid size-6 place-items-center rounded text-fg-4 hover:text-danger-text">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-fg-2">Front · word, concept or question</span>
              <textarea ref={frontRef} autoFocus value={front} onChange={(e) => setFront(e.target.value)} rows={1} maxLength={1000} placeholder="e.g. What is an embedding?" className={cn(field, "text-[16px] font-medium")} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-fg-2">Back · answer or explanation</span>
              <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} maxLength={5000} placeholder="Explain it the way you'd want to remember it." className={cn(field, "min-h-[84px]")} />
            </label>
            {more ? (
              <>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-fg-2">Example <span className="font-normal text-fg-4">· optional</span></span>
                  <textarea value={example} onChange={(e) => setExample(e.target.value)} rows={1} maxLength={2000} placeholder="A sentence, snippet or case that makes it concrete" className={cn(field, "italic")} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-fg-2">Note <span className="font-normal text-fg-4">· optional, shown after reveal</span></span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} maxLength={2000} placeholder="Mnemonic, source, gotcha…" className={field} />
                </label>
              </>
            ) : (
              <button onClick={() => setMore(true)} className="-mt-1 self-start text-[12.5px] font-medium text-accent-text hover:underline">
                + Add example or note
              </button>
            )}
          </>
        )}
        <label className="grid gap-1.5">
          <span className="text-[12px] font-medium text-fg-2">Tags</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated, e.g. nlp, interview" className={cn(field, "h-9 py-0")} />
        </label>
        {card && card.memory.state !== "new" && (
          <p className="text-[12px] text-fg-4">Next review in {formatInterval(Math.max(0, new Date(card.memory.due).getTime() - now))}. Editing the text keeps its schedule.</p>
        )}
      </div>
    </Modal>
  );
}
