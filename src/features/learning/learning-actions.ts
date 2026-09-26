"use client";
import { toast } from "sonner";
import { useApp } from "@/data/store";
import type { Deck, Flashcard } from "@/domain/types";
import { pluralize } from "@/lib/utils";

const app = () => useApp.getState();

export function deleteCardsWithUndo(ids: string[]) {
  const removed = app().deleteCards(ids);
  if (!removed.length) return;
  toast(removed.length === 1 ? "Card deleted" : `${pluralize(removed.length, "card")} deleted`, {
    description: removed.length === 1 ? removed[0].front : undefined,
    action: { label: "Undo", onClick: () => app().restoreCards(removed) },
  });
}

export function deleteDeckWithUndo(deck: Deck) {
  const res = app().deleteDeck(deck.id);
  if (!res) return;
  toast(`"${deck.name}" deleted`, {
    description: pluralize(res.cards.length, "card") + " removed",
    action: { label: "Undo", onClick: () => app().restoreDeck(res) },
  });
}

export function toggleSuspend(card: Flashcard) {
  app().updateCard(card.id, { suspended: !card.suspended });
  toast(card.suspended ? "Card resumed" : "Card paused", { description: card.front });
}
