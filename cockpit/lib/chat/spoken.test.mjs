/**
 * Gesprochene Angaben lesen – gegen das, was die Erkennung wirklich liefert.
 *
 * Ausführen:  node --test lib/chat/spoken.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { parseSpokenName, normalizeSpokenEmail, parseSpokenPhone, spokenDigits, isSkip, spokenYesNo } = await import("./spoken.ts");

// ---------------------------------------------------------------- Name

const name = (text) => {
  const n = parseSpokenName(text);
  return n && { firstName: n.firstName, lastName: n.lastName };
};

test("Name: Einleitungen fallen weg, Vor- und Nachname werden getrennt", () => {
  assert.deepEqual(parseSpokenName("Ich heiße Max Mustermann."), { firstName: "Max", lastName: "Mustermann", lead: true });
  assert.deepEqual(name("Mein Name ist Erika Musterfrau"), { firstName: "Erika", lastName: "Musterfrau" });
  assert.deepEqual(name("My name is John Smith"), { firstName: "John", lastName: "Smith" });
  assert.deepEqual(parseSpokenName("Anna-Lena Müller"), { firstName: "Anna-Lena", lastName: "Müller", lead: false });
});

test("Name: Anreden sind kein Namensteil, Doppelvornamen bleiben zusammen", () => {
  assert.deepEqual(name("Herr Dr. Kai Kunstreich"), { firstName: "Kai", lastName: "Kunstreich" });
  assert.deepEqual(name("Frau Maria Anna Schmidt"), { firstName: "Maria Anna", lastName: "Schmidt" });
});

test("Name: ein einzelnes Wort ist ein Vorname ohne Nachname – der Automat fragt nach", () => {
  assert.deepEqual(name("Max"), { firstName: "Max", lastName: null });
  assert.deepEqual(name("ich bin max"), { firstName: "Max", lastName: null });
});

test("Name: Füllwörter, Artikel, Höflichkeit und Zusätze – nichts davon ist ein Namensteil", () => {
  assert.deepEqual(name("Ja, Erika Musterfrau."), { firstName: "Erika", lastName: "Musterfrau" });
  assert.deepEqual(name("ich bin die Erika"), { firstName: "Erika", lastName: null });
  assert.deepEqual(name("Max Mustermann, bitte."), { firstName: "Max", lastName: "Mustermann" });
  assert.deepEqual(name("Max von der Heide"), { firstName: "Max", lastName: "von der Heide" });
  assert.deepEqual(name("von der Heide"), { firstName: "", lastName: "von der Heide" });
  assert.deepEqual(name("Der Nachname ist Musterfrau"), { firstName: "Musterfrau", lastName: null });
  for (const s of ["Lieber am Mittwoch", "Ich möchte abbrechen.", "Wochen.", "Wie bitte?", "Schatz, komm mal", "keine Ahnung"]) assert.equal(name(s), null, s);
});

test("E-Mail: Füllwörter vorn und hinten gehören nicht zur Adresse", () => {
  assert.equal(normalizeSpokenEmail("erika ät gmx punkt de, bitte."), "erika@gmx.de");
  assert.equal(normalizeSpokenEmail("Ja, erika at gmx punkt de"), "erika@gmx.de");
  assert.equal(normalizeSpokenEmail("max@gmx.de bitte"), "max@gmx.de");
  assert.equal(normalizeSpokenEmail("max at gmx punkt de danke"), "max@gmx.de");
  assert.equal(normalizeSpokenEmail("meine adresse ist max at gmx punkt de"), "max@gmx.de");
  assert.equal(normalizeSpokenEmail("Nein, es ist erika punkt m at example punkt invalid"), "erika.m@example.invalid");
  assert.equal(normalizeSpokenEmail("erika at gmx punkt de, richtig?"), "erika@gmx.de");
});

test("Telefon: Ziffern auch in Teilen – und keine Prototyp-Schlüssel", () => {
  assert.equal(parseSpokenPhone("__proto__"), null);
  assert.equal(parseSpokenPhone("constructor"), null);
  assert.equal(spokenDigits("Null eins sieben sechs."), "0176");
  assert.equal(spokenDigits("Termin"), null);
});

test("Name: Unsinn ist kein Name", () => {
  assert.equal(parseSpokenName("12345"), null);
  assert.equal(parseSpokenName(""), null);
  assert.equal(parseSpokenName("das ist ein viel zu langer satz der kein name ist"), null);
});

// -------------------------------------------------------------- E-Mail

test("E-Mail: gesprochene Zeichenwörter werden zu Zeichen", () => {
  assert.equal(normalizeSpokenEmail("max punkt mustermann ät gmx punkt de"), "max.mustermann@gmx.de");
  assert.equal(normalizeSpokenEmail("max punkt mustermann at gmx punkt de"), "max.mustermann@gmx.de");
  assert.equal(normalizeSpokenEmail("erika minus musterfrau at web punkt de"), "erika-musterfrau@web.de");
  assert.equal(normalizeSpokenEmail("john underscore smith at gmail dot com"), "john_smith@gmail.com");
});

test("E-Mail: Einleitungen und Satzzeichen stören nicht", () => {
  assert.equal(normalizeSpokenEmail("Meine E-Mail-Adresse ist max at gmx punkt de."), "max@gmx.de");
  assert.equal(normalizeSpokenEmail("Also, e-mail: max at gmx punkt de"), "max@gmx.de");
});

test("E-Mail: bereits als Adresse erkannt – nur säubern", () => {
  assert.equal(normalizeSpokenEmail("max.mustermann@gmx.de"), "max.mustermann@gmx.de");
  assert.equal(normalizeSpokenEmail("Max.Mustermann@GMX.de"), "max.mustermann@gmx.de");
  assert.equal(normalizeSpokenEmail("max.mustermann @ gmx.de"), "max.mustermann@gmx.de");
});

test("E-Mail: buchstabierte Teile werden zusammengezogen", () => {
  assert.equal(normalizeSpokenEmail("m a x at gmx punkt de"), "max@gmx.de");
  assert.equal(normalizeSpokenEmail("max at gmx punkt d e"), "max@gmx.de");
});

test("E-Mail: was keine Adresse ergibt, ist null – nachfragen statt raten", () => {
  assert.equal(normalizeSpokenEmail("keine Ahnung"), null);
  assert.equal(normalizeSpokenEmail("max at gmx"), null, "ohne Endung keine Adresse");
  assert.equal(normalizeSpokenEmail(""), null);
});

// ------------------------------------------------------------- Telefon

test("Telefon: Ziffern, Zahlwörter und Gruppen", () => {
  assert.equal(parseSpokenPhone("0176 123 45 67"), "0176123456 7".replace(" ", ""));
  assert.equal(parseSpokenPhone("null eins sieben sechs eins zwei drei vier fünf sechs sieben"), "01761234567");
  assert.equal(parseSpokenPhone("zero one seven six one two three four five six seven"), "01761234567");
  assert.equal(parseSpokenPhone("Meine Handynummer ist 0176-1234567."), "01761234567");
});

test("Telefon: zusammengesetzte Zahlwörter und Plus", () => {
  assert.equal(parseSpokenPhone("plus vier neun eins sieben sechs zwölf dreiundzwanzig"), "+4917612 23".replace(" ", ""));
  assert.equal(parseSpokenPhone("+49 176 12345678"), "+4917612345678");
});

test("Telefon: zu kurz oder mit fremden Wörtern ist keine Nummer", () => {
  assert.equal(parseSpokenPhone("12345"), null);
  assert.equal(parseSpokenPhone("null eins sieben Termin sechs"), null);
  assert.equal(parseSpokenPhone("keine"), null);
});

// ---------------------------------------------------------------- Skip

test("Skip: optionales Feld auslassen", () => {
  for (const s of ["Keine.", "Nein danke.", "Nein.", "Weiter.", "nichts", "ohne", "no", "skip", "none"]) assert.equal(isSkip(s), true, s);
  for (const s of ["0176 1234567", "Max Mustermann", "nein, warte"]) assert.equal(isSkip(s), false, s);
});

// -------------------------------------------------------------- Ja/Nein

test("Ja/Nein auf eine Rückfrage", () => {
  assert.equal(spokenYesNo("Ja."), "yes");
  assert.equal(spokenYesNo("ja genau"), "yes");
  assert.equal(spokenYesNo("Richtig!"), "yes");
  assert.equal(spokenYesNo("Nein."), "no");
  assert.equal(spokenYesNo("nein, falsch"), "no");
  assert.equal(spokenYesNo("ja aber mit u"), null, "ein Ja mit Einschränkung ist kein Ja");
  assert.equal(spokenYesNo("Wochen."), null);
});
