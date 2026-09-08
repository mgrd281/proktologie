/**
 * Die drei Zusagen an den Patienten, geprüft ohne Mikrofon:
 * unterbrechen gilt, im Zweifel schweigen, und ein Termin entsteht nie
 * aus einem „ja", das jemand anderem galt.
 *
 * Ausführen:  node --test lib/voice/turn.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { step, initialState, DEFAULT_CONFIG } = await import("./turn.ts");

/**  Ein einfacher Absichtsprüfer, der dem echten Automaten nachempfunden ist. */
const KNOWN = /(termin|buchen|öffnungszeit|sprechzeit|anfahrt|adresse|absagen|verschieben|dienstag|montag|mittwoch|donnerstag|freitag|uhr|vormittag|nachmittag|appointment|opening|directions|book)/iu;
const YES_NO = /^(ja|nein|yes|no)\b/iu;
const addressing = (over = {}) => ({
  hasIntent: (t) => KNOWN.test(t) || YES_NO.test(t),
  awaitingConfirmation: false,
  lang: "de",
  ...over,
});

/** Eine Folge von Ereignissen durchlaufen und alle Anweisungen sammeln. */
function run(events, addr = addressing(), config = DEFAULT_CONFIG) {
  let state = initialState(0);
  const actions = [];
  for (const e of events) {
    const r = step(state, e, addr, config);
    state = r.state;
    actions.push(...r.actions);
  }
  return { state, actions };
}

const dos = (actions) => actions.map((a) => a.do);

// -------------------------------------------------- 1. Unterbrechen gilt

test("Spricht der Patient, verstummt der Assistent sofort", () => {
  const { state, actions } = run([
    { kind: "speech_out_started", at: 0 },
    { kind: "speech_started", at: 300 },
  ]);
  assert.deepEqual(dos(actions), ["stop_output"]);
  assert.equal(actions[0].reason, "barge_in");
  assert.equal(state.phase, "hearing");
});

test("Ohne laufende Ausgabe wird nichts abgebrochen", () => {
  const { actions } = run([{ kind: "speech_started", at: 100 }]);
  assert.deepEqual(dos(actions), []);
});

test("Unterbrechung mitten im Satz: der neue Satz zählt, der alte wird nicht zu Ende geredet", () => {
  const { actions } = run([
    { kind: "speech_out_started", at: 0 },
    { kind: "speech_started", at: 200 },
    { kind: "partial", at: 400, text: "nein, lieber" },
    { kind: "final", at: 900, text: "nein, lieber Donnerstag" },
  ]);
  assert.deepEqual(dos(actions), ["stop_output", "send"]);
  assert.equal(actions[1].text, "nein, lieber Donnerstag");
});

// ------------------------------------------- 2. Im Zweifel schweigen

test("Ein kurzer Satz, der zu nichts passt, gilt nicht uns – und bleibt unbeantwortet", () => {
  const { actions } = run([{ kind: "final", at: 100, text: "wo ist denn die Brille" }]);
  assert.deepEqual(dos(actions), ["ignore"]);
  assert.equal(actions[0].reason, "not_addressed");
});

test("Nebenrede an eine dritte Person wird erkannt", () => {
  const { actions } = run([{ kind: "final", at: 100, text: "sag mal, hast du den Kalender gesehen" }]);
  assert.deepEqual(dos(actions), ["ignore"]);
  assert.equal(actions[0].reason, "not_addressed");
});

test("„Moment, ich frage kurz“ heißt warten – nicht antworten, nicht auflegen", () => {
  const { state, actions } = run([{ kind: "final", at: 100, text: "Moment, ich frage kurz meine Frau" }]);
  assert.deepEqual(dos(actions), ["ignore"]);
  assert.equal(actions[0].reason, "asked_to_wait");
  assert.equal(state.waiting, true);
});

test("Wer wartet, bekommt die doppelte Stille, bevor übergeben wird", () => {
  const warten = run([
    { kind: "final", at: 0, text: "Einen Moment bitte" },
    { kind: "tick", at: DEFAULT_CONFIG.silenceHandoverMs + 1000 },
  ]);
  assert.deepEqual(dos(warten.actions).filter((d) => d === "handover"), [], "noch nicht übergeben");

  const spaeter = run([
    { kind: "final", at: 0, text: "Einen Moment bitte" },
    { kind: "tick", at: DEFAULT_CONFIG.silenceHandoverMs * 2 + 100 },
  ]);
  assert.ok(dos(spaeter.actions).includes("handover"), "irgendwann übernimmt der Empfang");
});

test("Füllwörter und unsichere Erkennung lösen nichts aus", () => {
  const fueller = run([{ kind: "final", at: 100, text: "ähm" }]);
  assert.equal(fueller.actions[0].reason, "no_content");
  const unsicher = run([{ kind: "final", at: 100, text: "Termin am Dienstag", confidence: 0.2 }]);
  assert.equal(unsicher.actions[0].reason, "low_confidence");
});

