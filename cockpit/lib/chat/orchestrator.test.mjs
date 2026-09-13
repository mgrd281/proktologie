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

import { DIENSTAG, HOURS_DE, KONTAKT, SLOTS, click, form, makeDeps, msg, stateAt } from "./testkit.mjs";

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
  // Zeiten zum Anklicken – und ein Ausweg auf einen anderen Tag.
  assert.ok(r.quick.filter((q) => q.id.startsWith("time:")).length > 0);
  assert.ok(r.quick.every((q) => q.id.startsWith("time:") || ["changeDate", "later", "earlier"].includes(q.id)));
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
});

test("Gesundheitsangaben: Hinweis, kein Modellaufruf, keine Weitergabe", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Es juckt seit drei Tagen"), deps);
  assert.match(r.reply, /keine gesundheitlichen Details/);
  assert.match(r.reply, /nicht weitergegeben/);
  assert.equal(calls.classify.length, 0);
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
  const sent = JSON.stringify(calls.classify);
  for (const secret of ["Erika", "Musterfrau", "erika@example.invalid", "040 123456"]) {
    assert.ok(!sent.includes(secret), `„${secret}“ darf das Modell nicht erreichen`);
  }
});

// ------------------------------------------------------ Praxisfragen

test("Öffnungszeiten kommen aus den Fakten, auch ohne Modell", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(click(null, "hours"), deps);
  assert.match(r.reply, new RegExp(HOURS_DE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(r.flags.llm, "none", "Schaltflächen brauchen kein Modell");
});

test("Eine Wissensfrage wird sofort aus den eigenen Fakten beantwortet – ohne jedes Modell", async () => {
  // Früher lief hier ein Umformulierungsaufruf, der diesen fertigen Satz nur
  // noch einmal in andere Worte fassen sollte: live gemessen 9 bis 16
  // Sekunden, danach meist verworfen. Die Zusage lautet jetzt: Was der
  // Automat weiß, sagt er sofort.
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Wann haben Sie geöffnet?"), deps);
  assert.match(r.reply, /Sprechzeiten: /);
  assert.equal(r.flags.llm, "none", "kein Modell auf der Antwortstrecke");
  assert.equal(calls.classify.length, 0);
  assert.equal(deps.phrase, undefined, "es gibt keine Umformulierung mehr");
});

test("Was die Praxis nicht hinterlegt hat, wird nicht erfunden", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Haben Sie Parkplätze?"), deps);
  assert.match(r.reply, /Das weiß ich leider nicht/);
  assert.match(r.reply, /040 490 80 21/);
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

test("Gewählte Sprache Englisch, deutsche Frage: die Sprechzeiten kommen trotzdem – auf Englisch", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn({ ...msg(null, "Wann haben Sie geöffnet?"), lang: "en" }, deps);
  assert.equal(r.lang, "en");
  assert.match(r.reply, /^Opening hours: /);
  assert.equal(calls.classify.length, 0);
});

// --------------------------------------------- Verstehen (Stufe 2, 2B)

test("„So früh wie möglich“ ist ein Satz und ein Klick", async () => {
  const { deps, calls } = makeDeps();
  let r = await o.runTurn(click(null, "type:kontrolle"), deps);
  r = await o.runTurn(msg(r.state, "So früh wie möglich bitte"), deps);
  assert.equal(calls.nextFree.length, 1, "der früheste Platz wird gefragt");
  assert.equal(calls.nextFree[0].fenster, null);
  assert.match(r.reply, /^Der früheste freie Termin ist /);
  const nehmen = r.quick?.find((q) => q.label === "Ja, diesen nehmen");
  assert.ok(nehmen, "ein Knopf, der den Termin nimmt");

  // Ein Klick weiter steht das Kontaktformular – ohne Tag und Uhrzeit zu tippen.
  const weiter = await o.runTurn(click(r.state, nehmen.id), deps);
  assert.equal(weiter.state.stage, "contact");
  assert.equal(weiter.form?.id, "contact");
  assert.equal(calls.book.length, 0);
});

test("„am liebsten vormittags“ schränkt die Suche ein, statt sie zu verwerfen", async () => {
  const { deps, calls } = makeDeps();
  const start = await o.runTurn(click(null, "type:kontrolle"), deps);
  await o.runTurn(msg(start.state, "Ich nehme den ersten freien Termin, am liebsten vormittags"), deps);
  assert.deepEqual(calls.nextFree.at(-1).fenster, { from: "07:00", to: "12:00" });
});

test("Ein Tagesteil ohne Tag ist trotzdem eine Auskunft wert", async () => {
  const { deps, calls } = makeDeps();
  const start = await o.runTurn(click(null, "type:kontrolle"), deps);
  await o.runTurn(msg(start.state, "Lieber nachmittags"), deps);
  assert.deepEqual(calls.availability.at(-1).fenster, { from: "12:00", to: "18:00" });
});

test("„gibt es was später?“ blättert weiter, statt dieselbe Liste zu wiederholen", async () => {
  const { deps, calls } = makeDeps();
  const state = stateAt("time", "de", { typeId: "kontrolle", date: DIENSTAG });
  const r = await o.runTurn(msg(state, "gibt es was später?"), deps);
  assert.equal(calls.availability.at(-1).seite, 2);
  assert.equal(calls.availability.at(-1).datum, DIENSTAG);
  // Gibt es keine spätere Seite, wird das gesagt statt so getan.
  assert.match(r.reply, /Später ist an dem Tag nichts mehr frei\./);
});

test("Eine angeklickte Uhrzeit hebt ein früheres Fenster auf", async () => {
  const { deps, calls } = makeDeps();
  const state = stateAt("time", "de", { typeId: "kontrolle", date: DIENSTAG, window: { from: "14:00", to: "18:00" } });
  await o.runTurn(click(state, `time:${DIENSTAG}|07:30`), deps);
  assert.equal(calls.availability.at(-1).fenster, null, "sonst hieße es fälschlich „belegt“");
  assert.equal(calls.availability.at(-1).uhrzeit, "07:30");
});

test("Am Wochenende ist zu – und der Assistent bietet einen Werktag an", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Geht auch am Samstag?"), deps);
  assert.match(r.reply, /Am Wochenende ist die Praxis geschlossen\./);
  assert.match(r.reply, /Freitag oder ein Montag/);
  assert.equal(calls.book.length, 0);
});

