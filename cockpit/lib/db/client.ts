import { existsSync, mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema.ts";

/**
 * EINE Datenbankschnittstelle, zwei Treiber:
 * - DATABASE_URL gesetzt  → Postgres (Neon, eu-central-1) über node-postgres
 * - DATABASE_URL leer     → PGlite (Postgres als WASM, Datei unter .pglite/)
 *   für Entwicklung und Tests – nie produktiv.
 *
 * Die Instanz entsteht synchron und ohne Nebenwirkung (kein Verbindungs-
 * aufbau beim Import – wichtig für den Next-Build, der Module nur lädt).
 * Bereitschaft (PGlite: WASM-Start + Migrationen) stellt `getDb()` her;
 * jeder Einstiegspunkt wartet darauf, bevor er Better Auth befragt.
 * Beide Treiber sind serverExternalPackages: Sie werden zur Laufzeit
 * per require geladen, das Produktions-Bundle schleppt kein WASM mit.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface Holder {
  db?: Db;
  kind?: "pg" | "pglite";
  ready?: Promise<void>;
  pglite?: PGlite;
}
const holder = (globalThis as unknown as { __cockpitDb?: Holder }).__cockpitDb ??
  ((globalThis as unknown as { __cockpitDb?: Holder }).__cockpitDb = {});

export function dbKind(): "pg" | "pglite" {
  return process.env.DATABASE_URL ? "pg" : "pglite";
}

/** Migrationsordner relativ zum Projekt – funktioniert im Next-Bundle und in Skripten. */
export function migrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? `${process.cwd()}/drizzle`;
}

function pgliteDir(): string | undefined {
  // Während des Next-Builds nur im Speicher – kein Dateisystem anfassen
  if (process.env.NEXT_PHASE === "phase-production-build") return undefined;
  const dir = process.env.PGLITE_DIR ?? ".pglite/dev";
  if (dir === ":memory:") return undefined;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Synchrone Instanz – für den Auth-Adapter. Bereitschaft: siehe getDb(). */
export function dbSync(): Db {
  if (holder.db && holder.kind === dbKind()) return holder.db;
  holder.kind = dbKind();
  holder.ready = undefined;
  if (holder.kind === "pg") {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      // Vercel-Funktionen sind kurzlebig – keine Verbindungen horten
      idleTimeoutMillis: 10_000,
    });
    holder.db = drizzlePg(pool, { schema }) as unknown as Db;
  } else {
    const client = new PGlite(pgliteDir(), { extensions: { btree_gist } });
    holder.pglite = client;
    holder.db = drizzlePglite(client, { schema }) as unknown as Db;
  }
  return holder.db;
}

async function ensureReady(): Promise<void> {
  if (holder.kind === "pglite" && holder.pglite) {
    await holder.pglite.waitReady;
    // Entwicklung/Tests: Schema automatisch auf Stand bringen
    if (existsSync(`${migrationsFolder()}/meta/_journal.json`)) {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(holder.db as never, { migrationsFolder: migrationsFolder() });
    }
  }
}

/** Bereite Instanz – Seiten, Actions, Route-Handler und Skripte nutzen diese. */
export async function getDb(): Promise<Db> {
  const db = dbSync();
  holder.ready ??= ensureReady();
  await holder.ready;
  return db;
}