test("Zweimal nichts Zuordenbares: einmal freundlich nachfragen, dann wieder still", () => {
  const { actions, state } = run([
    { kind: "final", at: 100, text: "wo ist die Brille" },
    { kind: "final", at: 200, text: "gleich, ja" },
  ]);
  assert.ok(dos(actions).includes("say"));
  const nachfrage = actions.find((a) => a.do === "say");
  assert.equal(nachfrage.reason, "still_there");
  assert.match(nachfrage.text, /Sind Sie noch dran/);
  assert.equal(state.unmatched, 0, "der Zähler beginnt von vorn");
});

test("Ein langer Satz ohne erkennbare Absicht geht trotzdem durch – der Automat antwortet ehrlich", () => {
  const { actions } = run([
    { kind: "final", at: 100, text: "Ich wollte fragen ob Sie vielleicht auch etwas ganz anderes anbieten können in dieser Sache" },
  ]);
  assert.deepEqual(dos(actions), ["send"]);
});

test("Ein Satz mit Absicht geht durch, egal wie kurz", () => {
  const { actions } = run([{ kind: "final", at: 100, text: "Termin" }]);
  assert.deepEqual(dos(actions), ["send"]);
});

// -------------------------------- 3. Keine Buchung aus einem fremden Ja

test("Bloßes „ja“ auf die Bestätigungsfrage bucht nicht, sondern fragt einmal zurück", () => {
  const addr = addressing({ awaitingConfirmation: true });
  const { state, actions } = run([{ kind: "final", at: 100, text: "ja" }], addr);
  assert.deepEqual(dos(actions), ["say"]);
  assert.equal(actions[0].reason, "reconfirm");
  assert.match(actions[0].text, /verbindlich/);
  assert.equal(state.reconfirmAsked, true);
  assert.ok(!dos(actions).includes("send"), "nichts wird gebucht");
});

test("Eine klare Zusage bucht sofort", () => {
  const addr = addressing({ awaitingConfirmation: true });
  const { actions } = run([{ kind: "final", at: 100, text: "Ja, bitte buchen" }], addr);
  assert.deepEqual(dos(actions), ["send"]);
});

test("Nach der Rückfrage zählt auch ein knappes Ja", () => {
  const addr = addressing({ awaitingConfirmation: true });
  let state = initialState(0);
  let r = step(state, { kind: "final", at: 100, text: "ja" }, addr);
  assert.equal(r.actions[0].do, "say");
  r = step(r.state, { kind: "final", at: 3000, text: "ja" }, addr);
  assert.deepEqual(dos(r.actions), ["send"]);
});

test("Außerhalb der Bestätigungsfrage bleibt ein „ja“ ein ganz normales Ja", () => {
  const { actions } = run([{ kind: "final", at: 100, text: "ja" }], addressing({ awaitingConfirmation: false }));
  assert.deepEqual(dos(actions), ["send"]);
});

// ------------------------------------------------------------ Grenzen

test("Langes Schweigen übergibt an den Empfang", () => {
  const { actions } = run([{ kind: "tick", at: DEFAULT_CONFIG.silenceHandoverMs + 1 }]);
  assert.deepEqual(dos(actions), ["handover"]);
  assert.equal(actions[0].reason, "silence");
});

test("Während der Assistent spricht oder denkt, wird nicht wegen Stille übergeben", () => {
  const spricht = run([
    { kind: "speech_out_started", at: 0 },
    { kind: "tick", at: DEFAULT_CONFIG.silenceHandoverMs + 1000 },
  ]);
  assert.deepEqual(dos(spricht.actions), []);
});

test("Ein endloses Gespräch endet beim Empfang statt in der Schleife", () => {
  const events = [];
  for (let i = 0; i <= DEFAULT_CONFIG.maxTurns; i++) events.push({ kind: "final", at: i * 1000 + 100, text: "Termin bitte" });
  const { actions } = run(events);
  assert.equal(dos(actions).filter((d) => d === "send").length, DEFAULT_CONFIG.maxTurns);
  assert.equal(dos(actions).at(-1), "handover");
});

test("Englisch: Rückfrage und Nachfrage kommen auf Englisch", () => {
  const addr = addressing({ awaitingConfirmation: true, lang: "en" });
  const { actions } = run([{ kind: "final", at: 100, text: "yes" }], addr);
  assert.match(actions[0].text, /shall I book/);
});

test("Der Zustand bleibt eine reine Kopie – nichts wird im Vorbei geändert", () => {
  const before = initialState(0);
  const snapshot = JSON.stringify(before);
  step(before, { kind: "final", at: 100, text: "Termin am Dienstag" }, addressing());
  assert.equal(JSON.stringify(before), snapshot, "der übergebene Zustand bleibt unberührt");
});
