/**
 * Was das Modell sieht – und was es nie sehen kann.
 * Ausführen:  node --test lib/chat/prompts.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { classifyPrompt, groundPrompt, parseClassification, CLASSIFY_MARK, GROUND_MARK } = await import("./prompts.ts");

const view = {
  stage: "idle",
  lang: "de",
  text: "Ich hätte gern einen Kontrolltermin am Dienstag um 14:30",
  typeLabels: ["Kontrolltermin", "Proktologische Erstuntersuchung"],
  today: "2026-07-13",
  weekday: "Montag",
};

test("Klassifikation: JSON-Modus, Temperatur 0, Marke in der ersten Zeile", () => {
  const call = classifyPrompt(view);
  assert.equal(call.json, true);
  assert.equal(call.temperature, 0);
  assert.ok(call.messages[0].content.startsWith(CLASSIFY_MARK));
  assert.match(call.messages[0].content, /Heute ist Montag, 2026-07-13/);
  assert.match(call.messages[0].content, /Kontrolltermin; Proktologische Erstuntersuchung/);
  assert.equal(call.messages[1].content, view.text);
});

test("Der Prompt enthält nur den übergebenen Text – keine weiteren Felder", () => {
  const call = classifyPrompt(view);
  const alles = JSON.stringify(call);
  // Kanarienvögel: solche Daten gibt es im ModelView-Typ gar nicht
  for (const geheim of ["erika@example.invalid", "040 490 80 21", "Musterfrau"]) {
    assert.ok(!alles.includes(geheim), `${geheim} darf nie im Prompt stehen`);
  }
});

test("Gegründete Antwort: Fakten stehen im Systemtext, Erfinden ist verboten", () => {
  const call = groundPrompt("Wann haben Sie geöffnet?", ["Sprechzeiten: Mo, Mi, Fr 07:00–12:00 Uhr."], "de");
  assert.ok(call.messages[0].content.startsWith(GROUND_MARK));
  assert.match(call.messages[0].content, /Erfinde nichts/);
  assert.match(call.messages[0].content, /Höchstens drei Sätze/);
  assert.match(call.messages[0].content, /- Sprechzeiten: Mo, Mi, Fr 07:00–12:00 Uhr\./);
  assert.ok(!call.json, "Freitext, kein JSON-Zwang");
});

test("Englische Fassung spricht Englisch", () => {
  const call = groundPrompt("When are you open?", ["Opening hours: Mon, Wed, Fri 07:00–12:00."], "en");
  assert.match(call.messages[0].content, /You are the receptionist/);
  assert.match(call.messages[0].content, /Invent nothing/);
});

test("Antwort lesen: sauberes JSON, JSON in Zäunen, JSON mit Vorrede", () => {
  const gut = '{"intent":"booking","lang":"de","type":"Kontrolltermin","date":"2026-07-14","time":"14:30","topics":[]}';
  assert.deepEqual(parseClassification(gut).intent, "booking");
  assert.deepEqual(parseClassification("```json\n" + gut + "\n```").time, "14:30");
  assert.deepEqual(parseClassification("Hier das Ergebnis: " + gut).date, "2026-07-14");
});

test("Unbrauchbare Antworten ergeben null, nicht eine halbe Wahrheit", () => {
  const schlecht = [
    "",
    "kein JSON",
    "{kaputt",
    '{"intent":"buchen","lang":"de","type":null,"date":null,"time":null,"topics":[]}', // unbekannte Absicht
    '{"intent":"booking","lang":"fr","type":null,"date":null,"time":null,"topics":[]}', // unbekannte Sprache
    '{"intent":"booking","lang":"de","type":null,"date":"14.07.2026","time":null,"topics":[]}', // falsches Datumsformat
    '{"intent":"booking","lang":"de","type":null,"date":null,"time":"halb drei","topics":[]}', // keine Uhrzeit
  ];
  for (const s of schlecht) assert.equal(parseClassification(s), null, s);
});
