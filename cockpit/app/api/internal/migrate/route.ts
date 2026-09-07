import { timingSafeEqual } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { NextResponse } from "next/server";
import { dbKind, getDb, migrationsFolder } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Migrationen gegen die produktive Datenbank ausführen, ohne dass
 * DATABASE_URL je ein lokales Terminal erreicht: Vercel-verwaltete
 * Marketplace-Geheimnisse (hier: die Neon-Integration) sind als
 * "sensitive" markiert und lassen sich nach dem Speichern durch NIEMANDEN
 * mehr auslesen – auch nicht über die API oder `vercel env pull`. Diese
 * Route führt die Migration deshalb dort aus, wo die Variable tatsächlich
 * existiert: zur Laufzeit der Vercel-Funktion selbst.
 *
 * Aufruf: POST mit `Authorization: Bearer <MIGRATE_SECRET>`.
 * Ohne konfiguriertes Geheimnis existiert die Route nach außen nicht (404).
 */
function authorized(req: Request): boolean {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  if (dbKind() !== "pg") {
    return NextResponse.json({ error: "DATABASE_URL fehlt – nichts zu migrieren." }, { status: 400 });
  }
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: migrationsFolder() });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
