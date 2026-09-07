import { readdirSync } from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { NextResponse } from "next/server";
import { bearerAuthorized } from "@/lib/api/bearer";
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
const authorized = (req: Request) => bearerAuthorized(req, process.env.MIGRATE_SECRET);

/**
 * Fehlermeldungen dürfen hier ausnahmsweise nach außen: Der Aufrufer hält
 * bereits das Geheimnis, und ohne den Grund ist eine ferngesteuerte Migration
 * nicht zu reparieren. Verbindungszeichenketten werden trotzdem entfernt –
 * ein Treiberfehler zitiert gern die ganze DATABASE_URL samt Passwort.
 */
function safeMessage(err: unknown): string {
  const raw = err instanceof Error ? `${err.message}` : String(err);
  return raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…");
}

export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  if (dbKind() !== "pg") {
    return NextResponse.json({ error: "DATABASE_URL fehlt – nichts zu migrieren." }, { status: 400 });
  }
  const folder = migrationsFolder();
  try {
    const db = await getDb();
    await migrate(db as never, { migrationsFolder: folder });
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: safeMessage(err), folder, files: listMigrations(folder) },
      { status: 500 },
    );
  }
}

/** Welche Dateien die Funktion tatsächlich sieht – die häufigste Fehlerursache. */
function listMigrations(folder: string): string[] {
  try {
    return readdirSync(folder).sort();
  } catch (err) {
    return [`nicht lesbar: ${safeMessage(err)}`];
  }
}
