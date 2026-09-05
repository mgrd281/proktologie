/**
 * Ersten Administrator anlegen – einmalig, danach die beiden Variablen
 * aus der Umgebung entfernen. Läuft nur, wenn noch KEIN Konto existiert.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_SECRET=… npm run db:bootstrap-admin
 */
import { count } from "drizzle-orm";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!email || !password) {
    console.error("BOOTSTRAP_ADMIN_EMAIL und BOOTSTRAP_ADMIN_SECRET setzen.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Das Passwort braucht mindestens 12 Zeichen.");
    process.exit(1);
  }
  const { getDb } = await import("../lib/db/client.ts");
  const { user } = await import("../lib/db/schema.ts");
  const { auth } = await import("../lib/auth/auth.ts");
  const { audit } = await import("../lib/audit.ts");

  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(user);
  const n = row?.n ?? 0;
  if (n > 0) {
    console.error(`Es existieren bereits ${n} Konten – Bootstrap verweigert. Weitere Konten nur per Einladung.`);
    process.exit(2);
  }
  const created = await auth.api.createUser({
    body: { email, password, name: "Administrator", role: "admin" },
  });
  await audit({ action: "user.bootstrap", entity: "user", entityId: created.user.id, meta: { role: "admin" } });
  console.log(`Administrator angelegt: ${email}`);
  console.log("Nächster Schritt: anmelden, dann Passkey und TOTP einrichten (wird erzwungen).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
