/**
 * Der Gesprächsablauf mit gestellten Abhängigkeiten: keine Datenbank, kein
 * Netz, kein Mailversand. Geprüft wird das, was der Praxis versprochen
 * wurde – dass gebucht wird, wenn „ja“ gesagt wurde, und sonst nie; dass
 * das Sprachmodell weder Namen noch Nummern noch Gesundheitsangaben sieht;
 * und dass jede Zeile auch dann steht, wenn kein Anbieter antwortet.
 *
 * Ausführen:  node --test lib/chat/orchestrator.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
process.env.DATA_KEY_V1 = process.env.DATA_KEY_V1 ?? Buffer.alloc(32, 5).toString("base64");
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 6).toString("base64");
delete process.env.DATABASE_URL;

const o = await import("./orchestrator.ts");

/** Montag, 13. Juli 2026, 08:00 Berliner Zeit. */
const NOW = new Date("2026-07-13T06:00:00Z");
const DIENSTAG = "2026-07-14";
const SESSION = "11111111-2222-4333-8444-555555555555";
const SLOTS = ["07:00", "07:30", "08:00", "08:30", "09:00"];
const HOURS_DE = "Mo, Mi, Fr 07:00–12:00 · Di, Do 07:00–12:00, 14:00–18:00 Uhr";
const HOURS_EN = "Mon, Tue, Wed 07:00–12:00";

/** Dieselben sieben Terminarten wie in der Datenbank (0001_constraints_and_seed.sql). */
const TYPES = [
  { id: "unklar", label: "Beschwerden / unklar", durationMin: 20 },
  { id: "erstuntersuchung", label: "Proktologische Erstuntersuchung", durationMin: 30 },
  { id: "kontrolle", label: "Kontrolltermin", durationMin: 15 },
  { id: "haemorrhoiden", label: "Hämorrhoiden", durationMin: 20 },
  { id: "analfissur", label: "Analfissur", durationMin: 20 },
  { id: "analfistel", label: "Analfistel", durationMin: 20 },
  { id: "nachsorge", label: "Nachsorge", durationMin: 15 },
];

function makeDeps(over = {}) {
  const calls = { classify: [], phrase: [], book: [], callback: [], audit: [], availability: [] };
  const deps = {
    now: () => NOW,
    types: async () => TYPES,
    availability: async (args, ctx) => {
      calls.availability.push(args);
      if (!args.datum) return { kind: "next_days", days: [{ date: DIENSTAG, slots: SLOTS.slice(0, 3) }] };
      if (args.uhrzeit) {
        return SLOTS.includes(args.uhrzeit)
          ? { kind: "time_free", date: args.datum, time: args.uhrzeit }
          : { kind: "time_taken", date: args.datum, time: args.uhrzeit, alternatives: SLOTS.slice(0, 3) };
      }
      void ctx;
      return { kind: "day_slots", date: args.datum, slots: SLOTS };
    },
    nextFree: async () => ({ kind: "next_days", days: [{ date: DIENSTAG, slots: SLOTS.slice(0, 3) }] }),
    info: async (lang) => ({ hoursText: lang === "de" ? HOURS_DE : HOURS_EN, banner: null }),
    classify: async (call) => {
      calls.classify.push(call);
      return null;
    },
    phrase: async (call) => {
      calls.phrase.push(call);
      return null;
    },
    book: async (input) => {
      calls.book.push(input);
      return { ok: true, ref: "PE-4F7K", typeLabel: "Kontrolltermin", mail: "sent" };
    },
    callback: async (input) => {
      calls.callback.push(input);
      return { ok: true, ref: "AN-7T2M" };
    },
    bookingsToday: async () => true,
    isBlocked: () => false,
    audit: (event, data) => calls.audit.push([event, data]),
    ...over,
  };
  return { deps, calls };
}

const msg = (state, message) => ({ v: 1, sessionId: SESSION, state, message });
const click = (state, id) => ({ v: 1, sessionId: SESSION, state, action: { kind: "quick", id } });
const form = (state, formId, values) => ({ v: 1, sessionId: SESSION, state, action: { kind: "form", formId, values } });

