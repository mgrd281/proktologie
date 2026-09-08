/**
 * Tippfehler beheben ist einfach. Nicht zu viel zu beheben ist das
 * Schwierige: „morgens" ist von „morgen" einen Buchstaben entfernt, und
 * eine unbedachte Korrektur legt den Termin auf den falschen Tag.
 *
 * Ausführen:  node --test lib/chat/normalize.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { normalize, fold, correctWord, editDistance, CORE_TERMS, PROTECTED } = await import("./normalize.ts");

test("Falten: Kleinschreibung, Umlaute, ß und gedehnte Buchstaben", () => {
  assert.equal(fold("Öffnungszeiten"), "oeffnungszeiten");
  assert.equal(fold("HÄMORRHOIDEN"), "haemorrhoiden");
  assert.equal(fold("Straße"), "strasse"); 
  assert.equal(fold("Jaaaa"), "ja");
  assert.equal(fold("  viel   Platz  "), "viel platz");
});

test("Abstand: ein fehlender, ein zusätzlicher, ein vertauschter Buchstabe", () => {
  assert.equal(editDistance("termin", "termin"), 0);
  assert.equal(editDistance("termn", "termin"), 1, "fehlender Buchstabe");
  assert.equal(editDistance("terminn", "termin"), 1, "zusätzlicher Buchstabe");
  assert.equal(editDistance("tremin", "termin"), 1, "vertauschte Nachbarn zählen als einer");
  assert.ok(editDistance("hallo", "termin", 1) > 1);
});

test("Der Abbruch bei großer Entfernung liefert keine falsche Zahl", () => {
  assert.ok(editDistance("abc", "abcdefghij", 2) > 2);
  assert.ok(editDistance("völlig anders", "termin", 1) > 1);
});

test("Häufige Tippfehler werden behoben", () => {
  const faelle = [
    ["Termin am Donerstag bitte", /donnerstag/],
    ["Öffnugszeiten?", /oeffnungszeiten/],
    ["Ich hätte gern einen Termn", /termin/],
    ["I would like an apointment", /appointment/],
    ["Brauche ich eine Überweisng?", /ueberweisung/],
    ["Schnelstmöglich bitte", /schnellstmoeglich/],
    ["Kann ich eine Krankschreibng bekommen?", /krankschreibung/],
  ];
  for (const [text, erwartet] of faelle) assert.match(normalize(text), erwartet, text);
});

test("Geschützte Wörter werden nie angefasst – hier hängt ein Termin dran", () => {
  // „morgens" darf nicht zu „morgen" werden: sonst wird aus „acht Uhr
  // morgens" der morgige Tag.
  assert.equal(correctWord("morgens"), "morgens");
  assert.match(normalize("Um 8 Uhr morgens am Mittwoch"), /morgens/);
  assert.match(normalize("Guten Morgen, ich hätte gern einen Termin"), /guten morgen/);
  for (const wort of ["abends", "mittags", "vormittags", "nachmittags"]) {
    assert.equal(correctWord(wort), wort, wort);
  }
});

test("Kurze Wörter werden nicht korrigiert – da rät man nur", () => {
  for (const wort of ["so", "do", "mo", "auf", "kein", "hier"]) {
    assert.equal(correctWord(wort), wort, wort);
  }
});

test("Zwei gleich nahe Kandidaten heißen: nichts ändern", () => {
  // Ein erfundenes Wort, das zu mehreren Kernbegriffen denselben Abstand
  // hat, darf nicht willkürlich auf einen davon gezogen werden.
  const kandidaten = CORE_TERMS.filter((t) => editDistance("terminx", t, 1) <= 1);
  if (kandidaten.length > 1) assert.equal(correctWord("terminx"), "terminx");
});

test("Was schon richtig ist, bleibt unverändert", () => {
  for (const wort of CORE_TERMS.slice(0, 20)) assert.equal(correctWord(wort), wort, wort);
});

test("Ganze Wendungen werden auf das Thema abgebildet", () => {
  assert.match(normalize("habt ihr heute offen?"), /oeffnungszeiten/);
  assert.match(normalize("Seid ihr da?"), /oeffnungszeiten/);
  assert.match(normalize("wo seid ihr"), /adresse/);
  assert.match(normalize("Wie komme ich zu Ihnen?"), /anfahrt/);
  assert.match(normalize("Was kostet das?"), /kosten/);
  assert.match(normalize("Wer übernimmt das?"), /kasse/);
  assert.match(normalize("Sprechen Sie Englisch?"), /sprachen/);
  assert.match(normalize("Kann ich ohne Termin kommen?"), /ohnetermin/);
  assert.match(normalize("Wie lange dauert ein Termin?"), /dauer/);
});

test("Satzzeichen und Zahlen überleben", () => {
  assert.match(normalize("Termin am 16.7. um 14:30?"), /16\.7\./);
  assert.match(normalize("Termin am 16.7. um 14:30?"), /14:30/);
});

test("Die Schutzliste ist nicht leer und deckt die gefährlichen Fälle ab", () => {
  for (const wort of ["morgens", "morgen", "abends", "so", "do"]) {
    assert.ok(PROTECTED.has(wort), `${wort} fehlt in der Schutzliste`);
  }
});
