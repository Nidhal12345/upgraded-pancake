import type { Snapshot } from "@/domain/types";

type WithId = { id: string };
const stamp = (e: unknown): string => {
  const o = e as { updatedAt?: string; endedAt?: string; createdAt?: string };
  const x = e as { at?: string };
  return o.updatedAt ?? o.endedAt ?? x.at ?? o.createdAt ?? "";
};

function mergeList<T extends WithId>(a: T[], b: T[], tomb: Record<string, string>): T[] {
  const map = new Map<string, T>();
  for (const e of [...a, ...b]) {
    const prev = map.get(e.id);
    if (!prev || stamp(e) > stamp(prev)) map.set(e.id, e);
  }
  return [...map.values()].filter((e) => !tomb[e.id] || stamp(e) > tomb[e.id]);
}

/** Entity-level last-writer-wins merge with tombstones. */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const tombstones = { ...remote.tombstones, ...local.tombstones };
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  for (const [id, t] of Object.entries(tombstones)) if (t < cutoff) delete tombstones[id];
  return {
    version: 1,
    rev: remote.rev,
    updatedAt: new Date().toISOString(),
    tasks: mergeList(local.tasks, remote.tasks, tombstones),
    habits: mergeList(local.habits, remote.habits, tombstones),
    notes: mergeList(local.notes, remote.notes, tombstones),
    sessions: mergeList(local.sessions, remote.sessions, tombstones),
    decks: mergeList(local.decks ?? [], remote.decks ?? [], tombstones),
    cards: mergeList(local.cards ?? [], remote.cards ?? [], tombstones),
    reviews: mergeList(local.reviews ?? [], remote.reviews ?? [], tombstones),
    settings: local.updatedAt > remote.updatedAt ? local.settings : remote.settings,
    tombstones,
  };
}
