/**
 * Die Terminwerkzeuge gegen eine echte Datenbank (PGlite im Speicher):
 * Der Assistent nennt nur Zeiten, die es wirklich gibt, und schweigt
 * nicht, wenn er nicht nachsehen kann.
 *
 * Ausführen:  node --test lib/chat/tools.test.mjs
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
process.env.DATA_KEY_V1 = process.env.DATA_KEY_V1 ?? Buffer.alloc(32, 5).toString("base64");
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 6).toString("base64");
delete process.env.DATABASE_URL;

const tools = await import("./tools.ts");
const repo = await import("../booking/repo.ts");

/** Fester Bezugspunkt: Montag, 13. Juli 2026, 08:00 Berliner Zeit. */
const NOW = new Date("2026-07-13T06:00:00Z");
const DIENSTAG = "2026-07-14";
const ctx = { now: NOW, lang: "de" };

before(async () => {
  await repo.getSettings();
  await repo.updateSettings({ bookingLive: true, bookingPaused: false }, "test");
});

test("Ohne Live-Schalter sagt der Assistent, dass er nicht nachsehen kann", async () => {
  await repo.updateSettings({ bookingLive: false }, "test");
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG }, ctx);
  assert.equal(a.kind, "unavailable");
  assert.equal(a.reason, "not_live");
  const satz = tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW);
  assert.match(satz, /nicht nachsehen/);
  assert.match(satz, /040 490 80 21/);
  await repo.updateSettings({ bookingLive: true }, "test");
});

test("Freie Zeit: klare Zusage mit Tag und Uhrzeit", async () => {
  const tag = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG }, ctx);
  assert.equal(tag.kind, "day_slots");
  assert.ok(tag.slots.length > 0);
  assert.ok(tag.slots.length <= 5, "höchstens fünf Zeiten auf einmal");

  const zeit = tag.slots[0];
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG, uhrzeit: zeit }, ctx);
  assert.equal(a.kind, "time_free");
  const satz = tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW);
  assert.match(satz, new RegExp(`^Ja, ${zeit} Uhr am Dienstag, 14\\. Juli 2026 ist frei\\.$`));
});

test("Belegte Zeit: Absage plus die nächstgelegenen freien Zeiten", async () => {
  const frei = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG }, ctx);
  const zeit = frei.slots[2];
  // Diese Zeit belegen – wie eine echte Buchung
  const [h, m] = zeit.split(":").map(Number);
  await repo.createAppointment({
    typeId: "kontrolle",
    startsAt: new Date(Date.UTC(2026, 6, 14, h - 2, m)), // Berlin = UTC+2 im Juli
    pii: { firstName: "Belegt", lastName: "Test", email: "belegt@example.invalid" },
    source: "cockpit",
  });

  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG, uhrzeit: zeit }, ctx);
  assert.equal(a.kind, "time_taken");
  assert.equal(a.time, zeit);
  assert.ok(a.alternatives.length > 0 && a.alternatives.length <= 3);
  assert.ok(!a.alternatives.includes(zeit), "die belegte Zeit wird nicht angeboten");
  const satz = tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW);
  assert.match(satz, /^Nein, /);
  assert.match(satz, /frei sind/);
});

test("Ohne Datum: die nächsten Tage mit freien Zeiten", async () => {
  const a = await tools.naechsterFreierTermin({ art: "kontrolle" }, ctx);
  assert.equal(a.kind, "next_days");
  assert.ok(a.days.length > 0);
  assert.ok(a.days.length <= 3);
  assert.ok(a.days.every((d) => d.slots.length > 0));
  const satz = tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW);
  assert.match(satz, /Nächste freie Zeiten für „Kontrolltermin“/);
});

test("Samstag ist zu: der Assistent bietet den nächsten möglichen Tag an", async () => {
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: "2026-07-18" }, ctx);
  assert.equal(a.kind, "day_empty");
  const satz = tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW);
  assert.match(satz, /Am Samstag, 18\. Juli 2026 ist nichts frei/);
});

test("Vergangenes Datum wird höflich zurückgewiesen", async () => {
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: "2026-07-01" }, ctx);
  assert.equal(a.kind, "unavailable");
  assert.equal(a.reason, "past");
  assert.match(tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW), /Vergangenheit/);
});

test("Unbekannte Terminart wird erkannt, nicht erraten", async () => {
  const a = await tools.verfuegbarkeitPruefen({ art: "gibt-es-nicht", datum: DIENSTAG }, ctx);
  assert.equal(a.kind, "unavailable");
  assert.equal(a.reason, "unknown_type");
});