const KONTAKT = { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid", phone: "040 123456", consent: "true" };

/** Der volle Weg bis zur Bestätigungsfrage – gibt den Zustand zurück. */
async function bisZurBestaetigung(deps) {
  let r = await o.runTurn(click(null, "book"), deps);
  r = await o.runTurn(click(r.state, "type:kontrolle"), deps);
  r = await o.runTurn(msg(r.state, "Geht es am Dienstag?"), deps);
  assert.equal(r.state.stage, "time", "nach dem Tag kommen die Uhrzeiten");
  r = await o.runTurn(click(r.state, `time:${DIENSTAG}|09:00`), deps);
  assert.equal(r.state.stage, "contact");
  assert.equal(r.form?.id, "contact");
  r = await o.runTurn(form(r.state, "contact", KONTAKT), deps);
  return r;
}

// ---------------------------------------------------------- Buchung

test("Der volle Weg endet mit der Bestätigungsfrage – und „ja“ bucht genau einmal", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  assert.equal(summary.state.stage, "confirm");
  assert.match(summary.reply, /^Kontrolltermin am Dienstag, 14\. Juli 2026 um 09:00 Uhr für Erika Musterfrau \(erika@example\.invalid\)\./);
  assert.match(summary.reply, /Soll ich das so verbindlich buchen\?$/);
  assert.deepEqual(summary.quick?.map((q) => q.id), ["yes", "no"]);
  assert.equal(calls.book.length, 0, "vor der Zusage wird nicht gebucht");

  const done = await o.runTurn(msg(summary.state, "ja"), deps);
  assert.equal(calls.book.length, 1);
  assert.deepEqual(calls.book[0], {
    typeId: "kontrolle",
    date: DIENSTAG,
    time: "09:00",
    firstName: "Erika",
    lastName: "Musterfrau",
    email: "erika@example.invalid",
    phone: "040 123456",
    locale: "de",
  });
  assert.equal(done.state.stage, "done");
  assert.deepEqual(done.flags.booked, { ref: "PE-4F7K", mail: "sent" });
  assert.match(done.reply, /Gebucht: Kontrolltermin am Dienstag, 14\. Juli 2026 um 09:00 Uhr\. Ihre Referenz: PE-4F7K\./);
  assert.match(done.reply, /Bestätigung mit Kalendereintrag/);
});

test("„vielleicht“ bucht nicht – es wird einmal nachgefragt", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const again = await o.runTurn(msg(summary.state, "vielleicht"), deps);
  assert.equal(calls.book.length, 0);
  assert.match(again.reply, /Ja oder Nein/);
  assert.equal(again.state.stage, "confirm");

  const back = await o.runTurn(msg(again.state, "vielleicht"), deps);
  assert.equal(calls.book.length, 0);
  assert.equal(back.state.stage, "date");
});

test("Belegter Platz: Alternativen statt zweiter Buchung", async () => {
  const { deps, calls } = makeDeps({
    book: async (input) => {
      calls.book.push(input);
      return { ok: false, code: "slot_taken" };
    },
  });
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "ja"), deps);
  assert.equal(calls.book.length, 1, "genau ein Buchungsversuch");
  assert.match(r.reply, /^Diese Zeit wurde gerade vergeben\./);
  assert.equal(r.state.stage, "time");
  assert.ok(r.quick.length > 0);
  assert.ok(r.quick.every((q) => q.id.startsWith("time:")));
  assert.equal(r.flags.booked, undefined);
});

test("Gesperrte Adresse bucht nicht", async () => {
  const { deps, calls } = makeDeps({ isBlocked: () => true });
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "ja"), deps);
  assert.equal(calls.book.length, 0);
  assert.match(r.reply, /040 490 80 21/);
  assert.ok(calls.audit.some(([e]) => e === "chat.blocked"));
});

test("Tageslimit je E-Mail hält den Chat auf", async () => {
  const { deps, calls } = makeDeps({ bookingsToday: async () => false });
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "ja"), deps);
  assert.equal(calls.book.length, 0);
  assert.match(r.reply, /heute keinen weiteren Termin/);
});

