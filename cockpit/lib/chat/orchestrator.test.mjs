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

import { DIENSTAG, HOURS_DE, KONTAKT, click, form, makeDeps, msg } from "./testkit.mjs";

const o = await import("./orchestrator.ts");

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
  assert.equal(back.state.stage, "confirm", "der Entwurf bleibt – gefragt wird, was sich ändern soll");
  assert.match(back.reply, /ändern/);
  assert.deepEqual(back.quick?.map((q) => q.id), ["changeDate", "changeTime", "changeType", "changeContact"]);
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
  const r = await o.runTurn(msg(null, "Es juckt seit drei Tagen"), deps);
  assert.match(r.reply, /keine gesundheitlichen Details/);
  assert.match(r.reply, /nicht weitergegeben/);
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.phrase.length, 0);
});

test("Terminart im Freitext genannt: keine Ermahnung, die Terminart gilt", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich glaube, ich habe Hämorrhoiden"), deps);
  assert.doesNotMatch(r.reply, /gesundheitlichen Details/);
  assert.equal(r.state.stage, "date");
  assert.equal(r.state.draft.typeId, "haemorrhoiden");
  assert.equal(calls.classify.length, 0);
});

test("Terminart mit Tag im Freitext: Tag bleibt erhalten, Hinweis nur bei weiteren Angaben", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich brauche einen Termin wegen Hämorrhoiden am Dienstag"), deps);
  assert.equal(r.state.draft.typeId, "haemorrhoiden");
  assert.equal(r.state.draft.date, DIENSTAG);
  assert.equal(r.state.stage, "time");
  assert.doesNotMatch(r.reply, /gesundheitlichen Details/);
  assert.equal(calls.availability.length, 1);

  // Mit echter Gesundheitsangabe: Wahl und Tag bleiben, der kurze Hinweis kommt dazu
  const { deps: d2, calls: c2 } = makeDeps();
  const r2 = await o.runTurn(msg(null, "Termin wegen Hämorrhoiden am Dienstag, es juckt seit Tagen"), d2);
  assert.equal(r2.state.draft.typeId, "haemorrhoiden");
  assert.equal(r2.state.draft.date, DIENSTAG);
  assert.match(r2.reply, /^Bitte schreiben Sie hier keine gesundheitlichen Details/);
  assert.equal(c2.classify.length, 0);
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

// ------------------------------------------------- Stufe 2: Korrekturen

test("Korrektur in der Bestätigung bucht nicht, sondern prüft die neue Zeit – Kontakt bleibt", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "ja aber um 8 Uhr"), deps);
  assert.equal(calls.book.length, 0, "eine Korrektur ist keine Zusage");
  assert.equal(r.state.stage, "confirm");
  assert.equal(r.state.draft.time, "08:00");
  assert.equal(r.state.draft.contact?.email, "erika@example.invalid", "niemand tippt seinen Namen zweimal");
  assert.match(r.reply, /08:00 Uhr/);
  assert.deepEqual(r.quick?.map((q) => q.id), ["yes", "no"]);

  const done = await o.runTurn(msg(r.state, "ja, bitte"), deps);
  assert.equal(calls.book.length, 1);
  assert.equal(calls.book[0].time, "08:00");
  assert.equal(done.state.stage, "done");
});

test("„ja, aber …“ ohne erkennbare Korrektur fragt, was sich ändern soll", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const r = await o.runTurn(msg(summary.state, "ja aber lieber etwas später"), deps);
  assert.equal(calls.book.length, 0);
  assert.equal(r.state.stage, "confirm");
  assert.match(r.reply, /ändern/);
  assert.deepEqual(r.quick?.map((q) => q.id), ["changeDate", "changeTime", "changeType", "changeContact"]);
  // „Andere Uhrzeit“ zeigt die Zeiten des gewählten Tages erneut
  const t2 = await o.runTurn(click(r.state, "changeTime"), deps);
  assert.equal(t2.state.stage, "time");
  assert.equal(t2.state.draft.date, DIENSTAG);
});

test("Nach der Buchung: Schaltflächen statt Sackgasse, zweiter Termin ohne Formular", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  const done = await o.runTurn(msg(summary.state, "ja"), deps);
  assert.deepEqual(done.quick?.map((q) => q.id), ["again", "myAppointment"]);
  assert.equal(done.state.draft.date, null, "der gebuchte Platz wird nicht erneut geprüft");
  assert.equal(done.state.draft.time, null);
  assert.equal(done.state.draft.contact?.firstName, "Erika");

  let r = await o.runTurn(click(done.state, "again"), deps);
  assert.equal(r.state.stage, "type");
  r = await o.runTurn(click(r.state, "type:nachsorge"), deps);
  r = await o.runTurn(msg(r.state, "Dienstag um 8 Uhr"), deps);
  assert.equal(r.state.stage, "confirm", "Kontakt bekannt: direkt die Zusammenfassung");
  assert.equal(r.form, undefined);
  assert.match(r.reply, /Erika Musterfrau/);
  await o.runTurn(msg(r.state, "ja"), deps);
  assert.equal(calls.book.length, 2);
  assert.equal(calls.book[1].typeId, "nachsorge");
  assert.equal(calls.book[1].time, "08:00");
});

