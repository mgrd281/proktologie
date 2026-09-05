/**
 * Migrationen gegen Postgres (Neon) ausführen – bewusst NICHT im Vercel-Build,
 * sondern kontrolliert: `npm run db:migrate` mit DATABASE_URL aus .env.local
 * oder der Vercel-Umgebung.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, dbKind, migrationsFolder } from "../lib/db/client";

async function main() {
  if (dbKind() !== "pg") {
    console.error("DATABASE_URL fehlt – für PGlite migriert die App beim Start selbst.");
    process.exit(1);
  }
  const db = await getDb();
  await migrate(db as never, { migrationsFolder: migrationsFolder() });
  console.log("Migrationen angewendet.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
