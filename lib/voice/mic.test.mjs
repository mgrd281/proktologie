/**
 * Der Mikrofonknopf. Hier stehen die Regeln, die im Betrieb Geld und
 * Vertrauen kosten, wenn sie fehlen: Das Mikrofon öffnet sich nur auf
 * Knopfdruck, es schließt sich beim Tabwechsel, und eine verweigerte
 * Erlaubnis wird ehrlich angezeigt statt stumm ignoriert.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/mic.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MicController, DEFAULT_MIC_LIMITS } from "./mic.ts";

function ports(over = {}) {
  const sent = [];
  const states = [];
  const levels = [];
  let opened = 0;
  let closed = 0;
  const p = {
    open: async () => {
      opened += 1;
      return { sampleRate: 48_000 };
    },
    close: async () => {
      closed += 1;
    },
    send: (frame) => sent.push(frame),
    onState: (s, d) => states.push([s, d?.reason]),
    onLevel: (db) => levels.push(db),
    ...over,
  };
  return { p, sent, states, levels, counts: () => ({ opened, closed }) };
}

const frame = (n = 960, amplitude = 0.3) => Float32Array.from({ length: n }, (_v, i) => Math.sin(i / 4) * amplitude);

test("Ohne Knopfdruck passiert nichts – kein offenes Mikrofon, kein Zähler", async () => {
  const { p, sent, counts } = ports();
  const mic = new MicController(p);
  mic.push(frame());
  assert.deepEqual(sent, [], "ohne Start wird nichts gesendet");
  assert.equal(counts().opened, 0, "das Mikrofon wurde nie angefordert");
  assert.equal(mic.current, "idle");
});

test("Der Knopf öffnet das Mikrofon und schickt Rahmen in der richtigen Rate", async () => {
  const { p, sent, states } = ports();
  const mic = new MicController(p);
  await mic.start();
  assert.deepEqual(states.map((s) => s[0]), ["asking", "listening"]);
  mic.push(frame(960));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, 480, "48 kHz herein, 24 kHz hinaus");
  assert.ok(sent[0] instanceof Int16Array);
});

test("Verweigerte Erlaubnis wird ehrlich angezeigt, nicht stumm verschluckt", async () => {
  const fehler = new Error("nope");
  fehler.name = "NotAllowedError";
  const { p, states, counts } = ports({
    open: async () => {
      throw fehler;
    },
  });
  const mic = new MicController(p);
  await mic.start();
  assert.equal(mic.current, "denied");
  assert.deepEqual(states.map((s) => s[0]), ["asking", "denied"]);
  assert.ok(counts().closed >= 1, "das Mikrofon bleibt nicht halb offen");
});

test("Ein anderer Fehler ist ein Fehler, keine Verweigerung", async () => {
  const { p } = ports({
    open: async () => {
      throw new Error("Gerät belegt");
    },
  });
  const mic = new MicController(p);
  await mic.start();
  assert.equal(mic.current, "error");
});

test("Wer währenddessen abbricht, lässt kein offenes Mikrofon zurück", async () => {
  let loesen;
  const { p, counts } = ports({
    open: () =>
      new Promise((resolve) => {
        loesen = () => resolve({ sampleRate: 48_000 });
      }),
  });
  const mic = new MicController(p);
  const start = mic.start();
  await mic.stop("user");
  loesen();
  await start;
  assert.equal(mic.current, "idle");
  assert.ok(counts().closed >= 1);
});

test("Der Tabwechsel beendet die Aufnahme", async () => {
  const { p, sent, counts } = ports();
  const mic = new MicController(p);
  await mic.start();
  mic.push(frame());
  await mic.stop("hidden");
  const vorher = sent.length;
  mic.push(frame());
  assert.equal(sent.length, vorher, "nach dem Ende wird nichts mehr gesendet");
  assert.equal(counts().closed, 1);
});

test("Eine tote Leitung wird erkannt und beendet", async () => {
  const { p } = ports();
  const mic = new MicController(p);
  await mic.start(0);
  mic.push(frame(), 1000);
  mic.tick(1000 + DEFAULT_MIC_LIMITS.idleMs - 1);
  assert.equal(mic.current, "listening");
  mic.tick(1000 + DEFAULT_MIC_LIMITS.idleMs);
  await new Promise((r) => setImmediate(r));
  assert.equal(mic.current, "idle");
});

test("Die Obergrenze je Sitzung greift, bevor eine Rechnung überrascht", async () => {
  const { p, sent } = ports();
  const mic = new MicController(p, { maxSeconds: 0.5, idleMs: 1e9 });
  await mic.start();
  // Jeder Rahmen sind 20 ms bei 48 kHz
  for (let i = 0; i < 100; i++) mic.push(frame(960), i * 20);
  await new Promise((r) => setImmediate(r));
  assert.equal(mic.current, "idle");
  assert.ok(sent.length <= 26, `zu viel gesendet: ${sent.length}`);
  assert.ok(mic.sentSeconds >= 0.5);
});

test("Während der Assistent spricht, bleibt das Mikrofon offen", async () => {
  const { p, sent, states } = ports();
  const mic = new MicController(p);
  await mic.start();
  mic.speaking(true);
  assert.equal(mic.current, "speaking");
  mic.push(frame());
  assert.equal(sent.length, 1, "sonst wäre Unterbrechen unmöglich");
  mic.speaking(false);
  assert.equal(mic.current, "listening");
  assert.deepEqual(states.map((s) => s[0]), ["asking", "listening", "speaking", "listening"]);
});

test("Die Aussteuerung wird gemeldet, damit ein stummes Mikrofon auffällt", async () => {
  const { p, levels } = ports();
  const mic = new MicController(p);
  await mic.start();
  mic.push(frame(960, 0.5));
  mic.push(new Float32Array(960));
  assert.equal(levels.length, 2);
  assert.ok(levels[0] > -20, String(levels[0]));
  assert.equal(levels[1], -Infinity, "Stille ist sichtbar Stille");
});
