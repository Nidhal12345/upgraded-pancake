# Meridian

A calm, keyboard-first planner for days, habits, notes, and focus.

Meridian brings the daily overview, a drag-and-drop week planner, a calendar, habit tracking, task management, a Markdown notebook, a Pomodoro timer, and progress stats together in one product with one design system.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 with CSS-variable design tokens (light + dark) |
| Primitives | Radix UI (dialog, popover, dropdown/context menu, tooltip) |
| Command menu | cmdk |
| Drag and drop | @dnd-kit/core (move); pointer capture (resize, drag-to-create) |
| Dates & recurrence | date-fns + custom recurrence engine |
| State | Zustand (domain store, UI store, device-persisted prefs) |
| Forms | React Hook Form + Zod |
| Notes | Markdown source editor + react-markdown / remark-gfm preview |
| Charts | Recharts |
| Motion | motion (Framer Motion) — used sparingly |
| Toasts / sheets | Sonner / Vaul |

## Running

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Architecture

```
src/
  app/                      Routes (server components) — thin shells around feature views
    (app)/layout.tsx        Resolves the account server-side (cookie) → <AppShell>
    api/sync/[userId]/      Cloud sync endpoint (GET / PUT with revision check / POST beacon)
  domain/                   Pure business logic — no React, fully unit-testable
    types.ts                Serializable domain model (Task, Habit, Note, Snapshot…)
    recurrence.ts           Series expansion, per-occurrence overrides, descriptions
    habits.ts               Scheduling, streaks (day + week based), success rate, milestones
    progress.ts             Daily summaries, XP (≤10/day), levels, consistency, encouragement
    parse.ts                Natural-language quick-add parser
  data/
    store.ts                Zustand domain store + sync engine (optimistic, debounced push)
    sync/adapter.ts         LocalCache + RemoteStore interfaces (swap for a real backend)
    sync/merge.ts           Entity-level last-writer-wins merge with tombstones
    seed.ts                 Deterministic, per-account sample data
    ui-store.ts             Global UI state (command menu, editors)
  server/snapshot-store.ts  Server persistence (JSON file → replace with a DB)
  components/
    ui/                     Design-system primitives (Button, Modal/Sheet, Menu, Segmented…)
    shell/                  Sidebar, mobile tab bar, ⌘K, shortcuts, sync status, reminders
    tasks/ habits/          Shared task/habit components (row, pickers, editors, check tiles)
  features/<view>/          One folder per view: today, week, calendar, habits, tasks, notes, focus, stats
```

### Data and sync

- Every mutation goes through `commit()` in `data/store.ts`. It updates state optimistically, writes the snapshot to an **account-scoped** localStorage key (`meridian:v1:<accountId>`), and schedules a debounced push.
- A push sends the snapshot with `x-base-rev`. If the server's revision has moved on, it returns **409** with its copy. The client then merges entity by entity (last writer wins by `updatedAt`, with tombstones so deletes aren't undone) and retries.
- The app refreshes in the background when the window regains focus, when the network comes back, and every 60 s while visible. Pending writes are flushed with `sendBeacon` when the tab is hidden.
- Switching accounts re-hydrates from that account's own device cache, then reconciles with its cloud copy.
- To connect a real backend, implement `RemoteStore` (or replace `server/snapshot-store.ts`). Nothing else changes.

### Recurrence model

A recurring task is one `Task` with a `recurrence` rule (daily, weekdays, weekly, monthly, or custom days with an interval, plus an optional end date). Each concrete occurrence is identified by its **original date**. Changes to a single occurrence live in `task.overrides[originalDate]`:

- `status`: completion is tracked per occurrence
- `skipped`: hidden, not counted as a failure
- `date` / `start` / `duration` / `title`: move or edit only this occurrence

`expandOccurrences(tasks, from, to)` also picks up occurrences that were moved *into* the window from outside it.

## Interaction model

