import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Snapshot } from "@/domain/types";

/**
 * Server-side persistence. A JSON-file store keeps the demo self-contained;
 * replace with a database client implementing the same two functions.
 */
const DIR = path.join(process.cwd(), ".data");
const memory = new Map<string, Snapshot>();
const safe = (id: string) => id.replace(/[^a-z0-9_-]/gi, "").slice(0, 64);

export async function readSnapshot(userId: string): Promise<Snapshot | null> {
  const id = safe(userId);
  if (memory.has(id)) return memory.get(id)!;
  try {
    const raw = await fs.readFile(path.join(DIR, `${id}.json`), "utf8");
    const snap = JSON.parse(raw) as Snapshot;
    memory.set(id, snap);
    return snap;
  } catch {
    return null;
  }
}

export async function writeSnapshot(userId: string, snap: Snapshot): Promise<void> {
  const id = safe(userId);
  memory.set(id, snap);
  try {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = path.join(DIR, `${id}.json.tmp`);
    await fs.writeFile(tmp, JSON.stringify(snap));
    await fs.rename(tmp, path.join(DIR, `${id}.json`));
  } catch {
    /* read-only FS (serverless): memory copy still serves this instance */
  }
}
