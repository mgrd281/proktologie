/**
 * Spracherkennung an der Nachricht, nicht am Browser.
 * Ausführen:  node --test lib/chat/language.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { detectLanguage } = await import("./language.ts");

test("Deutsche Sätze werden sicher erkannt", () => {
  const saetze = [
    "Ich hätte gern einen Termin am Dienstag",
    "Wann haben Sie geöffnet?",
    "Können Sie mir die Anfahrt sagen?",
    "Ich möchte einen Kontrolltermin buchen",
    "Gibt es morgen noch etwas frei?",
  ];
  for (const s of saetze) {
    const r = detectLanguage(s, "en");
    assert.equal(r.lang, "de", `falsch: ${s}`);
    assert.equal(r.confidence, "high", `unsicher: ${s}`);
  }
});

test("Englische Sätze werden sicher erkannt – auch wenn Deutsch voreingestellt war", () => {
  const saetze = [
    "I would like to book an appointment",
    "When are you open?",
    "Do you have anything free tomorrow?",
    "Could you tell me how to get there?",
    "I need an appointment next week please",
  ];
  for (const s of saetze) {
    const r = detectLanguage(s, "de");
    assert.equal(r.lang, "en", `falsch: ${s}`);
    assert.equal(r.confidence, "high", `unsicher: ${s}`);
  }
});

test("Ohne Anhaltspunkte bleibt die bisherige Sprache stehen", () => {
  for (const s of ["14:30", "12.03.2026", "PE-4F7K", "", "   "]) {
    assert.deepEqual(detectLanguage(s, "en"), { lang: "en", confidence: "low" }, s);
    assert.deepEqual(detectLanguage(s, "de"), { lang: "de", confidence: "low" }, s);
  }
});

test("Umlaute geben den Ausschlag für Deutsch", () => {
  assert.equal(detectLanguage("Öffnungszeiten?", "en").lang, "de");
});

test("Ein englisches Wort ohne deutsche Gegenzeichen wählt Englisch", () => {
  assert.equal(detectLanguage("Proktologie appointment please", "de").lang, "en");
});
