"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useUI } from "@/data/ui-store";
import { useApp } from "@/data/store";
import { Modal, Confirm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { TonePicker } from "@/components/tasks/pickers";
import { toneVar } from "@/components/ui/misc";
import { DECK_ICONS } from "./deck-icon";
import { deleteDeckWithUndo } from "@/features/learning/learning-actions";
import type { Tone } from "@/domain/types";
import { cn } from "@/lib/utils";

export function DeckEditor() {
  const st = useUI((s) => s.deckEditor);
  const [session, setSession] = useState(0);
  const [was, setWas] = useState(st.open);
  if (st.open !== was) {
    setWas(st.open);
    if (st.open) setSession((n) => n + 1);
  }
  return <DeckEditorBody key={session} />;
}

function DeckEditorBody() {
  const { open, deckId } = useUI((s) => s.deckEditor);
  const close = useUI((s) => s.closeDeckEditor);
  const deck = useApp((s) => (deckId ? s.decks.find((d) => d.id === deckId) : undefined));
  const cardCount = useApp((s) => (deckId ? s.cards.filter((c) => c.deckId === deckId).length : 0));
  const [name, setName] = useState(deck?.name ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [icon, setIcon] = useState(deck?.icon ?? "layers");
  const [tone, setTone] = useState<Tone>(deck?.tone ?? "iris");
  const [newPerDay, setNewPerDay] = useState(deck?.newPerDay ?? 10);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    const n = name.trim();
    if (!n) return setError("Give the deck a name");
    const payload = { name: n.slice(0, 60), description: description.trim() || undefined, icon, tone, newPerDay };
    if (deck) {
      useApp.getState().updateDeck(deck.id, payload);
      toast.success("Deck updated");
    } else {
      const d = useApp.getState().addDeck(payload);
      const cc = useUI.getState().cardComposer;
      if (cc.open) useUI.setState({ cardComposer: { ...cc, prefill: { ...cc.prefill, deckId: d.id } } });
      toast.success(`Deck "${d.name}" created`, { description: "Add cards from here, Notes, Tasks or ⌘K." });
    }
    close();
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && close()}
        title={deck ? "Edit deck" : "New deck"}
        description={deck ? undefined : "A deck groups cards on one subject — vocabulary, a course, an interview topic."}
        footer={
          <>
            {deck && (
              <Button variant="danger-ghost" className="mr-auto" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {deck ? "Save" : "Create deck"}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Name" error={error}>
            <Input autoFocus value={name} onChange={(e) => (setName(e.target.value), setError(""))} placeholder="e.g. Data Engineering" aria-invalid={!!error} maxLength={60} />
          </Field>
          <Field label="Description" hint="Optional">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's in this deck?" maxLength={140} />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">Icon</span>
            <div role="radiogroup" aria-label="Icon" className="grid grid-cols-9 gap-1">
              {Object.entries(DECK_ICONS).map(([k, { icon: I, label }]) => (
                <button
                  type="button"
                  key={k}
                  role="radio"
                  aria-checked={icon === k}
                  aria-label={label}
                  title={label}
                  onClick={() => setIcon(k)}
                  style={toneVar(tone)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-[8px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-4",
                    icon === k ? "tone-soft tone-text shadow-[inset_0_0_0_1.5px_var(--tone)]" : "text-fg-3 hover:bg-hover hover:text-fg-2",
                  )}
                >
                  <I />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">Colour</span>
            <TonePicker value={tone} onChange={setTone} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">New cards per day</div>
              <div className="text-[12px] text-fg-3">How many unseen cards to introduce daily</div>
            </div>
            <div className="flex items-center rounded-[9px] bg-surface-2 p-0.5">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Fewer" onClick={() => setNewPerDay((n) => Math.max(0, n - 5))}>
                <Minus />
              </Button>
              <span className="w-9 text-center font-mono text-[14px] tabular">{newPerDay}</span>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="More" onClick={() => setNewPerDay((n) => Math.min(100, n + 5))}>
                <Plus />
              </Button>
            </div>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>
      {deck && (
        <Confirm
          open={confirm}
          onOpenChange={setConfirm}
          title={`Delete "${deck.name}"?`}
          description={`This deletes ${cardCount} cards and their review history. You can undo right after.`}
          onConfirm={() => {
            close();
            deleteDeckWithUndo(deck);
          }}
        />
      )}
    </>
  );
}
