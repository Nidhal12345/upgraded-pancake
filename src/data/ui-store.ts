"use client";
import { create } from "zustand";
import type { CardSource, DayKey, ID, Task } from "@/domain/types";

export interface EditorTarget {
  taskId: ID;
  /** Present when editing a single occurrence of a recurring series. */
  originalDate?: DayKey;
}

interface UIState {
  commandOpen: boolean;
  quickAdd: { open: boolean; defaults?: Partial<Task> };
  editor: EditorTarget | null;
  habitEditor: { open: boolean; habitId?: ID };
  shortcutsOpen: boolean;
  /** Card composer: create (with optional prefill / batch) or edit an existing card. */
  cardComposer: {
    open: boolean;
    cardId?: ID;
    prefill?: { front?: string; back?: string; example?: string; deckId?: ID; tags?: string[]; source?: CardSource };
    batch?: { front: string; back: string }[];
  };
  deckEditor: { open: boolean; deckId?: ID };
  openCardComposer(opts?: Omit<UIState["cardComposer"], "open">): void;
  closeCardComposer(): void;
  openDeckEditor(deckId?: ID): void;
  closeDeckEditor(): void;
  setCommandOpen(o: boolean): void;
  openQuickAdd(defaults?: Partial<Task>): void;
  closeQuickAdd(): void;
  openEditor(t: EditorTarget): void;
  closeEditor(): void;
  openHabitEditor(habitId?: ID): void;
  closeHabitEditor(): void;
  setShortcutsOpen(o: boolean): void;
}

export const useUI = create<UIState>()((set) => ({
  commandOpen: false,
  quickAdd: { open: false },
  editor: null,
  habitEditor: { open: false },
  shortcutsOpen: false,
  cardComposer: { open: false },
  deckEditor: { open: false },
  openCardComposer: (opts) => set({ cardComposer: { open: true, ...opts }, commandOpen: false }),
  closeCardComposer: () => set((s) => ({ cardComposer: { ...s.cardComposer, open: false } })),
  openDeckEditor: (deckId) => set({ deckEditor: { open: true, deckId }, commandOpen: false }),
  closeDeckEditor: () => set((s) => ({ deckEditor: { ...s.deckEditor, open: false } })),
  setCommandOpen: (o) => set({ commandOpen: o }),
  openQuickAdd: (defaults) => set({ quickAdd: { open: true, defaults }, commandOpen: false }),
  closeQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false } })),
  openEditor: (t) => set({ editor: t, commandOpen: false }),
  closeEditor: () => set({ editor: null }),
  openHabitEditor: (habitId) => set({ habitEditor: { open: true, habitId }, commandOpen: false }),
  closeHabitEditor: () => set((s) => ({ habitEditor: { ...s.habitEditor, open: false } })),
  setShortcutsOpen: (o) => set({ shortcutsOpen: o }),
}));