test("Fehlende Einwilligung bucht nicht, sondern zeigt das Formular erneut", async () => {
  const { deps, calls } = makeDeps();
  let r = await o.runTurn(click(null, "book"), deps);
  r = await o.runTurn(click(r.state, "type:kontrolle"), deps);
  r = await o.runTurn(msg(r.state, "Dienstag"), deps);
  r = await o.runTurn(click(r.state, `time:${DIENSTAG}|09:00`), deps);
  r = await o.runTurn(form(r.state, "contact", { ...KONTAKT, consent: "" }), deps);
  assert.equal(r.state.stage, "contact");
  assert.equal(r.form?.id, "contact");
  assert.match(r.reply, /Einwilligung/);
  assert.equal(calls.book.length, 0);
});

// ------------------------------------------------------- Sicherheit

test("Notfall bricht alles ab – vor Modell und vor Buchung", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "Mir drückt es auf der Brust und ich bekomme keine Luft"), deps);
  assert.equal(r.flags.emergency, true);
  assert.match(r.reply, /112/);
  assert.match(r.reply, /116 117/);
  assert.deepEqual(r.links?.map((l) => l.href), ["tel:112", "tel:116117"]);
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.book.length, 0);
});

test("Notfall im Formularfeld wird genauso erkannt", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(
    form(null, "callback", { firstName: "Max", lastName: "Muster", phone: "040 123456", note: "Ich bin bewusstlos gewesen" }),
    deps,
  );
  assert.equal(r.flags.emergency, true);
  assert.equal(calls.callback.length, 0, "nichts wird gespeichert");
});

test("Medizinische Frage: der vorgegebene Satz, kein Modellaufruf", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich habe Schmerzen beim Stuhlgang, ist das normal?"), deps);
  assert.equal(r.reply, "Dazu kann ich nichts sagen, das bespricht Dr. Kunstreich mit Ihnen persönlich. Soll ich Ihnen einen Termin suchen?");
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.phrase.length, 0);
});

test("Gesundheitsangaben: Hinweis, kein Modellaufruf, keine Weitergabe", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich blute seit drei Tagen"), deps);
  assert.match(r.reply, /keine gesundheitlichen Details/);
  assert.match(r.reply, /nicht weitergegeben/);
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.phrase.length, 0);
});

test("Terminart im Freitext genannt: Hinweis plus Auswahl", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich glaube, ich habe Hämorrhoiden"), deps);
  assert.match(r.reply, /keine gesundheitlichen Details/);
  assert.equal(r.state.stage, "type");
  assert.deepEqual(r.quick?.map((q) => q.id), TYPES.map((x) => `type:${x.id}`));
  assert.equal(calls.classify.length, 0);
});

test("Gesundheitsangaben im Rückruf-Formular werden nicht gespeichert", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(
    form(null, "callback", { kind: "rueckruf", firstName: "Max", lastName: "Muster", phone: "040 123456", preferredTime: "vormittags", note: "Ich habe Juckreiz" }),
    deps,
  );
  assert.equal(calls.callback.length, 1);
  assert.equal(calls.callback[0].note, undefined, "die Schilderung wird verworfen");
  assert.match(r.reply, /AN-7T2M/);
  assert.ok(calls.audit.some(([e]) => e === "chat.note_dropped"));
});

test("Kanarienvogel: E-Mail und Telefonnummer erreichen das Modell nie", async () => {
  const { deps, calls } = makeDeps();
  await o.runTurn(msg(null, "Sagen Sie Herrn Meier viele Grüße von max@example.com und 0170 1234567."), deps);
  assert.equal(calls.classify.length, 1, "diese Nachricht geht an die Einordnung");
  const sent = JSON.stringify(calls.classify[0]);
  assert.ok(!sent.includes("max@example.com"), "keine E-Mail im Modellaufruf");
  assert.ok(!sent.includes("0170"), "keine Telefonnummer im Modellaufruf");
  assert.ok(sent.includes("[E-Mail]") && sent.includes("[Telefon]"));
});

