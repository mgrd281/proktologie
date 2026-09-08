/**
 * Die wichtigste Testdatei des Chats. Sie prüft die drei Regeln, die vor
 * allem anderen gelten: Notfall erkennen, Gesundheitsangaben nicht
 * weitergeben, Personenbezug maskieren.
 *
 * Ausführen:  node --test lib/chat/safety.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { detectEmergency, detectHealthData, maskPii } = await import("./safety.ts");

// ---- Notfall ----

const NOTFAELLE_DE = [
  "Ich habe starke Brustschmerzen",
  "Mir drückt es auf der Brust",
  "Druck in der Brust seit heute Morgen",
  "Ich glaube, das ist ein Herzinfarkt",
  "Ich habe Atemnot",
  "Ich kriege keine Luft",
  "Ich bekomme kaum Luft",
  "Meine Mutter ist bewusstlos",
  "Er ist nicht ansprechbar",
  "Es blutet stark und hört nicht auf",
  "Ich glaube, ein Schlaganfall",
  "Sie hat eine Gesichtslähmung",
  "Ich hatte einen Krampfanfall",
  "Ich will nicht mehr leben",
  "Ich möchte mich umbringen",
  "Ich habe eine Überdosis genommen",
];

const NOTFAELLE_EN = [
  "I have chest pain",
  "There is tightness in my chest",
  "I think it's a heart attack",
  "I can't breathe",
  "I cannot breathe properly",
  "shortness of breath since this morning",
  "My father is unconscious",
  "She passed out",
  "heavy bleeding that won't stop",
  "I think this is a stroke",
  "slurred speech and a numb arm",
  "he had a seizure",
  "I want to kill myself",
  "thoughts of self-harm",
  "I took an overdose",
];

test("Notfall wird auf Deutsch erkannt – auch als Andeutung", () => {
  for (const s of NOTFAELLE_DE) assert.ok(detectEmergency(s), `nicht erkannt: ${s}`);
});

test("Notfall wird auf Englisch erkannt", () => {
  for (const s of NOTFAELLE_EN) assert.ok(detectEmergency(s), `nicht erkannt: ${s}`);
});

test("Gewöhnliche Sätze lösen keinen Notfall aus", () => {
  const harmlos = [
    "Ich hätte gern einen Termin am Dienstag",
    "Wann haben Sie geöffnet?",
    "Können Sie mir die Anfahrt sagen?",
    "Ich möchte einen Kontrolltermin buchen",
    "Bitte um einen Rückruf",
    "Do you have an appointment on Tuesday at 14:30?",
    "I would like to book a check-up",
  ];
  for (const s of harmlos) assert.equal(detectEmergency(s), null, `falsch erkannt: ${s}`);
});

// ---- Gesundheitsangaben ----

test("Gesundheitsangaben werden erkannt", () => {
  const treffer = [
    "Ich habe Blut im Stuhl",
    "Seit drei Tagen habe ich Schmerzen",
    "Es juckt und brennt",
    "Ich nehme Ibuprofen",
    "Meine Diagnose lautet Fissur",
    "I have bleeding and pain",
    "I am taking antibiotics",
  ];
  for (const s of treffer) assert.ok(detectHealthData(s), `nicht erkannt: ${s}`);
});

test("Terminfragen ohne Gesundheitsbezug bleiben frei", () => {
  const frei = [
    "Ich hätte gern einen Termin",
    "Wann ist der nächste freie Platz?",
    "Können Sie mir die Öffnungszeiten sagen?",
    "Ich brauche eine Überweisung – wie geht das?",
    "Where can I park?",
  ];
  for (const s of frei) assert.equal(detectHealthData(s), null, `falsch erkannt: ${s}`);
});

test("Frage nach Bedeutung oder Behandlung → Ablehnung statt Hinweis", () => {
  assert.equal(detectHealthData("Ich habe Blut im Stuhl, ist das schlimm?").medicalQuestion, true);
  assert.equal(detectHealthData("Was hilft gegen Hämorrhoiden?").medicalQuestion, true);
  assert.equal(detectHealthData("I have bleeding, is this dangerous?").medicalQuestion, true);
  // Bloße Erwähnung ohne Frage: Hinweis genügt
  assert.equal(detectHealthData("Ich habe Hämorrhoiden").medicalQuestion, false);
});

test("Versichertennummer gilt als Gesundheitsangabe", () => {
  const hit = detectHealthData("Meine Versichertennummer ist A123456789");
  assert.ok(hit, "Versichertennummer nicht erkannt");
});

// ---- Maskierung ----

test("E-Mail, Telefon, Versicherten- und Kontonummer werden ersetzt", () => {
  const r = maskPii("Schreiben Sie an erika.musterfrau@example.invalid oder rufen Sie 040 490 80 21 an. Nummer A123456789, IBAN DE02120300000000202051.");
  assert.ok(!r.text.includes("erika.musterfrau@example.invalid"), r.text);
  assert.ok(!r.text.includes("040 490 80 21"), r.text);
  assert.ok(!r.text.includes("A123456789"), r.text);
  assert.ok(!r.text.includes("DE02120300000000202051"), r.text);
  assert.match(r.text, /\[E-Mail\]/);
  assert.match(r.text, /\[Telefon\]/);
  assert.match(r.text, /\[Nummer\]/);
  assert.match(r.text, /\[IBAN\]/);
  assert.deepEqual([...r.masked].sort(), ["email", "iban", "insurance", "phone"]);
});

test("Uhrzeiten und Daten überleben die Maskierung", () => {
  const r = maskPii("Geht 14:30 am 12.03.2026? Sonst 15 Uhr.");
  assert.equal(r.text, "Geht 14:30 am 12.03.2026? Sonst 15 Uhr.");
  assert.deepEqual(r.masked, []);
});

test("Text ohne Personenbezug bleibt unverändert", () => {
  const s = "Ich hätte gern einen Kontrolltermin nächste Woche.";
  assert.deepEqual(maskPii(s), { text: s, masked: [] });
});

// ---- Was KEIN Notfall ist ----

test("Fragen nach Notfallterminen und Notfallnummern sind kein Notfall", () => {
  const fragen = [
    "Ist ein Notfalltermin möglich?",
    "Haben Sie eine Notfallsprechstunde?",
    "Wie ist die Notfallnummer?",
    "kein Notfall, aber dringend",
    "Es ist kein akuter Notfall",
    "Do you offer emergency appointments?",
    "What is the emergency number?",
    "not an emergency, but urgent",
  ];
  for (const s of fragen) assert.equal(detectEmergency(s), null, `fälschlich Notfall: ${s}`);
  // Das nackte Wort bleibt ein Notfall – lieber einmal zu viel
  assert.ok(detectEmergency("Notfall!"));
  assert.ok(detectEmergency("Das ist ein Notfall"));
  assert.ok(detectEmergency("This is an emergency"));
});

test("Akut, aber kein Notfall, wird als solches erkannt", async () => {
  const { isAcuteConcern } = await import("./safety.ts");
  assert.equal(isAcuteConcern("Ist ein Notfalltermin möglich?"), true);
  assert.equal(isAcuteConcern("Ich bräuchte dringend einen Termin"), true);
  assert.equal(isAcuteConcern("Ich habe starke Schmerzen, wann kann ich kommen?"), true);
  assert.equal(isAcuteConcern("Ich hätte gern einen Kontrolltermin nächste Woche"), false);
});

test("Terminarten sind keine Gesundheitsangabe, wenn der Aufrufer sie ausnimmt", () => {
  const ignore = ["Hämorrhoiden", "hämorrhoid", "Analfissur", "fissur", "Analfistel", "fistel"];
  assert.equal(detectHealthData("Ich brauche einen Termin wegen Hämorrhoiden am Dienstag", { ignore }), null);
  assert.equal(detectHealthData("Termin für Analfissur bitte", { ignore }), null);
  // Mit weiteren Angaben bleibt es eine Gesundheitsangabe
  assert.ok(detectHealthData("Termin wegen Hämorrhoiden, es blutet seit Tagen", { ignore }));
  // Ohne Ausnahme trifft es weiterhin
  assert.ok(detectHealthData("Ich brauche einen Termin wegen Hämorrhoiden"));
});

test("Harmlose Wörter mit Gesundheits-Teilstring bleiben frei", () => {
  const frei = [
    "Do you have anything in the afternoon?",
    "Ich möchte eine Analyse der Kosten",
    "Ich bin nach der Arbeit erst um 17 Uhr da",
    "Can I come after work?",
  ];
  for (const s of frei) assert.equal(detectHealthData(s), null, `falsch erkannt: ${s}`);
});