test("Pausierte Buchung nennt den Hinweistext der Praxis", async () => {
  await repo.updateSettings({ bookingPaused: true, bannerText: "Vom 12. bis 23. August ist die Praxis geschlossen." }, "test");
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG }, ctx);
  assert.equal(a.kind, "unavailable");
  assert.equal(a.reason, "paused");
  assert.equal(tools.renderSlotAnswer(a, "de", "Kontrolltermin", "040 490 80 21", NOW), "Vom 12. bis 23. August ist die Praxis geschlossen.");
  await repo.updateSettings({ bookingPaused: false, bannerText: null }, "test");
});

test("Englische Antworten sind englisch", async () => {
  const a = await tools.verfuegbarkeitPruefen({ art: "kontrolle", datum: DIENSTAG }, { now: NOW, lang: "en" });
  const satz = tools.renderSlotAnswer(a, "en", "Check-up", "+49 40 490 80 21", NOW);
  assert.match(satz, /^On Tuesday, 14 July 2026 these times are free:/);
  assert.ok(!satz.includes("Uhr"));
});

test("Nur öffentlich buchbare Terminarten stehen zur Wahl", async () => {
  const types = await tools.publicTypeList();
  assert.equal(types.length, 7);
  assert.ok(types.some((t) => t.id === "kontrolle"));
  assert.ok(types.every((t) => typeof t.durationMin === "number"));
});

test("Sprechzeiten kommen aus der Datenbank, nicht aus einer Datei", async () => {
  const de = await tools.praxisSprechzeiten("de");
  assert.match(de, /Mo, Mi, Fr 07:00–12:00/);
  assert.match(de, /Di, Do 07:00–12:00, 14:00–18:00/);
});

// ---- Erkennung im freien Text ----

test("Terminart: Bezeichnung und Synonyme", async () => {
  const types = await tools.publicTypeList();
  assert.equal(tools.matchType("Ich brauche einen Kontrolltermin", types, "de"), "kontrolle");
  assert.equal(tools.matchType("check-up bitte", types, "de"), "kontrolle");
  assert.equal(tools.matchType("Ich war noch nie da, Erstuntersuchung", types, "de"), "erstuntersuchung");
  assert.equal(tools.matchType("I am a new patient", types, "en"), "erstuntersuchung");
  assert.equal(tools.matchType("Ich weiß nicht, was ich brauche", types, "de"), "unklar");
  assert.equal(tools.matchType("Nachsorge", types, "de"), "nachsorge");
  assert.equal(tools.matchType("irgendwas anderes", types, "de"), null);
});

test("Datum: heute, morgen, Wochentag, deutsche und ISO-Schreibweise", () => {
  assert.equal(tools.parseDateWords("heute noch?", NOW, "de"), "2026-07-13");
  assert.equal(tools.parseDateWords("geht morgen?", NOW, "de"), "2026-07-14");
  assert.equal(tools.parseDateWords("übermorgen", NOW, "de"), "2026-07-15");
  assert.equal(tools.parseDateWords("am Dienstag bitte", NOW, "de"), "2026-07-14");
  assert.equal(tools.parseDateWords("next friday", NOW, "en"), "2026-07-17");
  assert.equal(tools.parseDateWords("am 16.7.", NOW, "de"), "2026-07-16");
  assert.equal(tools.parseDateWords("am 16.07.2026", NOW, "de"), "2026-07-16");
  assert.equal(tools.parseDateWords("2026-07-16", NOW, "de"), "2026-07-16");
  assert.equal(tools.parseDateWords("irgendwann mal", NOW, "de"), null);
});

test("Datum ohne Jahr, das schon vorbei ist, meint das nächste Jahr", () => {
  assert.equal(tools.parseDateWords("am 3.2.", NOW, "de"), "2027-02-03");
});

test("Uhrzeit: Ziffern, „Uhr“, halb und viertel, am/pm", () => {
  assert.equal(tools.parseTimeWords("um 14:30"), "14:30");
  assert.equal(tools.parseTimeWords("um 14.30 Uhr"), "14:30");
  assert.equal(tools.parseTimeWords("um 9 Uhr"), "09:00");
  assert.equal(tools.parseTimeWords("halb drei"), "14:30");
  assert.equal(tools.parseTimeWords("viertel nach zwei"), "14:15");
  assert.equal(tools.parseTimeWords("viertel vor drei"), "14:45");
  assert.equal(tools.parseTimeWords("at 2:30 pm"), "14:30");
  assert.equal(tools.parseTimeWords("at 9 am"), "09:00");
  assert.equal(tools.parseTimeWords("irgendwann"), null);
});
