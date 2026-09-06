import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDb } from "./db/client.ts";
import { rateLimits } from "./db/schema.ts";
import { dateKey } from "./time.ts";

/**
 * Rate-Limit in der Datenbank (funktioniert auf Serverless ohne Redis).
 * Schlüssel: HMAC(INDEX_KEY, Tagesdatum) über die IP – der Klartext der IP
 * wird nie gespeichert, und mit dem Tageswechsel ist der Schlüssel wertlos.
 * Festes Fenster: Zähler pro (Bereich, Schlüssel), Fenster startet beim
 * ersten Treffer und wird nach Ablauf zurückgesetzt.
 */
export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
}

export function hashedKey(scope: string, ip: string, now = new Date()): string {
  const salt = process.env.INDEX_KEY ?? "dev";
  const daily = createHmac("sha256", salt).update(dateKey(now)).digest();
  const digest = createHmac("sha256", daily).update(ip).digest("hex").slice(0, 32);
  return `${scope}:${digest}`;
}

export async function hit(scope: string, ip: string, opts: { limit: number; windowSec: number }, now = new Date()): Promise<LimitResult> {
  const db = await getDb();
  const key = hashedKey(scope, ip, now);
  const windowMs = opts.windowSec * 1000;
  // Atomar: Zeile anlegen oder – je nach Fensterstatus – zählen bzw. zurücksetzen
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${new Date(now.getTime() - windowMs)} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${new Date(now.getTime() - windowMs)} THEN ${now} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
  const row = rows[0]!;
  const resetAt = new Date(row.windowStart.getTime() + windowMs);
  return { ok: row.count <= opts.limit, remaining: Math.max(0, opts.limit - row.count), resetAt };
}

/** Abgelaufene Fenster entfernen – läuft im Tick. */
export async function cleanupRateLimits(now = new Date(), olderThanSec = 24 * 3600): Promise<number> {
  const db = await getDb();
  const rows = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now.getTime() - olderThanSec * 1000)))
    .returning({ key: rateLimits.key });
  return rows.length;
}
