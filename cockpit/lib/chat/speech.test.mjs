/**
 * Was am Bildschirm richtig aussieht, muss am Telefon richtig klingen.
 * Geprüft wird vor allem das, was im Notfall zählt: 112 darf niemals als
 * „hundertzwölf“ herauskommen, und ein Datum darf nicht zur Ziffernfolge
 * zerfallen.
 *
 * Ausführen:  node --test lib/chat/speech.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { toSpeech, timeSpoken, numberWord, digitsSpoken, refSpoken, emailSpoken, optionsSpoken } = await import("./speech.ts");

// ------------------------------------------------------------- Zahlen

test("Zahlwörter bis 99, deutsch und englisch", () => {
  assert.equal(numberWord(0, "de"), "null");
  assert.equal(numberWord(7, "de"), "sieben");
  assert.equal(numberWord(15, "de"), "fünfzehn");
  assert.equal(numberWord(21, "de"), "einundzwanzig", "nicht „einsundzwanzig“");
  assert.equal(numberWord(30, "de"), "dreißig");
  assert.equal(numberWord(45, "de"), "fünfundvierzig");
  assert.equal(numberWord(7, "en"), "seven");
  assert.equal(numberWord(45, "en"), "forty-five");
  // Außerhalb des Bereichs bleibt die Ziffer stehen, statt zu raten
  assert.equal(numberWord(2026, "de"), "2026");
});

test("Uhrzeiten werden gesprochen, nicht gelesen", () => {
  assert.equal(timeSpoken("07:15", "de"), "sieben Uhr fünfzehn");
  assert.equal(timeSpoken("09:00", "de"), "neun Uhr");
  assert.equal(timeSpoken("14:30", "de"), "vierzehn Uhr dreißig");
  assert.equal(timeSpoken("07:15", "en"), "seven fifteen");
  assert.equal(timeSpoken("09:00", "en"), "nine o'clock");
  // Unsinn bleibt unverändert, statt falsch gesprochen zu werden
  assert.equal(timeSpoken("25:99", "de"), "25:99");
  assert.equal(timeSpoken("kein Datum", "de"), "kein Datum");
});

test("Ziffernfolgen für Notruf- und Telefonnummern", () => {
  assert.equal(digitsSpoken("112", "de"), "eins eins zwei");
  assert.equal(digitsSpoken("116117", "de"), "eins eins sechs eins eins sieben");
  assert.equal(digitsSpoken("040 490 80 21", "de"), "null vier null vier neun null acht null zwei eins");
});

// ------------------------------------------------------- Buchstabieren

test("Referenz wird buchstabiert, mit und ohne Buchstabieralphabet", () => {
  assert.equal(refSpoken("PE-4F7K", "de"), "P, E, vier, F, sieben, K");
  assert.equal(refSpoken("PE-4F7K", "de", true), "P wie Paula, E wie Emil, vier, F wie Friedrich, sieben, K wie Kaufmann");
  assert.equal(refSpoken("AN-7T2M", "en", true).startsWith("A as in Alpha"), true);
});

test("E-Mail wird mit at und Punkt buchstabiert", () => {
  const s = emailSpoken("erika@example.de", "de");
  assert.match(s, /^E, R, I, K, A, at, /);
  assert.match(s, /Punkt, D, E$/);
  assert.match(emailSpoken("a-b_c@x.de", "de"), /Bindestrich/);
  assert.match(emailSpoken("a-b_c@x.de", "de"), /Unterstrich/);
});

// ------------------------------------------------- Ganze Antwortsätze

test("Notfallsatz: 112 und 116 117 werden als Ziffern gesprochen", () => {
  const text =
    "Das klingt nach einem Notfall. Bitte rufen Sie sofort den Notruf 112 an. " +
    "Bei dringenden, nicht lebensbedrohlichen Beschwerden: ärztlicher Bereitschaftsdienst 116 117. " +
    "Dieser Chat kann keine Notfallhilfe leisten.";
  const s = toSpeech(text, "de", { channel: "phone" });
  assert.match(s, /Notruf eins eins zwei an/);
  assert.match(s, /Bereitschaftsdienst eins eins sechs eins eins sieben/);
  assert.ok(!/\b112\b/.test(s), s);
  assert.ok(!/\b116\b/.test(s), s);
  assert.match(s, /Ich kann Ihnen hier nicht weiterhelfen\./, "„Dieser Chat“ gibt es am Telefon nicht");
});

test("Das Datum bleibt ein Datum – die Uhrzeit wird gesprochen", () => {
  const s = toSpeech("Gebucht: Kontrolltermin am Dienstag, 14. Juli 2026 um 09:00 Uhr. Ihre Referenz: PE-4F7K.", "de");
  assert.match(s, /Dienstag, 14\. Juli 2026/, "das Datum darf nicht zur Ziffernfolge zerfallen");
  assert.match(s, /um neun Uhr\./, "kein doppeltes „Uhr“");
  assert.ok(!/Uhr Uhr/.test(s), s);
  assert.match(s, /Referenz: P, E, vier, F, sieben, K\./);
  assert.ok(!s.includes("PE-4F7K"), s);
});

test("Die Praxisnummer wird Ziffer für Ziffer gesprochen", () => {
  const s = toSpeech("Rufen Sie uns gern an: 040 490 80 21.", "de");
  assert.match(s, /null vier null vier neun null acht null zwei eins/);
  assert.ok(!s.includes("040"), s);
});

test("Schaltflächen gibt es am Telefon nicht", () => {
  const s = toSpeech("Das kann ich gerade nicht beantworten. Rufen Sie uns bitte an: 040 490 80 21 – oder nutzen Sie die Schaltflächen unten.", "de");
  assert.ok(!/Schaltflächen/.test(s), s);
  assert.match(s, /null vier null/);
});

test("Im Browser bleibt der Satz über den Bildschirm erhalten, nur die Schaltflächen fallen weg", () => {
  const text = "Bitte schreiben Sie hier keine gesundheitlichen Details – die besprechen Sie vertraulich in der Praxis.";
  const web = toSpeech(text, "de", { channel: "web" });
  const phone = toSpeech(text, "de", { channel: "phone" });
  assert.match(web, /Bitte schreiben Sie hier keine/);
  assert.match(phone, /Bitte nennen Sie mir keine/);
});

test("Links werden nicht vorgelesen", () => {
  const s = toSpeech("Mehr dazu: https://proktologie.example/termine bitte anrufen.", "de");
  assert.ok(!s.includes("https"), s);
  assert.match(s, /Mehr dazu:/);
});

test("Englisch: Uhrzeit, Notruf und Schaltflächen", () => {
  const s = toSpeech("I cannot answer that right now. Please call us: 040 490 80 21 – or use the buttons below.", "en");
  assert.ok(!/buttons/.test(s), s);
  assert.match(s, /zero four zero/);
});

test("Nichts Überflüssiges: keine doppelten Leerzeichen, keine hängenden Kommas", () => {
  const s = toSpeech("Am Dienstag, 14. Juli 2026 ist frei: 07:00, 07:30 und 08:00 Uhr. Welche Uhrzeit passt Ihnen?", "de");
  assert.ok(!/ {2,}/.test(s), `doppelte Leerzeichen: ${s}`);
  assert.ok(!/,\s*\./.test(s), s);
  assert.match(s, /sieben Uhr, sieben Uhr dreißig und acht Uhr/);
});

test("Sprechzeiten werden als Spanne gesprochen, nicht als Aufzählung", () => {
  const s = toSpeech("Sprechzeiten: Mo, Mi, Fr 07:00–12:00 · Di, Do 07:00–12:00, 14:00–18:00 Uhr.", "de");
  assert.match(s, /von sieben Uhr bis zwölf Uhr/);
  assert.match(s, /von vierzehn Uhr bis achtzehn Uhr/);
  assert.ok(!/Uhr Uhr/.test(s), s);
  const en = toSpeech("Opening hours: Mon, Wed, Fri 07:00–12:00.", "en");
  assert.match(en, /from seven o'clock to twelve o'clock/);
});

test("Schaltflächen werden zu einem gesprochenen Angebot", () => {
  assert.equal(optionsSpoken(["Termin vereinbaren", "Öffnungszeiten", "Anfahrt"], "de"), "Sagen Sie einfach: Termin vereinbaren, Öffnungszeiten oder Anfahrt.");
  assert.equal(optionsSpoken(["Ja, verbindlich buchen"], "de"), "Sagen Sie einfach: Ja, verbindlich buchen.");
  assert.equal(optionsSpoken([], "de"), "");
  assert.equal(optionsSpoken(["Book an appointment", "Opening hours"], "en"), "Just say: Book an appointment or Opening hours.");
});
