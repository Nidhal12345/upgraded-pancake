import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readSnapshot, writeSnapshot } from "@/server/snapshot-store";
import type { Snapshot } from "@/domain/types";

export const dynamic = "force-dynamic";

const SnapshotSchema = z.object({
  version: z.literal(1),
  rev: z.number().int().nonnegative(),
  updatedAt: z.string(),
  tasks: z.array(z.object({ id: z.string(), title: z.string().max(2000) }).passthrough()).max(20000),
  habits: z.array(z.object({ id: z.string(), name: z.string().max(500) }).passthrough()).max(2000),
  notes: z.array(z.object({ id: z.string(), body: z.string().max(500_000) }).passthrough()).max(10000),
  sessions: z.array(z.object({ id: z.string() }).passthrough()).max(100000),
  decks: z.array(z.object({ id: z.string(), name: z.string().max(200) }).passthrough()).max(500).optional(),
  cards: z.array(z.object({ id: z.string(), front: z.string().max(5000), back: z.string().max(20000) }).passthrough()).max(50000).optional(),
  reviews: z.array(z.object({ id: z.string() }).passthrough()).max(500000).optional(),
  settings: z.record(z.string(), z.unknown()),
  tombstones: z.record(z.string(), z.string()),
});

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await params;
  const snap = await readSnapshot(userId);
  if (!snap) return new NextResponse(null, { status: 204 });
  return NextResponse.json(snap, { headers: { "cache-control": "no-store" } });
}

async function write(req: NextRequest, userId: string, baseRev: number) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = SnapshotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_snapshot", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });

  const current = await readSnapshot(userId);
  if (current && current.rev !== baseRev) return NextResponse.json(current, { status: 409 });

  const next = { ...(parsed.data as unknown as Snapshot), rev: (current?.rev ?? 0) + 1 };
  await writeSnapshot(userId, next);
  return NextResponse.json({ rev: next.rev });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await params;
  return write(req, userId, Number(req.headers.get("x-base-rev") ?? -1));
}

/** sendBeacon flush on tab hide. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await params;
  return write(req, userId, Number(req.nextUrl.searchParams.get("rev") ?? -1));
}
