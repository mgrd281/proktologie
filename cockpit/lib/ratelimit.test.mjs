/**
 * Rate-Limit gegen PGlite: Der Zähler steht in der Datenbank, der Schlüssel
 * ist ein tagesgesalzener HMAC – die rohe IP (oder Sitzungs-Id, oder
 * E-Mail-Adresse) wird nie gespeichert.
 *
 * Der Chat lehnt sich an dieselbe Funktion an: 20 Nachrichten je Sitzung
 * und Stunde, 3 Buchungen je E-Mail-Adresse und Kalendertag. Dieser Test
 * belegt, dass beides ohne neue Tabelle funktioniert.
 *
 * Ausführen:  node --test lib/ratelimit.test.mjs
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 3).toString("base64");
delete process.env.DATABASE_URL;

const { hit, hashedKey, cleanupRateLimits } = await import("./ratelimit.ts");
const { getDb } = await import("./db/client.ts");

before(async () => {
  await getDb();
});

test("Sitzung: die 21. Nachricht in der Stunde wird abgelehnt", async () => {
  const session = "e0a1b2c3-0000-4000-8000-000000000001";
  for (let i = 1; i <= 20; i++) {
    const r = await hit("chat.session", session, { limit: 20, windowSec: 3600 });
    assert.equal(r.ok, true, `Nachricht ${i} sollte durchgehen`);
    assert.equal(r.remaining, 20 - i);
  }
  const over = await hit("chat.session", session, { limit: 20, windowSec: 3600 });
  assert.equal(over.ok, false);
  assert.equal(over.remaining, 0);
  assert.ok(over.resetAt.getTime() > Date.now(), "Fenster läuft in der Zukunft ab");
});

test("E-Mail-Adresse: die 4. Buchung am selben Tag wird abgelehnt", async () => {
  const key = "erika.musterfrau@example.invalid";
  for (let i = 1; i <= 3; i++) {
    assert.equal((await hit("chat.book", key, { limit: 3, windowSec: 86400 })).ok, true, `Buchung ${i}`);
  }
  assert.equal((await hit("chat.book", key, { limit: 3, windowSec: 86400 })).ok, false);
  // Eine andere Adresse ist davon unberührt
  assert.equal((await hit("chat.book", "max@example.invalid", { limit: 3, windowSec: 86400 })).ok, true);
});

test("Bereiche zählen getrennt", async () => {
  const same = "gleicher-schluessel";
  await hit("bereich.a", same, { limit: 1, windowSec: 3600 });
  assert.equal((await hit("bereich.a", same, { limit: 1, windowSec: 3600 })).ok, false, "zweiter Treffer im selben Bereich");
  assert.equal((await hit("bereich.b", same, { limit: 1, windowSec: 3600 })).ok, true, "anderer Bereich hat einen eigenen Zähler");
});

test("Der Schlüssel verrät den Klartext nicht und wechselt mit dem Tag", () => {
  const ip = "203.0.113.42";
  const heute = hashedKey("chat.ip", ip, new Date("2026-07-14T10:00:00Z"));
  const morgen = hashedKey("chat.ip", ip, new Date("2026-07-15T10:00:00Z"));
  assert.ok(!heute.includes(ip), "IP steht nicht im Schlüssel");
  assert.match(heute, /^chat\.ip:[0-9a-f]{32}$/);
  assert.notEqual(heute, morgen, "Tagessalz macht den Schlüssel von gestern wertlos");
  // Der Tag endet um Mitternacht in Berlin, nicht in UTC: 21:59 UTC ist im
  // Sommer noch derselbe Berliner Tag, 22:00 UTC gehört schon zum nächsten.
  assert.equal(heute, hashedKey("chat.ip", ip, new Date("2026-07-14T21:59:00Z")), "innerhalb des Berliner Tages stabil");
  assert.notEqual(heute, hashedKey("chat.ip", ip, new Date("2026-07-14T22:00:00Z")), "nach Berliner Mitternacht neuer Schlüssel");
});

test("Abgelaufene Fenster werden aufgeräumt", async () => {
  await hit("aufraeumen", "x", { limit: 5, windowSec: 60 });
  // Alles, was älter als eine Sekunde ist, gilt hier als abgelaufen
  const removed = await cleanupRateLimits(new Date(Date.now() + 3600_000), 1);
  assert.ok(removed >= 1);
});