test("Ein Tippfehler kostet keinen Termin", async () => {
  const { deps, calls } = makeDeps();
  const start = await o.runTurn(click(null, "type:kontrolle"), deps);
  await o.runTurn(msg(start.state, "Termin am Donerstag bitte"), deps);
  assert.equal(calls.availability.at(-1).datum, "2026-07-16", "Donnerstag, trotz fehlendem n");
});

test("Eine Leistungsfrage ist keine Gesundheitsangabe", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Machen Sie eine komplette Darmspiegelung?"), deps);
  assert.match(r.reply, /Darmspiegelung kooperieren wir/);
  assert.ok(!r.reply.includes("keine gesundheitlichen Details"), "keine Ermahnung");
  assert.equal(calls.book.length, 0);

  // Eine Schilderung derselben Sache bleibt eine Gesundheitsangabe.
  const s = await o.runTurn(msg(null, "Ich hatte letztes Jahr eine Darmspiegelung mit Polypen"), deps);
  assert.match(s.reply, /keine gesundheitlichen Details|Bitte schreiben Sie hier keine/);
});

test("Eine Leistungsfrage wird beantwortet, erreicht aber kein Modell", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Machen Sie eine komplette Darmspiegelung?"), deps);
  assert.match(r.reply, /Darmspiegelung kooperieren wir/);
  assert.equal(calls.classify.length, 0, "keine Einordnung");
  assert.equal(r.flags.llm, "none");
});

test("Frage und Terminwunsch in einem Satz: beides wird beantwortet", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Ich hätte gern einen Termin, und wie komme ich zu Ihnen?"), deps);
  assert.match(r.reply, /Christuskirche/, "die Frage wird beantwortet");
  assert.equal(r.state.intent, "booking", "und die Buchung beginnt trotzdem");
});

test("Die Termindauer kommt aus der Datenbank, nicht aus einem festen Satz", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Wie lange dauert ein Termin?"), deps);
  assert.match(r.reply, /\d+ bis \d+ Minuten/);
  assert.notEqual(r.state.intent, "booking");
});

// ---------------------------------------------------------- Sprachkanal

const voice = (state, message) => msg(state, message, { channel: "voice" });
const vclick = (state, id) => ({ ...click(state, id), channel: "voice" });

