import { createHash } from "node:crypto";
import { desc } from "drizzle-orm";
import { getDb, type Db } from "./db/client.ts";
import { auditLog } from "./db/schema.ts";

/**
 * Revisionssicheres Protokoll. Jede Zeile trägt den Hash ihres Inhalts
 * plus den Hash der Vorgängerzeile – eine nachträgliche Änderung (die der
 * Trigger ohnehin verbietet) würde die Kette sichtbar brechen.
 * `meta` enthält nie personenbezogene Daten: IDs und Zustände, keine Namen.
 */
export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

function hashOf(prev: string | null, e: AuditEntry, at: Date): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prev,
        at: at.toISOString(),
        actorId: e.actorId ?? null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        meta: e.meta ?? {},
      }),
    )
    .digest("hex");
}

export async function audit(entry: AuditEntry, db?: Db): Promise<void> {
  const conn = db ?? (await getDb());
  const [last] = await conn.select({ hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.seq)).limit(1);
  const at = new Date();
  const prevHash = last?.hash ?? null;
  await conn.insert(auditLog).values({
    at,
    actorId: entry.actorId ?? null,
    actorRole: entry.actorRole ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? {},
    prevHash,
    hash: hashOf(prevHash, entry, at),
  });
}

/** Kette prüfen – für die Sicherheitsseite (Phase 0: nur Länge und Bruchstellen). */
export async function verifyChain(db?: Db): Promise<{ length: number; broken: number[] }> {
  const conn = db ?? (await getDb());
  const rows = await conn.select().from(auditLog).orderBy(auditLog.seq);
  const broken: number[] = [];
  let prev: string | null = null;
  for (const r of rows) {
    const expected = hashOf(prev, r, r.at);
    if (r.prevHash !== prev || r.hash !== expected) broken.push(r.seq);
    prev = r.hash;
  }
  return { length: rows.length, broken };
}
