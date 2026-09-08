/**
 * Die Zuhör-Sitzung gegen gestellte Bausteine: kein Browser, kein Netz,
 * kein Anbieter. Geprüft wird das, was Geld und Vertrauen kostet – dass
 * das Mikrofon nur auf Knopfdruck aufgeht und bei jedem Zweifel wieder zu.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/live.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { LiveSession } = await import("./live.ts");

const SECRET = { value: "ek_test", expiresAt: 0, sampleRate: 24000 };

function harness(over = {}) {
  const calls = { token: 0, mic: 0, connect: 0, close: 0, stopped: 0, transcripts: [], states: [] };
  let events = null;
  const track = { stop: () => { calls.stopped += 1; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const ports = {
    token: async () => { calls.token += 1; return SECRET; },
    microphone: async () => { calls.mic += 1; return stream; },
    connect: async (_s, _st, on) => {
      calls.connect += 1;
      events = on;
      return { close: () => { calls.close += 1; } };
    },
    onTranscript: (t) => calls.transcripts.push(t),
    onState: (s) => calls.states.push(s),
    ...over,
  };
  return { session: new LiveSession(ports), calls, fire: () => events };
}

test("Das Mikrofon geht nur auf Knopfdruck auf", async () => {
  const { session, calls } = harness();
  assert.equal(session.current, "idle");
  assert.equal(calls.mic, 0, "ohne Druck kein Mikrofon");
  await session.start();
  assert.equal(calls.mic, 1);
  assert.equal(session.current, "listening");
  assert.deepEqual(calls.states, ["connecting", "listening"]);
});

test("Ein erkannter Satz geht weiter, ein leerer nicht", async () => {
  const { session, calls, fire } = harness();
  await session.start();
  fire().transcript("   ");
  assert.deepEqual(calls.transcripts, [], "Stille ist keine Frage");
  assert.equal(session.current, "listening");
  fire().transcript("  Geht Dienstag nachmittags?  ");
  assert.deepEqual(calls.transcripts, ["Geht Dienstag nachmittags?"]);
  assert.equal(session.current, "answering", "solange der Automat antwortet, wird nicht neu gestartet");
  session.answered();
  assert.equal(session.current, "listening");
});

test("Aufhören schließt die Leitung und das Mikrofon – auch mehrfach gedrückt", async () => {
  const { session, calls } = harness();
  await session.start();
  await session.stop();
  assert.equal(calls.close, 1, "Leitung zu");
  assert.equal(calls.stopped, 1, "Mikrofon zu");
  assert.equal(session.current, "idle");
  await session.stop();
  assert.equal(calls.close, 1, "kein zweites Schließen");
});

test("Verweigerte Erlaubnis sagt das ehrlich, statt so zu tun als höre sie zu", async () => {
  const { session, calls } = harness({
    microphone: async () => {
      const e = new Error("nein");
      e.name = "NotAllowedError";
      throw e;
    },
  });
  await session.start();
  assert.equal(session.current, "denied");
  assert.equal(calls.connect, 0, "ohne Mikrofon keine Leitung");
});

test("Bricht die Leitung ab, wird aufgeräumt statt stumm weiterzulaufen", async () => {
  const { session, calls, fire } = harness();
  await session.start();
  fire().closed("failed");
  assert.equal(session.current, "idle");
  assert.equal(calls.stopped, 1, "das Mikrofon bleibt nicht offen");
});

test("Wer mitten im Verbinden abbricht, lässt kein offenes Mikrofon zurück", async () => {
  let freigeben;
  const warten = new Promise((r) => { freigeben = r; });
  const { session, calls } = harness({
    microphone: async () => {
      await warten;
      const track = { stop: () => { calls.stopped += 1; } };
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    },
  });
  const laeuft = session.start();
  await session.stop();
  freigeben();
  await laeuft;
  assert.equal(session.current, "idle");
  assert.equal(calls.stopped, 1, "das gerade geöffnete Mikrofon wird sofort wieder geschlossen");
  assert.equal(calls.connect, 0, "und es wird gar nicht erst verbunden");
});