| Action | Keyboard | Pointer / touch |
| --- | --- | --- |
| Command menu & search | ⌘K or / | Sidebar "Search" |
| New task (natural language) | Q | "New task", or drag across empty planner slots |
| Navigate views | G then T/W/C/K/H/N/F/S | Sidebar / mobile tab bar |
| Planner: previous / next, today, views | ← → · T · 1 / 3 / 7 · L | Toolbar |
| Complete a focused task | Space | Round check |
| Reschedule | — | Drag a block; drag its bottom edge to resize; on touch: tap → Move → tap a slot |
| Task actions | — | Right-click (context menu) |
| Bulk edit (Tasks) | ⌘A, ⌘/Shift-click | Row checkboxes |
| Notes: save, format, switch mode | ⌘S · ⌘B / ⌘I / ⌘⇧X / ⌘K · ⌘E | Toolbar |
| Focus timer | Space · R · S | Controls |
| All shortcuts | ? | Account menu |

Destructive and scheduling actions show a toast with **Undo**.

## Design system

- **Palette:** warm paper neutrals, a single persimmon accent, moss for "done", and eight label tones defined in OKLCH so light and dark themes stay consistent.
- **Type:** Geist for UI, Geist Mono for all numbers (tabular figures), and Instrument Serif for page titles and editorial moments.
- **Surfaces:** hairline borders, low-contrast layered shadows, 8–16 px radii.
- **Motion:** 150–220 ms ease-out enter animations, a spring on segmented controls, a pop on completion, and confetti only when a full Pomodoro cycle is finished. Reduced-motion preferences are respected.

## Notes on scope

- Accounts are demo accounts switched with a cookie. Real authentication should replace `data/accounts.ts` and `(app)/layout.tsx`; everything downstream is already keyed by `accountId`.
- Reminders are shown in-app, and the Pomodoro timer can raise system notifications. Push notifications would need a service worker.

## Colour system — "Linen" (light) / "Night study" (dark)

All colour lives in semantic OKLCH tokens in `src/app/globals.css`; components never use raw colours.

- **Surfaces**: `bg` (warm linen canvas), `sidebar`, `surface`, `surface-2/3`, `elevated`, `input`, `paper` (notes editor). Each tier differs by a small, deliberate step in lightness and chroma, so nothing is pure white.
- **Text**: `fg`, `fg-2..4`, `fg-disabled`. **Lines**: `line`, `line-2`, `line-3`.
- **Brand accent**: indigo-violet `accent` (+ `hover`, `soft`, `softer`, `line`, `text`, `fg`), with a warm amber `accent-2`. It is used only for primary actions, active nav, selection, progress, focus and learning feedback.
- **States**: `ok`, `info`, `warn`, `danger` (each with `-soft` and `-text`), plus `hover`, `pressed`, `selected` and `ring`.
- **Gradients**: `grad-canvas`, `grad-surface`, `grad-hero`, `grad-accent`, `grad-sidebar`. All are low-contrast and there is no glassmorphism.
- Dark mode is a separately tuned blue-slate palette with lifted accent lightness; it is not an inversion of light.

## Learning (spaced repetition)

`/learn` has three tabs: Overview, Cards and Insights.

- **Decks** have an icon, a tone and a new-cards-per-day limit. **Cards** have a front, a back, an optional example, an optional note and tags.
- **Scheduler**: FSRS-5 (`src/domain/srs.ts`). It tracks stability, difficulty and retrievability, and schedules each card for when predicted recall drops to 90%. Learning steps are 1m/10m and the relearning step is 10m. A card counts as "learned" once its stability reaches 21 days.
- **Queue** (`src/domain/learning.ts`): due cards come first, weakest first, interleaved 3:1 with new cards. "Practise weakest" is a cram mode that doesn't wait for due dates.
- **Review session**: Space reveals the answer; 1–4 rates it (Didn't know / Hard / Good / Easy, each showing its next interval); U or ⌘Z undoes; E edits. Missed cards come back a few cards later. The end-of-session summary shows reviewed, accuracy, learned, needing review, goal, streak and a 14-day forecast.
- **Capture**: from Notes (toolbar "Make card", "Make card from selection" in read mode, or "Extract learning cards" for `Term :: def`, `Term — def`, `**Term**: def` and Q:/A:), from Tasks ("Turn into learning card"), and from ⌘K. The Today view has a learning card, Stats counts reviews, and reviews contribute 1 of the 10 daily XP.
