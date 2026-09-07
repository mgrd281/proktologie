/**
 * Antworten aus gepflegten Fakten – und die Nachprüfung, die erfundene
 * Zahlen abfängt.
 *
 * Ausführen:  node --test lib/chat/knowledge.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { findTopics, answerFromFacts, groundingCheck, formatHours } = await import("./knowledge.ts");
const { PRAXIS_WISSEN, unknownTopics } = await import("../../content/praxis-wissen.ts");

// Die echten Sprechzeiten der Praxis, wie sie in der Datenbank stehen
const HOURS = [
  { weekday: 1, opens: "07:00", closes: "12:00" },
  { weekday: 2, opens: "07:00", closes: "12:00" },
  { weekday: 2, opens: "14:00", closes: "18:00" },
  { weekday: 3, opens: "07:00", closes: "12:00" },
  { weekday: 4, opens: "07:00", closes: "12:00" },
  { weekday: 4, opens: "14:00", closes: "18:00" },
  { weekday: 5, opens: "07:00", closes: "12:00" },
];
const live = { hoursText: formatHours(HOURS, "de"), banner: null };

test("Sprechzeiten werden gebündelt, nicht als sieben Zeilen", () => {
  const de = formatHours(HOURS, "de");
  assert.match(de, /Mo, Mi, Fr 07:00–12:00/);
  assert.match(de, /Di, Do 07:00–12:00, 14:00–18:00/);
  assert.match(de, /Uhr$/);
  const en = formatHours(HOURS, "en");
  assert.match(en, /Mon, Wed, Fri 07:00–12:00/);
  assert.ok(!en.endsWith("Uhr"));
  // Ohne Zeilen: ehrliche Auskunft statt Erfindung
  assert.match(formatHours([], "de"), /keine Sprechzeiten/);
});

test("Themen werden an Stichwörtern erkannt – deutsch und englisch", () => {
  assert.ok(findTopics("Wann haben Sie geöffnet?", "de").includes("oeffnungszeiten"));
  assert.ok(findTopics("Wie komme ich mit der U-Bahn hin?", "de").includes("anfahrt"));
  assert.ok(findTopics("Gibt es Parkplätze?", "de").includes("parken"));
  assert.ok(findTopics("What are your opening hours?", "en").includes("oeffnungszeiten"));
  assert.ok(findTopics("Where can I park?", "en").includes("parken"));
  assert.ok(findTopics("Do I need a referral?", "en").includes("ueberweisung"));
});

test("Gepflegte Fakten werden geantwortet, ungepflegte als unbekannt gemeldet", () => {
  const a = answerFromFacts(["adresse", "anfahrt"], "de", live);
  assert.match(a.text, /Schäferkampsallee 56/);
  assert.match(a.text, /Christuskirche/);
  assert.deepEqual(a.unknown, []);

  const b = answerFromFacts(["parken"], "de", live);
  assert.equal(b.text, "");
  assert.deepEqual(b.unknown, ["parken"]);
});

test("Was die Praxis nicht geliefert hat, ist ausdrücklich als offen markiert", () => {
  const offen = unknownTopics();
  for (const t of ["parken", "barrierefreiheit", "kassen", "urlaubsvertretung", "mitbringen"]) {
    assert.ok(offen.includes(t), `${t} sollte offen sein`);
  }
  // Und was belegt ist, ist in beiden Sprachen belegt
  for (const t of ["adresse", "anfahrt", "kontakt", "ueberweisung", "vorbereitung", "datenschutz"]) {
    assert.ok(PRAXIS_WISSEN[t].de, `${t} fehlt auf Deutsch`);
    assert.ok(PRAXIS_WISSEN[t].en, `${t} fehlt auf Englisch`);
  }
});

test("Öffnungszeiten kommen live, der Bannertext wird angehängt", () => {
  const a = answerFromFacts(["oeffnungszeiten"], "de", { hoursText: formatHours(HOURS, "de"), banner: "Vom 12. bis 23. August geschlossen." });
  assert.match(a.text, /Sprechzeiten: Mo, Mi, Fr 07:00–12:00/);
  assert.match(a.text, /Vom 12\. bis 23\. August geschlossen\./);
});

// ---- Die Nachprüfung ----

test("Erfundene Uhrzeit fällt durch", () => {
  const facts = ["Sprechzeiten: Mo, Mi, Fr 07:00–12:00 · Di, Do 07:00–12:00, 14:00–18:00 Uhr."];
  assert.equal(groundingCheck("Wir haben Mo, Mi, Fr von 07:00 bis 12:00 Uhr geöffnet.", facts), true);
  assert.equal(groundingCheck("Wir haben bis 19:30 Uhr geöffnet.", facts), false, "19:30 steht nirgends");
});

test("Erfundener Link fällt durch, bekannter Link besteht", () => {
  const facts = ["Datenschutzerklärung: https://www.proktologie-eimsbuettel.de/datenschutz/"];
  assert.equal(groundingCheck("Näheres unter https://www.proktologie-eimsbuettel.de/datenschutz/", facts), true);
  assert.equal(groundingCheck("Näheres unter https://beispiel.example/andere-seite", facts), false);
});

test("Zu lange Antworten und leere Antworten fallen durch", () => {
  const facts = ["Die Praxis liegt in der Schäferkampsallee."];
  assert.equal(groundingCheck("Eins. Zwei. Drei. Vier.", facts), false);
  assert.equal(groundingCheck("   ", facts), false);
  assert.equal(groundingCheck("Die Praxis liegt in der Schäferkampsallee.", facts), true);
});

// ---- Wie Patientinnen wirklich fragen ----

test("Die Anfahrtsfrage wird in ihren gängigen Formen erkannt", () => {
  const fragen = {
    de: ["Wie komme ich zu Ihnen?", "Wie finde ich die Praxis?", "Gibt es eine U-Bahn in der Nähe?", "Wie ist die Anfahrt?"],
    en: ["How do I get to your practice?", "How can I find you?", "Is there an underground station nearby?", "What are the directions?"],
  };
  for (const [lang, liste] of Object.entries(fragen)) {
    for (const frage of liste) {
      const topics = findTopics(frage, lang);
      assert.ok(topics.includes("anfahrt") || topics.includes("adresse"), `nicht erkannt (${lang}): ${frage}`);
    }
  }
});

test("Ein Terminwunsch ist keine Anfahrtsfrage", () => {
  assert.deepEqual(findTopics("Ich hätte gern einen Kontrolltermin", "de"), []);
  assert.deepEqual(findTopics("I would like an appointment", "en"), []);
});