/** Ein Dienstag mit Vormittag UND Nachmittag – nur dann ist „vormittags oder nachmittags?“ eine Wahl. */
const PM = ["14:00", "14:30", "15:00"];
function voiceDeps(over = {}) {
  const ALL = [...SLOTS, ...PM];
  return makeDeps({
    availability: async (args) => {
      const win = (list) => (args.fenster ? list.filter((x) => x >= args.fenster.from && x < args.fenster.to) : list);
      if (!args.datum) return { kind: "next_days", days: [{ date: DIENSTAG, slots: win(ALL).slice(0, 3) }] };
      if (args.uhrzeit) {
        return ALL.includes(args.uhrzeit)
          ? { kind: "time_free", date: args.datum, time: args.uhrzeit }
          : { kind: "time_taken", date: args.datum, time: args.uhrzeit, alternatives: ALL.slice(0, 3) };
      }
      const all = win(ALL);
      if (all.length === 0) return { kind: "day_empty", date: args.datum, nextDays: [] };
      const pages = Math.max(1, Math.ceil(all.length / 5));
      const page = Math.min(pages, Math.max(1, Math.trunc(args.seite ?? 1)));
      return { kind: "day_slots", date: args.datum, slots: all.slice((page - 1) * 5, page * 5), total: all.length, page, hasMore: page < pages, hasEarlier: page > 1, window: args.fenster ?? null };
    },
    ...over,
  });
}

test("Sprachkanal: ein Wortfetzen bleibt still – der Textkanal antwortet darauf wie immer", async () => {
  const { deps, calls } = makeDeps();
  let r = await o.runTurn(voice(null, "Wochen."), deps);
  assert.equal(r.flags.silent, true);
  assert.equal(r.reply, "");
  assert.equal(r.state.failures, 1);
  assert.ok(calls.audit.some(([e]) => e === "chat.voice_aside"));
  r = await o.runTurn(voice(r.state, "In Freiburg online."), deps);
  assert.equal(r.flags.silent, true);
  assert.equal(r.state.failures, 2);
  // Nach zwei stillen Runden sagt der Automat wieder etwas.
  r = await o.runTurn(voice(r.state, "Und dann noch."), deps);
  assert.notEqual(r.flags.silent, true);
  assert.ok(r.reply.length > 0);
  // Ein echter Wunsch war nie still.
  const wish = await o.runTurn(voice(null, "Ich hätte gern einen Termin am Dienstag"), deps);
  assert.notEqual(wish.flags.silent, true);
  // Getippt bekommt derselbe Fetzen sofort eine Antwort.
  const typed = await o.runTurn(msg(null, "Wochen."), deps);
  assert.notEqual(typed.flags.silent, true);
  assert.ok(typed.reply.length > 0);
});

