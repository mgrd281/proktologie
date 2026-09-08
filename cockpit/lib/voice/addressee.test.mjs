/**
 * Der Korpus für „galt das mir?".
 *
 * Zwei Zusicherungen stehen über allem und sind hier als eigene Tests
 * ausgeschrieben: Ein Notfall wird nie unterdrückt, und aus einem Zweifel
 * entsteht nie eine Buchung. Der Rest ist eine Annäherung mit bewusst
 * gewählter Fehlerrichtung – gemessen, nicht behauptet.
 *
 * Ausführen:  node --test lib/voice/addressee.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { judge, isBindingYes, DEFAULT_ADDRESSEE } = await import("./addressee.ts");

const exp = (over = {}) => ({ stage: "idle", hasIntent: false, isEmergency: false, lang: "de", ...over });
const say = (text, over = {}) => ({ text, ...over });

// ------------------------------------------------------ An uns gerichtet

const AN_UNS = [
  ["Ich hätte gern einen Termin", { hasIntent: true }],
  ["Können Sie am Dienstag nachsehen?", { hasIntent: true }],
  ["Guten Tag, ich möchte einen Kontrolltermin", { hasIntent: true }],
  ["Wann haben Sie geöffnet?", { hasIntent: true }],
  ["Bitte den Termin am Donnerstag", { hasIntent: true }],
  ["Ja, bitte buchen", { hasIntent: true, stage: "confirm" }],
  ["Nachmittags wäre mir lieber", { hasIntent: true, stage: "time" }],
  ["Ich brauche eine Überweisung, geht das bei Ihnen?", { hasIntent: true }],
];

test("Sätze, die an uns gerichtet sind, werden auch so verstanden", () => {
  for (const [text, over] of AN_UNS) {
    const r = judge(say(text), exp(over));
    assert.equal(r.verdict, "me", `${text} → ${r.verdict} (${r.score}, ${r.reasons.join("/")})`);
  }
});

// ------------------------------------------------------ Nebengespräche

const NEBENAN = [
  "sag mal, hast du den Kalender gesehen",
  "Moment, warte kurz",
  "guck mal, wo ist die Brille",
  "nicht jetzt, ich bin am Telefon",
  "Schatz, wann hast du frei",
  "hol mal den Kalender",
  "nein du, das war letzte Woche",
];

test("Sätze an jemanden im Raum werden erkannt – und beantwortet wird nichts", () => {
  for (const text of NEBENAN) {
    const r = judge(say(text), exp());
    assert.equal(r.verdict, "aside", `${text} → ${r.verdict} (${r.score}, ${r.reasons.join("/")})`);
  }
});

test("Leiser gesprochen als sonst zählt als abgewandt", () => {
  const laut = judge(say("wo ist das denn"), exp());
  const leise = judge(say("wo ist das denn"), exp(), DEFAULT_ADDRESSEE);
  assert.ok(laut.score >= 2);
  const abgewandt = judge(say("wo ist das denn", { relativeDb: -14 }), exp());
  assert.equal(abgewandt.verdict, "aside");
  assert.ok(abgewandt.reasons.includes("turned_away"));
  assert.ok(leise.score <= abgewandt.score);
});

test("Das eigene Echo aus dem Lautsprecher ist kein Patient", () => {
  const r = judge(
    say("Am Dienstag ist frei sieben Uhr", { duringOutput: true, assistantSaying: "Am Dienstag ist frei sieben Uhr sieben Uhr dreißig" }),
    exp({ hasIntent: true }),
  );
  assert.ok(r.reasons.includes("echo"), r.reasons.join("/"));
  assert.equal(r.verdict, "aside");
});

test("Rückkanalwörter sind Zuhören, keine Antwort – außer bei der Bestätigungsfrage", () => {
  const zuhoeren = judge(say("mhm"), exp({ stage: "time" }));
  assert.equal(zuhoeren.verdict, "aside");
  assert.ok(zuhoeren.reasons.includes("backchannel"));

  // In der Bestätigung ist ein knappes Wort eine echte Äußerung
  const bestaetigung = judge(say("genau"), exp({ stage: "confirm", hasIntent: true }));
  assert.ok(!bestaetigung.reasons.includes("backchannel"));
});

test("Sehr kurze und sehr lange Äußerungen sind verdächtig, aber nicht allein entscheidend", () => {
  const kurz = judge(say("Termin", { durationMs: 200 }), exp({ hasIntent: true }));
  assert.equal(kurz.verdict, "me", "eine erkannte Absicht wiegt schwerer als die Länge");
  const lang = judge(say("und dann hat sie gesagt dass wir am besten gleich morgen früh losfahren sollten", { durationMs: 14_000 }), exp());
  assert.equal(lang.verdict, "aside");
});

// ------------------------------------------------------- Unverhandelbar

test("Ein Notfall ist niemals ein Nebengespräch – kein Merkmal wiegt das auf", () => {
  const r = judge(
    say("sag mal, mir wird schwarz vor Augen", { relativeDb: -20, durationMs: 200, duringOutput: true }),
    exp({ isEmergency: true }),
  );
  assert.equal(r.verdict, "me");
  assert.deepEqual(r.reasons, ["emergency"]);
});

test("Eine getroffene Schaltfläche gilt wie ein Klick", () => {
  const r = judge(say("Öffnungszeiten"), exp({ matchesQuick: true, hasIntent: true }));
  assert.equal(r.verdict, "me");
});

test("Gebucht wird nur aus der Bestätigung, nur bei einer Ganzäußerung, nur wenn der Satz uns galt", () => {
  assert.equal(isBindingYes("ja", "me", "confirm"), true);
  assert.equal(isBindingYes("ja bitte buchen", "me", "confirm"), true);
  assert.equal(isBindingYes("Ja, gerne", "me", "confirm"), true);

  // Ein „ja" mitten im Satz bucht nichts
  assert.equal(isBindingYes("ja also ich weiß nicht ob Dienstag geht", "me", "confirm"), false);
  // Zweifel bucht nichts
  assert.equal(isBindingYes("ja", "unsure", "confirm"), false);
  assert.equal(isBindingYes("ja", "aside", "confirm"), false);
  // Außerhalb der Bestätigung bucht nichts
  assert.equal(isBindingYes("ja", "me", "time"), false);
  assert.equal(isBindingYes("ja", "me", "idle"), false);
});

test("Die Fehlerrichtung stimmt: lieber unsicher als falsch handeln", () => {
  // Ein Satz ohne erkennbare Absicht, ohne Marker: keinesfalls „me“
  const r = judge(say("das weiß ich noch nicht so genau"), exp({ stage: "date" }));
  assert.notEqual(r.verdict, "me", `${r.verdict} (${r.score})`);
});

test("Das Urteil ist nachvollziehbar und nennt keinen Wortlaut", () => {
  const r = judge(say("sag mal, wo ist der Kalender"), exp());
  assert.ok(r.reasons.length > 0);
  for (const reason of r.reasons) assert.match(reason, /^[a-z_]+$/, `Grund darf kein Text sein: ${reason}`);
  assert.equal(typeof r.score, "number");
});
