import { and, asc, isNull, lte, or, lt, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.ts";
import { jobs } from "../db/schema.ts";

/**
 * Kleine, robuste Job-Warteschlange in der Datenbank – ohne Redis, ohne
 * Worker-Prozess. Jobs werden vom Tick (GitHub Actions alle 15 Minuten
 * bzw. lazy aus dem Cockpit) abgearbeitet. Jeder Job trägt einen
 * dedupeKey: Doppelte Einreihung ist ein No-op, ein Job läuft höchstens
 * einmal gleichzeitig (Sperre locked_at), Fehler werden mit steigenden
 * Abständen wiederholt und nach MAX_ATTEMPTS aufgegeben.
 */
export type JobKind =
  | "mail.confirmation"
  | "mail.rescheduled"
  | "mail.cancellation"
  | "mail.reminder"
  | "mail.waitlist_offer"
  | "mail.waitlist_joined"
  | "waitlist.offer_next";

export type JobPayload = Record<string, unknown>;
export type JobHandler = (payload: JobPayload, ctx: { now: Date }) => Promise<void>;

const handlers = new Map<JobKind, JobHandler>();
export const MAX_ATTEMPTS = 8;
const LOCK_TTL_MS = 5 * 60_000;

export function registerHandler(kind: JobKind, fn: JobHandler) {
  handlers.set(kind, fn);
}

export async function enqueue(input: { kind: JobKind; payload?: JobPayload; runAt?: Date; dedupeKey: string }): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .insert(jobs)
    .values({ kind: input.kind, payload: input.payload ?? {}, runAt: input.runAt ?? new Date(), dedupeKey: input.dedupeKey })
    .onConflictDoNothing({ target: jobs.dedupeKey })
    .returning({ id: jobs.id });
  return rows.length > 0;
}

function backoffMs(attempt: number): number {
  // 1 min, 2, 4, 8 … bis 4 h
  return Math.min(4 * 3600_000, 60_000 * 2 ** Math.max(0, attempt - 1));
}

export interface RunReport {
  claimed: number;
  done: number;
  failed: number;
  errors: Array<{ id: string; kind: string; error: string }>;
}

export async function runDue(opts: { now?: Date; limit?: number } = {}): Promise<RunReport> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;
  const db = await getDb();
  const report: RunReport = { claimed: 0, done: 0, failed: 0, errors: [] };

  const due = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(isNull(jobs.doneAt), lte(jobs.runAt, now), or(isNull(jobs.lockedAt), lt(jobs.lockedAt, new Date(now.getTime() - LOCK_TTL_MS)))))
    .orderBy(asc(jobs.runAt))
    .limit(limit);

  for (const { id } of due) {
    // Sperre atomar setzen – nur wer sie bekommt, arbeitet
    const claimed = await db
      .update(jobs)
      .set({ lockedAt: now })
      .where(and(eq(jobs.id, id), isNull(jobs.doneAt), or(isNull(jobs.lockedAt), lt(jobs.lockedAt, new Date(now.getTime() - LOCK_TTL_MS)))))
      .returning();
    const job = claimed[0];
    if (!job) continue;
    report.claimed++;
    const handler = handlers.get(job.kind as JobKind);
    try {
      if (!handler) throw new Error(`Kein Handler für ${job.kind}`);
      await handler(job.payload, { now });
      await db.update(jobs).set({ doneAt: new Date(), lockedAt: null, lastError: null }).where(eq(jobs.id, id));
      report.done++;
    } catch (e) {
      const attempts = job.attempts + 1;
      const message = e instanceof Error ? e.message.slice(0, 500) : String(e);
      report.failed++;
      report.errors.push({ id, kind: job.kind, error: message });
      if (attempts >= MAX_ATTEMPTS) {
        await db.update(jobs).set({ attempts, lastError: `aufgegeben: ${message}`, doneAt: new Date(), lockedAt: null }).where(eq(jobs.id, id));
      } else {
        await db
          .update(jobs)
          .set({ attempts, lastError: message, lockedAt: null, runAt: new Date(now.getTime() + backoffMs(attempts)) })
          .where(eq(jobs.id, id));
      }
    }
  }
  return report;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(jobs).where(isNull(jobs.doneAt));
  return Number(row?.n ?? 0);
}