test("Kanarienvogel: der erfasste Kontakt taucht in keinem Modellaufruf auf", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const done = await o.runTurn(msg(summary.state, "ja"), deps);
  await o.runTurn(msg(done.state, "Sagen Sie Herrn Meier viele Grüße."), deps);
  assert.ok(done.state.draft.contact, "der Kontakt steht im Zustand");
  const sent = JSON.stringify(calls.classify) + JSON.stringify(calls.phrase);
  for (const secret of ["Erika", "Musterfrau", "erika@example.invalid", "040 123456"]) {
    assert.ok(!sent.includes(secret), `„${secret}“ darf das Modell nicht erreichen`);
  }
});

// ------------------------------------------------------ Praxisfragen

test("Öffnungszeiten kommen aus den Fakten, auch ohne Modell", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(click(null, "hours"), deps);
  assert.match(r.reply, new RegExp(HOURS_DE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(r.flags.llm, "none", "Schaltflächen brauchen kein Modell");
  assert.equal(calls.phrase.length, 0);
});

test("Freie Frage: das Modell formuliert nur, wenn es bei den Fakten bleibt", async () => {
  const { deps } = makeDeps({ phrase: async () => "Wir haben Mo, Mi, Fr 07:00–12:00 Uhr für Sie da." });
  const r = await o.runTurn(msg(null, "Wann haben Sie geöffnet?"), deps);
  assert.equal(r.reply, "Wir haben Mo, Mi, Fr 07:00–12:00 Uhr für Sie da.");
  assert.equal(r.flags.llm, "model");
});

test("Erfundene Uhrzeit wird verworfen – die Fakten gelten", async () => {
  const { deps } = makeDeps({ phrase: async () => "Wir haben täglich bis 19:30 Uhr geöffnet." });
  const r = await o.runTurn(msg(null, "Wann haben Sie geöffnet?"), deps);
  assert.ok(!r.reply.includes("19:30"));
  assert.match(r.reply, /Sprechzeiten: /);
  assert.equal(r.flags.llm, "fallback");
});

test("Ohne erreichbares Modell antwortet die Frage trotzdem", async () => {
  const { deps } = makeDeps({ phrase: async () => null });
  const r = await o.runTurn(msg(null, "Wann haben Sie geöffnet?"), deps);
  assert.match(r.reply, /Sprechzeiten: /);
  assert.equal(r.flags.llm, "fallback");
});

test("Was die Praxis nicht hinterlegt hat, wird nicht erfunden", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Haben Sie Parkplätze?"), deps);
  assert.match(r.reply, /Das weiß ich leider nicht/);
  assert.match(r.reply, /040 490 80 21/);
  assert.equal(calls.phrase.length, 0, "ohne Fakten wird nichts formuliert");
});

test("„Brauche ich eine Überweisung?“ ist eine Frage, keine Weiterleitung", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Brauche ich eine Überweisung?"), deps);
  assert.match(r.reply, /keine Voraussetzung/);
  assert.equal(calls.callback.length, 0);
  assert.equal(r.form, undefined);
});

// ------------------------------------------- Übergabe und Weiterleitung

test("Rezeptwunsch führt zum Rückruf-Formular, nicht zu einer Auskunft", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich brauche ein Folgerezept"), deps);
  assert.match(r.reply, /Rezepte, Krankschreibungen/);
  assert.equal(r.form?.id, "callback");
  assert.equal(r.state.callbackKind, "folgerezept");
  assert.equal(r.flags.handover, true);
});

test("Rückruf wird angelegt und mit Referenz bestätigt", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(click(null, "callback"), deps);
  assert.equal(r.form?.id, "callback");
  const done = await o.runTurn(
    form(r.state, "callback", { kind: "rueckruf", firstName: "Max", lastName: "Muster", phone: "040 123456", preferredTime: "vormittags" }),
    deps,
  );
  assert.equal(calls.callback.length, 1);
  assert.equal(calls.callback[0].preferredTime, "vormittags");
  assert.equal(calls.callback[0].locale, "de");
  assert.match(done.reply, /AN-7T2M/);
  assert.equal(done.state.stage, "done");
});

test("Wunsch nach einem Menschen: Telefon, Sprechzeiten, Rückruf", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich möchte mit einem Menschen sprechen"), deps);
  assert.equal(r.flags.handover, true);
  assert.match(r.reply, /040 490 80 21/);
  assert.match(r.reply, /Sprechzeiten: /);
  assert.deepEqual(r.quick?.map((q) => q.id), ["callback"]);
});

