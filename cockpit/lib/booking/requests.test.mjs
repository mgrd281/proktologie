/**
 * Anfragen-Posteingang gegen PGlite (echtes Postgres, im Speicher):
 * Kontaktdaten liegen verschlüsselt, die Referenz ist vorlesbar, der
 * Statuswechsel schließt die Anfrage und die Frist steuert die Reihenfolge.
 *
 * Ausführen:  node --test lib/booking/requests.test.mjs
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
process.env.DATA_KEY_V1 = process.env.DATA_KEY_V1 ?? Buffer.alloc(32, 7).toString("base64");
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 9).toString("base64");
delete process.env.DATABASE_URL;

const requests = await import("./requests.ts");
const { getDb } = await import("../db/client.ts");
const schema = await import("../db/schema.ts");
const { eq } = await import("drizzle-orm");

let db;
before(async () => {
  db = await getDb();
});

test("Rückruf anlegen: Referenz AN-…, Frist gesetzt, Status neu", async () => {
  const r = await requests.createRequest({
    kind: "rueckruf",
    pii: { firstName: "Erika", lastName: "Musterfrau", phone: "040 000 0000" },
    message: { text: "Bitte um Rückruf", source: "chat", preferredTime: "vormittags", locale: "de" },
  });
  assert.match(r.ref, /^AN-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  assert.equal(r.status, "neu");
  assert.equal(r.kind, "rueckruf");
  assert.equal(r.pii.firstName, "Erika");
  assert.equal(r.message?.preferredTime, "vormittags");
  assert.equal(r.message?.source, "chat");
  assert.ok(r.slaDueAt && new Date(r.slaDueAt).getTime() > Date.now());
  assert.equal(r.closedAt, null);
});

test("Kontaktdaten stehen verschlüsselt in der Datenbank", async () => {
  const r = await requests.createRequest({
    kind: "folgerezept",
    pii: { firstName: "Max", lastName: "Mustermann", phone: "040 111 1111", email: "max@example.invalid" },
    message: { text: "Bitte vorbereiten", source: "web" },
  });
  const [row] = await db.select().from(schema.requests).where(eq(schema.requests.id, r.id));
  // Weder Name noch Telefon noch Freitext dürfen im Klartext in der Zeile stehen
  const raw = JSON.stringify(row);
  assert.ok(!raw.includes("Mustermann"), "Nachname im Klartext");
  assert.ok(!raw.includes("040 111 1111"), "Telefon im Klartext");
  assert.ok(!raw.includes("max@example.invalid"), "E-Mail im Klartext");
  assert.ok(!raw.includes("Bitte vorbereiten"), "Freitext im Klartext");
  assert.match(row.piiEnc, /^v\d+:/);
  assert.match(row.messageEnc, /^v\d+:/);
});

test("Status: in Arbeit, dann erledigt setzt closedAt; wieder öffnen löscht es", async () => {
  const r = await requests.createRequest({ kind: "befundkopie", pii: { firstName: "Otto", lastName: "Normal", phone: "040 222" } });
  const working = await requests.setRequestStatus(r.id, "in_arbeit", null);
  assert.equal(working.status, "in_arbeit");
  assert.equal(working.closedAt, null);
  const done = await requests.setRequestStatus(r.id, "erledigt", null);
  assert.equal(done.status, "erledigt");
  assert.ok(done.closedAt, "erledigt setzt closedAt");
  const reopened = await requests.setRequestStatus(r.id, "neu", null);
  assert.equal(reopened.closedAt, null, "Wieder öffnen löscht closedAt");
});

test("Liste: offene Anfragen lassen sich getrennt abfragen", async () => {
  const all = await requests.listRequests();
  const open = await requests.listRequests({ open: true });
  assert.ok(all.length >= open.length);
  assert.ok(open.every((r) => requests.OPEN_REQUEST_STATUSES.includes(r.status)));
  const offen = await requests.countOpenRequests();
  assert.equal(offen, open.length);
});

test("Unbekannte Anfrage: getRequest liefert null, setRequestStatus wirft", async () => {
  assert.equal(await requests.getRequest("00000000-0000-4000-8000-000000000000"), null);
  await assert.rejects(() => requests.setRequestStatus("00000000-0000-4000-8000-000000000000", "erledigt", null), /nicht gefunden/);
});

test("Demo-Anfragen lassen sich gezielt entfernen", async () => {
  await requests.createRequest({ kind: "sonstiges", pii: { firstName: "Demo", lastName: "Zeile" }, isDemo: true });
  const removed = await requests.purgeDemoRequests();
  assert.ok(removed >= 1);
  const rest = await requests.listRequests();
  assert.ok(rest.every((r) => !r.isDemo));
});

test("Eingabeprüfung der Rückrufbitte: Telefon nötig, Wunschzeit hat einen Standard", () => {
  const ok = requests.callbackSchema.safeParse({ firstName: "Erika", lastName: "Musterfrau", phone: "040 490 80 21" });
  assert.ok(ok.success);
  assert.equal(ok.data.kind, "rueckruf");
  assert.equal(ok.data.preferredTime, "egal");
  assert.equal(ok.data.locale, "de");
  assert.equal(requests.callbackSchema.safeParse({ firstName: "E", lastName: "M", phone: "123" }).success, false);
  assert.equal(requests.callbackSchema.safeParse({ firstName: "", lastName: "M", phone: "040 490 80 21" }).success, false);
});
