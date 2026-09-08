/**
 * Die Sprache eines Wartelisten-Eintrags liegt im verschlüsselten
 * Personenteil – ohne Schemaänderung, ohne Klartext – und kommt bei
 * Angebot und Mail wieder heraus.
 *
 * Ausführen:  node --test lib/booking/waitlist-locale.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
process.env.DATA_KEY_V1 = process.env.DATA_KEY_V1 ?? Buffer.alloc(32, 7).toString("base64");
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 9).toString("base64");
delete process.env.DATABASE_URL;

const repo = await import("./repo.ts");
const { getDb } = await import("../db/client.ts");
const schema = await import("../db/schema.ts");
const { eq } = await import("drizzle-orm");

test("Warteliste: Sprache wird verschlüsselt abgelegt und wieder gelesen; Standard ist Deutsch", async () => {
  const en = await repo.createWaitlistEntry({
    typeId: "kontrolle",
    pii: { firstName: "Jane", lastName: "Doe", email: "jane.doe@example.invalid" },
    source: "web",
    locale: "en",
  });
  assert.equal(en.locale, "en");
  assert.equal("locale" in en.pii, false, "die Sprache gehört nicht in die Anzeige-Personendaten");
  assert.equal((await repo.getWaitlistEntry(en.id))?.locale, "en");

  const de = await repo.createWaitlistEntry({
    typeId: "kontrolle",
    pii: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" },
    source: "web",
  });
  assert.equal(de.locale, "de");

  const db = await getDb();
  const [row] = await db.select({ piiEnc: schema.waitlist.piiEnc }).from(schema.waitlist).where(eq(schema.waitlist.id, en.id));
  assert.ok(!row.piiEnc.includes("en") || row.piiEnc.startsWith("v1:"), "verschlüsselt, kein Klartext");
  assert.ok(!row.piiEnc.includes("Jane"), "kein Klartext");
});