test("Zweimal nicht verstanden führt zur Übergabe", async () => {
  const { deps } = makeDeps();
  const first = await o.runTurn(msg(null, "Sagen Sie Herrn Meier viele Grüße."), deps);
  assert.equal(first.state.failures, 1);
  assert.equal(first.flags.handover, undefined);
  const second = await o.runTurn(msg(first.state, "Sagen Sie Herrn Meier viele Grüße."), deps);
  assert.equal(second.flags.handover, true);
  assert.match(second.reply, /040 490 80 21/);
});

// ------------------------------------------------------------ Sprache

test("Englische Nachricht bekommt eine englische Antwort", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Hello, when are you open?"), deps);
  assert.equal(r.lang, "en");
  assert.match(r.reply, /^Opening hours: /);
  assert.ok(!r.reply.includes("Sprechzeiten"));
});

test("Englische Buchung trägt die Sprache bis in die Buchung", async () => {
  const { deps, calls } = makeDeps();
  let r = await o.runTurn(msg(null, "I would like to book an appointment please"), deps);
  assert.equal(r.lang, "en");
  assert.equal(r.state.stage, "type");
  r = await o.runTurn(click(r.state, "type:kontrolle"), deps);
  r = await o.runTurn(click(r.state, `date:${DIENSTAG}`), deps);
  r = await o.runTurn(click(r.state, `time:${DIENSTAG}|09:00`), deps);
  assert.match(r.reply, /^Yes, 09:00 on Tuesday, 14 July 2026 is available\./);
  r = await o.runTurn(form(r.state, "contact", KONTAKT), deps);
  assert.match(r.reply, /Shall I book this bindingly\?$/);
  const done = await o.runTurn(msg(r.state, "yes"), deps);
  assert.equal(calls.book.length, 1);
  assert.equal(calls.book[0].locale, "en");
  assert.match(done.reply, /^Booked: /);
});

// ------------------------------------------------------------ Zustand

test("Ein manipulierter Zustand wird verworfen, nicht befolgt", async () => {
  const { deps, calls } = makeDeps();
  const gefaelscht = {
    v: 1,
    lang: "fr",
    stage: "confirm",
    intent: null,
    draft: { typeId: "kontrolle", date: DIENSTAG, time: "09:00", contact: { firstName: "X", lastName: "Y", email: "x@y.invalid" } },
    lastOffer: [],
    callbackKind: null,
    failures: 0,
    turns: 0,
  };
  const r = await o.runTurn(msg(gefaelscht, "ja"), deps);
  assert.equal(calls.book.length, 0, "aus einem kaputten Zustand wird nicht gebucht");
  assert.equal(r.state.stage, "idle");
  assert.equal(r.state.draft.contact, null);
});

test("„Ist Dienstag 14:30 frei?“ ohne gewählte Terminart antwortet und fragt nach", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Ist Dienstag 14:30 frei?"), deps);
  assert.match(r.reply, /^Nein, 14:30 Uhr ist belegt – frei sind 07:00, 07:30 und 08:00 Uhr\./);
  assert.match(r.reply, /Worum geht es bei dem Termin\?$/);
  assert.equal(r.state.stage, "type");
});

test("Freie Zeit im Freitext: klare Zusage", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Ist Dienstag 09:00 frei?"), deps);
  assert.match(r.reply, /^Ja, 09:00 Uhr am Dienstag, 14\. Juli 2026 ist frei\./);
});

test("Jede Antwort bleibt kurz: höchstens drei Sätze", async () => {
  const { deps } = makeDeps();
  const antworten = [];
  antworten.push(await o.runTurn(msg(null, "Wann haben Sie geöffnet?"), deps));
  antworten.push(await o.runTurn(click(null, "book"), deps));
  antworten.push(await o.runTurn(msg(null, "Wie komme ich zu Ihnen?"), deps));
  antworten.push(await o.runTurn(msg(null, "Haben Sie Parkplätze?"), deps));
  for (const a of antworten) {
    const saetze = a.reply.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(saetze.length <= 3, `zu lang: ${a.reply}`);
  }
});