test("Sprachkanal: die ganze Buchung im Gespräch – Fenster, Name, E-Mail zurückgelesen, Telefon, Notiz, klares Ja", async () => {
  const { deps, calls } = voiceDeps();
  let r = await o.runTurn(voice(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.match(r.reply, /Dienstag, 14\. Juli 2026 – lieber vormittags oder nachmittags\?/);
  assert.deepEqual(r.quick?.map((q) => q.id), ["vormittags", "nachmittags", "egal"]);
  assert.equal(r.state.stage, "time");

  r = await o.runTurn(voice(r.state, "Vormittags bitte."), deps);
  assert.doesNotMatch(r.reply, /vormittags oder nachmittags/);
  assert.match(r.reply, /07:00/);

  r = await o.runTurn(voice(r.state, "Um 8 Uhr bitte."), deps);
  assert.equal(r.state.stage, "contact");
  assert.equal(r.state.draft.contactStep, "name");
  assert.equal(r.form, undefined, "gesprochen gibt es kein Formular");
  assert.match(r.reply, /Wie heißen Sie – Vor- und Nachname\?/);

  r = await o.runTurn(voice(r.state, "Ich heiße Erika Musterfrau."), deps);
  assert.equal(r.state.draft.contactStep, "email");
  assert.deepEqual(r.state.draft.pending, { firstName: "Erika", lastName: "Musterfrau" });
  assert.match(r.reply, /E-Mail-Adresse/);

  r = await o.runTurn(voice(r.state, "erika ät example punkt invalid"), deps);
  assert.equal(r.state.draft.contactStep, "emailConfirm");
  assert.match(r.reply, /erika@example\.invalid – ist das richtig\?/);
  assert.deepEqual(r.quick?.map((q) => q.id), ["correct", "wrong"]);

  // „Nein" – noch einmal; dann der Knopf „Richtig".
  r = await o.runTurn(voice(r.state, "Nein."), deps);
  assert.equal(r.state.draft.contactStep, "email");
  r = await o.runTurn(voice(r.state, "Erika at example punkt invalid."), deps);
  assert.equal(r.state.draft.contactStep, "emailConfirm");
  r = await o.runTurn(vclick(r.state, "correct"), deps);
  assert.equal(r.state.draft.contactStep, "phone");
  assert.match(r.reply, /Handynummer/);

  r = await o.runTurn(voice(r.state, "Null vier null, eins zwei drei vier fünf sechs."), deps);
  assert.equal(r.state.draft.contactStep, "note");
  assert.equal(r.state.draft.pending.phone, "040123456");

  r = await o.runTurn(voice(r.state, "Es ist ein Erstbesuch."), deps);
  assert.equal(r.state.stage, "confirm");
  assert.equal(r.state.draft.contactStep, null);
  assert.equal(r.state.draft.consent, "voice", "die Zusammenfassung trägt den Einwilligungssatz");
  assert.equal(r.state.draft.note, "Es ist ein Erstbesuch.");
  assert.match(r.reply, /Kontrolltermin am Dienstag, 14\. Juli 2026 um 08:00 Uhr für Erika Musterfrau \(erika@example\.invalid\)\./);
  assert.match(r.reply, /Mit „Ja“ stimmen Sie zu/);
  assert.equal(calls.book.length, 0);

  // „Okay" ist kein Ja – gesprochen bucht nur die geschlossene Liste.
  r = await o.runTurn(voice(r.state, "Okay."), deps);
  assert.equal(calls.book.length, 0);
  assert.match(r.reply, /deutlich „Ja“/);
  assert.equal(r.state.stage, "confirm");

  r = await o.runTurn(voice(r.state, "Ja bitte."), deps);
  assert.equal(calls.book.length, 1);
  assert.deepEqual(calls.book[0], {
    typeId: "kontrolle",
    date: DIENSTAG,
    time: "08:00",
    firstName: "Erika",
    lastName: "Musterfrau",
    email: "erika@example.invalid",
    phone: "040123456",
    locale: "de",
    note: "Es ist ein Erstbesuch.",
  });
  assert.equal(r.state.stage, "done");
  assert.equal(r.state.draft.consent, "voice", "die Einwilligung bleibt für einen zweiten Termin in derselben Sitzung");
});

test("Sprachkanal: eine zweimal unverständliche E-Mail-Adresse geht ehrlich ans Formular", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "email", pending: { firstName: "Erika", lastName: "Musterfrau" } } };
  let r = await o.runTurn(voice(st, "keine Ahnung"), deps);
  assert.equal(r.state.draft.contactStep, "email");
  assert.equal(r.state.failures, 1);
  assert.match(r.reply, /noch einmal langsam/);
  r = await o.runTurn(voice(r.state, "irgendwas"), deps);
  assert.equal(r.form?.id, "contact");
  assert.equal(r.state.draft.contactStep, null);
  assert.match(r.reply, /Tippen Sie/);
});

