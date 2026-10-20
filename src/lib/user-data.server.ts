import { prisma } from "./db";
import { Prisma } from "@/generated/prisma/client";
import type { DrillAttempt, Solve } from "./solves";
import { DRILL_KEY, TIMER_KEY, cleanDrillAttempt, cleanList, cleanSolve, isDataKey, type SyncOps } from "./user-data";

/** A JSON value bigger than this is refused. Progress for every case is well under it. */
const MAX_DOC_BYTES = 512 * 1024;

export type LoadedData = { onboarded: boolean; data: Record<string, unknown> };

/** Everything an account has, keyed the way the stores keep it in localStorage. */
export async function loadUserData(userId: string): Promise<LoadedData> {
  const [user, docs, solves, drill] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { onboarded: true } }),
    prisma.userDoc.findMany({ where: { userId } }),
    prisma.solve.findMany({ where: { userId }, orderBy: { at: "asc" } }),
    prisma.drillAttempt.findMany({ where: { userId }, orderBy: { at: "asc" } }),
  ]);
  const data: Record<string, unknown> = {};
  for (const d of docs) data[d.key] = d.value;
  if (data[TIMER_KEY] || solves.length) {
    data[TIMER_KEY] = {
      ...(data[TIMER_KEY] as object | undefined),
      solves: solves.map(
        (s): Solve => ({
          id: s.id,
          ms: s.ms,
          penalty: s.penalty as Solve["penalty"],
          scramble: s.scramble,
          at: Number(s.at),
          session: s.session,
          ...(s.inspectionMs !== null && { inspectionMs: s.inspectionMs }),
          ...(s.oll && { oll: s.oll }),
          ...(s.pll && { pll: s.pll }),
        }),
      ),
    };
  }
  if (drill.length) {
    data[DRILL_KEY] = drill.map(
      (a): DrillAttempt => ({ id: a.caseId, ok: a.ok, ms: a.ms, revealed: a.revealed, at: Number(a.at), ...(a.hinted !== null && { hinted: a.hinted }) }),
    );
  }
  return { onboarded: user?.onboarded ?? false, data };
}

const solveRow = (userId: string, s: Solve) => ({ ...s, userId, at: BigInt(s.at), inspectionMs: s.inspectionMs ?? null, oll: s.oll ?? null, pll: s.pll ?? null });
const drillRow = (userId: string, a: DrillAttempt) => ({ userId, caseId: a.id, ok: a.ok, ms: a.ms, revealed: a.revealed, hinted: a.hinted ?? null, at: BigInt(a.at) });

function docEntries(docs: Record<string, unknown>): [string, Prisma.InputJsonValue][] {
  const entries: [string, Prisma.InputJsonValue][] = [];
  for (const [key, value] of Object.entries(docs)) {
    if (!isDataKey(key) || key === DRILL_KEY || value === undefined || value === null) continue;
    // Solves are rows of their own; the timer document keeps the rest.
    const doc = key === TIMER_KEY ? { sessions: (value as { sessions?: unknown }).sessions ?? [], current: (value as { current?: unknown }).current ?? "main" } : value;
    if (JSON.stringify(doc).length > MAX_DOC_BYTES) throw new BadData(`${key} is too large`);
    entries.push([key, doc as Prisma.InputJsonValue]);
  }
  return entries;
}

export class BadData extends Error {}

/** Apply what changed since the last sync. Safe to repeat. */
export async function applySync(userId: string, ops: SyncOps) {
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  for (const [key, value] of docEntries(ops.docs ?? {})) {
    writes.push(prisma.userDoc.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, value }, update: { value } }));
  }
  if (ops.solves) {
    const upsert = cleanList(ops.solves.upsert, cleanSolve);
    const remove = (Array.isArray(ops.solves.remove) ? ops.solves.remove : []).filter((id): id is string => typeof id === "string");
    const ids = [...remove, ...upsert.map((s) => s.id)];
    // Replace changed solves rather than upsert one by one: two queries however many there are.
    if (ids.length) writes.push(prisma.solve.deleteMany({ where: { userId, id: { in: ids } } }));
    if (upsert.length) writes.push(prisma.solve.createMany({ data: upsert.map((s) => solveRow(userId, s)), skipDuplicates: true }));
  }
  if (ops.drill) {
    if (ops.drill.clear) writes.push(prisma.drillAttempt.deleteMany({ where: { userId } }));
    const append = cleanList(ops.drill.append, cleanDrillAttempt);
    if (append.length) writes.push(prisma.drillAttempt.createMany({ data: append.map((a) => drillRow(userId, a)), skipDuplicates: true }));
  }
  if (writes.length) await prisma.$transaction(writes);
}

/** Swap everything the account has for `data` (a backup's), and mark it onboarded. */
export async function replaceUserData(userId: string, data: Record<string, unknown>) {
  const timer = data[TIMER_KEY] as { solves?: unknown } | undefined;
  const solves = cleanList(timer?.solves, cleanSolve);
  const drill = cleanList(data[DRILL_KEY], cleanDrillAttempt);
  const docs = docEntries(data);
  await prisma.$transaction([
    prisma.userDoc.deleteMany({ where: { userId } }),
    prisma.solve.deleteMany({ where: { userId } }),
    prisma.drillAttempt.deleteMany({ where: { userId } }),
    prisma.userDoc.createMany({ data: docs.map(([key, value]) => ({ userId, key, value })) }),
    prisma.solve.createMany({ data: solves.map((s) => solveRow(userId, s)), skipDuplicates: true }),
    prisma.drillAttempt.createMany({ data: drill.map((a) => drillRow(userId, a)), skipDuplicates: true }),
    prisma.user.update({ where: { id: userId }, data: { onboarded: true } }),
  ]);
}
