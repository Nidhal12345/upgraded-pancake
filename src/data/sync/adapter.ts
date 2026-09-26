import type { Snapshot } from "@/domain/types";

/**
 * Storage boundary. The app only ever talks to these interfaces, so swapping
 * the JSON route handler for Postgres / Supabase / a REST API is local to
 * this folder.
 */
export interface LocalCache {
  read(userId: string): Snapshot | null;
  write(userId: string, snap: Snapshot): void;
}

export type PushResult =
  | { ok: true; rev: number }
  | { ok: false; conflict: Snapshot };

export interface RemoteStore {
  pull(userId: string, signal?: AbortSignal): Promise<Snapshot | null>;
  push(userId: string, snap: Snapshot, baseRev: number): Promise<PushResult>;
}

export const localCache: LocalCache = {
  read(userId) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`meridian:v1:${userId}`);
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  },
  write(userId, snap) {
    try {
      window.localStorage.setItem(`meridian:v1:${userId}`, JSON.stringify(snap));
    } catch {
      /* quota — remote remains source of truth */
    }
  },
};

export const httpRemote: RemoteStore = {
  async pull(userId, signal) {
    const res = await fetch(`/api/sync/${encodeURIComponent(userId)}`, { signal, cache: "no-store" });
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`Sync pull failed (${res.status})`);
    return (await res.json()) as Snapshot;
  },
  async push(userId, snap, baseRev) {
    const res = await fetch(`/api/sync/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-base-rev": String(baseRev) },
      body: JSON.stringify(snap),
    });
    if (res.status === 409) return { ok: false, conflict: (await res.json()) as Snapshot };
    if (!res.ok) throw new Error(`Sync push failed (${res.status})`);
    const body = (await res.json()) as { rev: number };
    return { ok: true, rev: body.rev };
  },
};