test("Sprachkanal: eine Notiz mit Gesundheitsangaben wird nicht gespeichert – gebucht wird trotzdem, ohne sie", async () => {
  const { deps, calls } = makeDeps();
  const base = stateAt("contact");
  const st = {
    ...base,
    draft: { ...base.draft, time: "09:00", contactStep: "note", pending: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" } },
  };
  let r = await o.runTurn(voice(st, "Ich habe seit Wochen Blut im Stuhl."), deps);
  assert.equal(r.state.stage, "confirm");
  assert.equal(r.state.draft.note, null);
  assert.match(r.reply, /nicht gespeichert/);
  assert.ok(calls.audit.some(([e]) => e === "chat.note_dropped"));
  r = await o.runTurn(voice(r.state, "Ja."), deps);
  assert.equal(calls.book.length, 1);
  assert.equal("note" in calls.book[0], false, "ohne Notiz sieht der Aufruf aus wie im Textkanal");
});

test("Sprachkanal: „egal“ auf die Fensterfrage listet den Tag – und fragt nicht noch einmal", async () => {
  const { deps } = voiceDeps();
  let r = await o.runTurn(voice(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.match(r.reply, /vormittags oder nachmittags/);
  r = await o.runTurn(voice(r.state, "Das ist mir egal."), deps);
  assert.notEqual(r.flags.silent, true, "eine Antwort auf die eigene Frage ist nie still");
  assert.doesNotMatch(r.reply, /vormittags oder nachmittags/);
  assert.match(r.reply, /07:00/);
  assert.notEqual(r.flags.handover, true);
  // Und als Knopf.
  let k = await o.runTurn(voice(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.match(k.reply, /vormittags oder nachmittags/);
  k = await o.runTurn(vclick(k.state, "egal"), deps);
  assert.doesNotMatch(k.reply, /vormittags oder nachmittags/);
  assert.match(k.reply, /07:00/);
});

test("Sprachkanal: steht schon das Formular und die Patientin spricht, beginnt das Gespräch beim Namen", async () => {
  const { deps } = makeDeps();
  const st = stateAt("contact");
  // Ein Fetzen wird nicht zum Vornamen – er bleibt still, das Formular steht.
  let r = await o.runTurn(voice(st, "Wochen."), deps);
  assert.equal(r.flags.silent, true);
  assert.equal(r.state.draft.contactStep ?? null, null);
  r = await o.runTurn(voice(r.state, "Hm."), deps);
  assert.equal(r.flags.silent, true);
  // Nach zwei stillen Runden wird gefragt.
  r = await o.runTurn(voice(r.state, "Äh."), deps);
  assert.equal(r.state.draft.contactStep, "name");
  assert.match(r.reply, /Wie heißen Sie/);
  // Ein voller Name gilt sofort.
  r = await o.runTurn(voice(st, "Ich heiße Erika Musterfrau"), deps);
  assert.equal(r.state.draft.contactStep, "email");
  // Andere Absichten gehen ihren Weg – wie getippt.
  const hand = await o.runTurn(voice(st, "Ich möchte mit einem Menschen sprechen."), deps);
  assert.equal(hand.flags.handover, true);
  assert.equal(hand.state.draft.contactStep ?? null, null);
  const day = await o.runTurn(voice(st, "Lieber am Mittwoch."), deps);
  assert.equal(day.state.draft.contactStep ?? null, null);
  assert.equal(day.state.draft.date, "2026-07-15");
  // Getippt bleibt das Formular der Weg.
  const typed = await o.runTurn(msg(st, "Erika Musterfrau"), deps);
  assert.equal(typed.state.draft.contactStep ?? null, null);
});

test("Einwilligung: das Formular zeichnet sie auf – ein Zustand von davor bucht weiter, weil damals nur das Formular Kontaktdaten setzte", async () => {
  const { deps, calls } = makeDeps();
  const summary = await bisZurBestaetigung(deps);
  assert.equal(summary.state.draft.consent, "form");
  // Ein Browser mit dem Zustand der Vorversion: Kontakt da, Feld fehlt.
  const legacy = stateAt("confirm");
  delete legacy.draft.consent;
  const r = await o.runTurn(msg(legacy, "ja"), deps);
  assert.equal(calls.book.length, 1);
  assert.equal(r.state.draft.consent, "form");
});

test("Sprachkanal: eine Gesundheitsangabe wird nie zum Namen – Hinweis, und die Frage kommt noch einmal", async () => {
  const { deps, calls } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "name", pending: null } };
  let r = await o.runTurn(voice(st, "Ich habe starke Schmerzen."), deps);
  assert.equal(r.state.draft.contactStep, "name");
  assert.equal(r.state.draft.pending, null, "nichts davon wird übernommen");
  assert.match(r.reply, /rufen Sie bitte zuerst an/);
  assert.match(r.reply, /Wie heißen Sie/);
  assert.ok(calls.audit.some(([e]) => e === "chat.health_filtered"));
  // Auch beim Nachnamen.
  r = await o.runTurn(voice({ ...st, draft: { ...st.draft, contactStep: "lastName", pending: { firstName: "Erika" } } }, "Hämorrhoiden"), deps);
  assert.equal(r.state.draft.contactStep, "lastName");
  assert.deepEqual(r.state.draft.pending, { firstName: "Erika" });
  assert.match(r.reply, /Ihr Nachname/);
});

test("Sprachkanal: Akutes in der Notiz wird verworfen – und der Anruf-Hinweis kommt dazu", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "note", pending: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" } } };
  const r = await o.runTurn(voice(st, "Ich habe seit gestern sehr starke Schmerzen, es ist dringend."), deps);
  assert.equal(r.state.stage, "confirm");
  assert.equal(r.state.draft.note, null);
  assert.match(r.reply, /nicht gespeichert/);
  assert.match(r.reply, /rufen Sie bitte zuerst an/);
});

test("Eine Notiz im mitgeschickten Zustand wird an der Speichergrenze gefiltert – nicht nur dort, wo sie entsteht", async () => {
  const { deps, calls } = makeDeps();
  const st = stateAt("confirm");
  st.draft.note = "Ich habe seit Wochen Blut im Stuhl";
  const r = await o.runTurn(msg(st, "ja"), deps);
  assert.equal(calls.book.length, 1);
  assert.equal("note" in calls.book[0], false);
  assert.ok(calls.audit.some(([e]) => e === "chat.note_dropped"));
  assert.equal(r.state.stage, "done");
  // Eine saubere Notiz kommt an.
  const { deps: d2, calls: c2 } = makeDeps();
  const ok = stateAt("confirm");
  ok.draft.note = "Erstbesuch";
  await o.runTurn(msg(ok, "ja"), d2);
  assert.equal(c2.book[0].note, "Erstbesuch");
});

test("Sprachkanal: die Fensterfrage kommt nur, wenn der Tag beide Hälften hat – sonst gleich die Auskunft", async () => {
  // Nur Vormittag (die Bühne von testkit): keine Frage, gleich die Zeiten.
  const { deps } = makeDeps();
  let r = await o.runTurn(voice(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.doesNotMatch(r.reply, /vormittags oder nachmittags/);
  assert.match(r.reply, /07:00/);
  // Leerer Tag: sofort die ehrliche Auskunft, kein Fensterfrage-Umweg.
  const { deps: leer } = makeDeps({ availability: async (args) => (args.datum ? { kind: "day_empty", date: args.datum, nextDays: [] } : { kind: "next_days", days: [] }) });
  r = await o.runTurn(voice(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), leer);
  assert.doesNotMatch(r.reply, /vormittags oder nachmittags/);
  assert.match(r.reply, /nichts frei/i);
});

test("Sprachkanal: Blättern nach einer getippten Liste wird nicht von der Fensterfrage gekapert", async () => {
  const { deps } = voiceDeps();
  let r = await o.runTurn(msg(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.match(r.reply, /07:00/);
  r = await o.runTurn(vclick(r.state, "later"), deps);
  assert.doesNotMatch(r.reply, /vormittags oder nachmittags/);
  assert.match(r.reply, /14:00/);
});

test("Sprachkanal: Übergabe- und Weiterleitungswünsche sind nie still", async () => {
  const { deps } = makeDeps();
  const hand = await o.runTurn(voice(null, "Mit einem Mitarbeiter sprechen."), deps);
  assert.notEqual(hand.flags.silent, true);
  assert.equal(hand.flags.handover, true);
  const fwd = await o.runTurn(voice(null, "Folgerezept."), deps);
  assert.notEqual(fwd.flags.silent, true);
});

test("Sprachkanal: im Namensschritt ist ein Fetzen kein Vorname, ein Nein kein Nachname, „Ja, Erika Musterfrau“ ein Name", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "name", pending: null } };
  let r = await o.runTurn(voice(st, "Wochen."), deps);
  assert.equal(r.state.draft.contactStep, "name");
  assert.match(r.reply, /nicht verstanden/);
  r = await o.runTurn(voice(st, "Ja, Erika Musterfrau."), deps);
  assert.deepEqual(r.state.draft.pending, { firstName: "Erika", lastName: "Musterfrau" });
  // Nachname-Schritt: „Nein.“ heißt von vorn.
  r = await o.runTurn(voice({ ...st, draft: { ...st.draft, contactStep: "lastName", pending: { firstName: "Wochen" } } }, "Nein."), deps);
  assert.equal(r.state.draft.contactStep, "name");
  assert.equal(r.state.draft.pending, null);
  // „Ich möchte abbrechen.“ ist ein Abbruch, kein Name.
  r = await o.runTurn(voice(st, "Ich möchte doch abbrechen."), deps);
  assert.equal(r.state.draft.contactStep ?? null, null);
  assert.match(r.reply, /ändern/);
  // Und ein langer Name mit Zusatz geht.
  r = await o.runTurn(voice(st, "Anna Maria von der Heide"), deps);
  assert.deepEqual(r.state.draft.pending, { firstName: "Anna Maria", lastName: "von der Heide" });
});

test("Sprachkanal: nach zwei Fehlversuchen bei Name oder Rückfrage geht es ans Formular – der Zähler läuft nie über", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "name", pending: null } };
  let r = await o.runTurn(voice(st, "Wochen."), deps);
  assert.equal(r.state.failures, 1);
  r = await o.runTurn(voice(r.state, "Und dann."), deps);
  assert.equal(r.form?.id, "contact");
  assert.equal(r.state.failures, 0);
  assert.equal(r.state.draft.contactStep, null);
  // Rückfrage zur E-Mail: zweimal Unsinn → Formular, nicht Endlosschleife.
  const conf = { ...st, draft: { ...st.draft, contactStep: "emailConfirm", pending: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" } } };
  r = await o.runTurn(voice(conf, "Wochen."), deps);
  assert.equal(r.state.draft.contactStep, "emailConfirm");
  r = await o.runTurn(voice(r.state, "Und dann."), deps);
  assert.equal(r.form?.id, "contact");
  // Stille deckelt den Zähler ebenfalls.
  let sil = { ...stateAt("idle"), failures: 9 };
  sil = { ...sil, stage: "idle" };
  const q = await o.runTurn(voice(sil, "Hallo, ich hätte gern einen Termin"), deps);
  assert.ok(q.state.failures <= 9);
});

test("Sprachkanal: „Ja, das ist richtig“ bestätigt die Adresse – „Nein, es ist …“ ersetzt sie", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const conf = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "emailConfirm", pending: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" } } };
  let r = await o.runTurn(voice(conf, "Ja, das ist richtig."), deps);
  assert.equal(r.state.draft.contactStep, "phone");
  r = await o.runTurn(voice(conf, "Nein, es ist erika punkt m at example punkt invalid"), deps);
  assert.equal(r.state.draft.contactStep, "emailConfirm");
  assert.equal(r.state.draft.pending.email, "erika.m@example.invalid");
});

test("Sprachkanal: „Ja“ auf die Notizfrage ist keine Notiz – es wird nach dem Inhalt gefragt", async () => {
  const { deps } = makeDeps();
  const base = stateAt("contact");
  const st = { ...base, draft: { ...base.draft, time: "09:00", contactStep: "note", pending: { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid" } } };
  let r = await o.runTurn(voice(st, "Ja."), deps);
  assert.equal(r.state.draft.contactStep, "note");
  assert.match(r.reply, /was möchten Sie/);
  r = await o.runTurn(voice(r.state, "Es ist ein Erstbesuch."), deps);
  assert.equal(r.state.stage, "confirm");
  assert.equal(r.state.draft.note, "Es ist ein Erstbesuch.");
});

// ------------------------------- Lieferung 6: verstehen und nicht warten

test("„Wann habt ihr Termine frei?“ bekommt freie Zeiten – nicht die Gegenfrage nach einem Tag", async () => {
  // Der Befund aus dem Chat des Betreibers: Mit einer längst bekannten
  // Terminart antwortete der Automat „Notiert: Analfistel. Für welchen Tag
  // darf ich nachsehen?“ – zweimal wortgleich.
  const { deps, calls } = makeDeps();
  const base = stateAt("date");
  const st = { ...base, draft: { ...base.draft, typeId: "analfistel", date: null } };
  const r = await o.runTurn(msg(st, "Wann habt ihr Termine frei?"), deps);
  assert.doesNotMatch(r.reply, /Notiert:/, "was längst bekannt ist, wird nicht noch einmal vorgelesen");
  assert.doesNotMatch(r.reply, /Für welchen Tag/, "die Frage war nach freien Zeiten, nicht nach einem Tag");
  assert.match(r.reply, /früheste freie Termin/);
  assert.equal(calls.nextFree.length, 1);
  assert.equal(calls.nextFree[0].art, "analfistel", "und zwar für die bekannte Terminart");
  assert.equal(calls.classify.length, 0, "ohne Modell");
  assert.equal(r.flags.llm, "none");
});

test("Dieselbe Frage ohne bekannte Terminart: erst die früheste Zeit, dann die Terminart", async () => {
  const { deps, calls } = makeDeps();
  for (const satz of ["Habt ihr was frei?", "Was habt ihr frei?", "Wann hättet ihr Zeit?", "Gibt es noch Termine?"]) {
    const r = await o.runTurn(msg(null, satz), deps);
    assert.match(r.reply, /früheste freie Termin/, satz);
    assert.match(r.reply, /Worum geht es/, satz);
    assert.equal(r.flags.llm, "none", satz);
  }
  assert.equal(calls.classify.length, 0, "kein einziger Modellaufruf für vier Sätze");
});

test("Ein genannter Tag gewinnt gegen die Verfügbarkeitsfrage", async () => {
  const { deps, calls } = makeDeps();
  await o.runTurn(msg(null, "Habt ihr am Dienstag was frei?"), deps);
  assert.equal(calls.nextFree.length, 0, "kein „frühester Termin überhaupt“");
  assert.ok(calls.availability.length > 0);
  assert.equal(calls.availability[0].datum, DIENSTAG);
});

test("„Wann habt ihr?“ ist mehrdeutig – also kommen Sprechzeit und früheste Zeit", async () => {
  const { deps, calls } = makeDeps();
  const r = await o.runTurn(msg(null, "Wann habt ihr?"), deps);
  assert.match(r.reply, new RegExp(HOURS_DE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(r.reply, /früheste freie Termin/);
  assert.equal(calls.classify.length, 0, "geraten wurde das früher vom Modell – jetzt nicht mehr");
});

test("Was die Praxis nicht hinterlegt hat, endet nicht in einer Sackgasse", async () => {
  const { deps } = makeDeps();
  const r = await o.runTurn(msg(null, "Haben Sie Parkplätze?"), deps);
  assert.match(r.reply, /Das weiß ich leider nicht/);
  assert.ok(
    r.quick.some((q) => q.id === "nextfree"),
    "der nächste freie Termin steht als Knopf daneben",
  );
});

test("Gepflegtes Wissen gewinnt gegen die schlichte Verfügbarkeitsfrage", async () => {
  // Befunde der eigenen Gegenprüfung: „opening" steckt in „opening hours",
  // „noch einen" in „noch einen anderen Arzt". Beides sind Fragen an die
  // Praxis – der Automat darf sie nicht in eine Terminsuche umdeuten.
  const { deps, calls } = makeDeps();
  const faelle = [
    ["What are your opening hours?", /Opening hours|Sprechzeiten/],
    ["Wie komme ich am schnellsten zu Ihnen?", /Christuskirche|Schäferkampsallee/],
    ["Gibt es noch einen anderen Arzt?", /Kunstreich/],
  ];
  for (const [satz, erwartet] of faelle) {
    const r = await o.runTurn(msg(null, satz), deps);
    assert.match(r.reply, erwartet, satz);
    assert.doesNotMatch(r.reply, /früheste freie Termin|earliest available/, satz);
  }
  assert.equal(calls.nextFree.length, 0, "keine einzige Terminsuche für drei Wissensfragen");
  // Ausdrücklich bleibt ausdrücklich: „so früh wie möglich" gewinnt weiterhin.
  const wunsch = await o.runTurn(msg(null, "Ich möchte so früh wie möglich einen Termin"), deps);
  assert.equal(calls.nextFree.length, 1);
  assert.match(wunsch.reply, /früheste freie Termin/);
});

test("„Haben Sie noch etwas Späteres?“ bleibt eine Bitte um spätere Zeiten", async () => {
  const { deps, calls } = makeDeps();
  let r = await o.runTurn(msg(null, "Ich hätte gern einen Kontrolltermin am Dienstag"), deps);
  assert.match(r.reply, /07:00/);
  r = await o.runTurn(msg(r.state, "Haben Sie noch etwas Späteres am selben Tag?"), deps);
  assert.equal(calls.nextFree.length, 0, "kein Sprung auf den frühesten Termin überhaupt");
  assert.equal(r.state.draft.date, DIENSTAG, "der gewählte Tag bleibt");
});