test("„Ist ein Notfalltermin möglich?“ ist kein Notfall, sondern die Akut-Auskunft", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ist ein Notfalltermin möglich?"), deps);
  assert.equal(r.flags.emergency, undefined);
  assert.match(r.reply, /kurzfristig/);
  assert.match(r.reply, /040 490 80 21/);
  assert.equal(calls.classify.length, 0);
  // „kein Notfall, aber dringend“ ebenso
  const r2 = await o.runTurn(msg(null, "Es ist kein Notfall, aber ich bräuchte dringend einen Termin"), deps);
  assert.equal(r2.flags.emergency, undefined);
  assert.match(r2.reply, /^Bei akuten Beschwerden/);
  assert.equal(r2.state.stage, "type", "und danach geht es in die Buchung");
  // Das nackte Wort bleibt ein Notfall
  const r3 = await o.runTurn(msg(null, "Das ist ein Notfall"), deps);
  assert.equal(r3.flags.emergency, true);
});

test("Starke Beschwerden ohne Frage: Anruf-Hinweis statt Ermahnung, kein Modell", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich habe seit gestern starke Schmerzen"), deps);
  assert.match(r.reply, /^Bei akuten Beschwerden rufen Sie bitte zuerst an/);
  assert.doesNotMatch(r.reply, /gesundheitlichen Details/);
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.phrase.length, 0);
});

test("„Guten Morgen, ich hätte gern einen Termin“ fragt nach der Terminart, nicht nach morgen", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Guten Morgen, ich hätte gern einen Termin"), deps);
  assert.equal(r.state.stage, "type");
  assert.equal(r.state.draft.date, null);
  assert.equal(calls.availability.length, 0);
});

test("Terminverwaltung kapert keine Buchung: absagen, verschieben, „wann ist mein Termin“", async () => {
  const { deps, calls } = makeDeps();
  for (const s of ["Ich möchte meinen Termin absagen", "Termin verschieben", "Wann ist mein Termin?", "I need to cancel my appointment"]) {
    const r = await o.runTurn(msg(null, s), deps);
    assert.notEqual(r.state.stage, "type", `Buchung gestartet: ${s}`);
    assert.match(r.reply, /Bestätigungs-E-Mail|confirmation e-mail/, s);
    assert.ok(r.quick?.some((q) => q.id === "callback"), s);
  }
  assert.equal(calls.classify.length, 0);
});

test("Fragen mit „Termin“ werden aus dem Wissen beantwortet, nicht gebucht", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Wie kann ich einen Termin absagen?"), deps);
  assert.match(r.reply, /Bestätigungs-E-Mail/);
  assert.notEqual(r.state.stage, "type");
});

test("Fremdsprache: fester Satz in der Sprache, kein Modellaufruf, Schaltflächen bleiben", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Merhaba, randevu almak istiyorum"), deps);
  assert.match(r.reply, /Almanca veya İngilizce/);
  assert.equal(r.flags.foreign, "tr");
  assert.equal(r.lang, "de");
  assert.deepEqual(r.quick?.map((q) => q.id), ["book", "hours"]);
  assert.equal(r.quick?.[0].label, "Randevu al");
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.phrase.length, 0);

  // Notfall auf Türkisch → Notfallantwort auf Türkisch
  const e = await o.runTurn(msg(null, "Göğsümde şiddetli ağrı var, nefes alamıyorum"), deps);
  assert.equal(e.flags.emergency, true);
  assert.match(e.reply, /112/);
  assert.match(e.reply, /acil/i);
  assert.equal(calls.classify.length, 0);
});

test("Explizite Sprache gewinnt; Erkennung meldet sich nur ohne Vorgabe", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn({ ...msg(null, "Wann haben Sie geöffnet?"), lang: "en" }, deps);
  assert.equal(r.lang, "en");
  assert.equal(r.flags.langDetected, undefined);
  const r2 = await o.runTurn(msg(null, "When are you open?"), deps);
  assert.equal(r2.lang, "en");
  assert.equal(r2.flags.langDetected, true);
});
