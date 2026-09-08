/**
 * Die Stimmerkennung entscheidet, wann der Assistent verstummt, was
 * bezahlt wird und was das Gerät überhaupt verlässt. Geprüft mit
 * erzeugtem Audio – kein Mikrofon, keine Datei, kein Zufall.
 *
 * Ausführen:  node --test lib/voice/audio/vad.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { feed, initialVad, frameDb, DEFAULT_VAD } = await import("./vad.ts");

const RATE = 24_000;
const FRAME = (RATE * DEFAULT_VAD.frameMs) / 1000; // 480 Samples

/** Ein Rahmen Sinus mit gegebener Amplitude (0..1). */
function tone(amplitude, phase = 0) {
  const out = new Int16Array(FRAME);
  for (let i = 0; i < FRAME; i++) out[i] = Math.round(Math.sin((2 * Math.PI * 220 * (i + phase)) / RATE) * amplitude * 32767);
  return out;
}

/** Ein Rahmen Rauschen mit gegebener Amplitude – deterministisch. */
let seed = 42;
function noise(amplitude) {
  const out = new Int16Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = Math.round(((seed / 0xffffffff) * 2 - 1) * amplitude * 32767);
  }
  return out;
}

const silence = () => new Int16Array(FRAME);

/** Rahmen der Reihe nach einspeisen und die Kanten sammeln. */
function run(frames, { speaking = false, state = initialVad() } = {}) {
  const edges = [];
  let s = state;
  for (const f of frames) {
    const r = feed(s, f, speaking);
    s = r.state;
    if (r.result.edge !== "none") edges.push(r.result);
  }
  return { state: s, edges };
}

const rep = (frame, n) => Array.from({ length: n }, () => frame);

// ----------------------------------------------------------- Grundlagen

test("Der Pegel wird richtig gemessen: Stille ist minus unendlich, laut ist nahe null", () => {
  assert.equal(frameDb(silence()), -Infinity);
  assert.ok(frameDb(tone(1.0)) > -5, String(frameDb(tone(1.0))));
  assert.ok(frameDb(tone(0.01)) < -30, String(frameDb(tone(0.01))));
  assert.equal(frameDb([]), -Infinity);
});

test("Stille allein löst nie eine Äußerung aus", () => {
  const { edges } = run(rep(silence(), 200));
  assert.deepEqual(edges, []);
});

// -------------------------------------------------------- Eine Äußerung

test("Sprache beginnt und endet – mit Dauer", () => {
  const { edges } = run([
    ...rep(noise(0.001), 60), // Raumgeräusch, der Boden pendelt sich ein
    ...rep(tone(0.3), 50), // eine Sekunde Sprache
    ...rep(noise(0.001), 40), // Stille, länger als der Nachlauf
  ]);
  assert.equal(edges.length, 2, JSON.stringify(edges));
  assert.equal(edges[0].edge, "start");
  assert.equal(edges[1].edge, "end");
  assert.ok(edges[1].durationMs >= 900, `zu kurz gemessen: ${edges[1].durationMs}`);
});

test("Ein einzelner Knall ist keine Sprache", () => {
  const { edges } = run([...rep(noise(0.001), 60), tone(0.5), ...rep(noise(0.001), 40)]);
  assert.deepEqual(edges, [], "ein Rahmen reicht nicht");
});

test("Erst nach mehreren stimmhaften Rahmen gilt es als Sprache", () => {
  const kurz = run([...rep(noise(0.001), 60), ...rep(tone(0.4), DEFAULT_VAD.onFrames - 1), ...rep(noise(0.001), 40)]);
  assert.deepEqual(kurz.edges, []);
  const lang = run([...rep(noise(0.001), 60), ...rep(tone(0.4), DEFAULT_VAD.onFrames), ...rep(noise(0.001), 40)]);
  assert.equal(lang.edges[0]?.edge, "start");
});

test("Eine kurze Pause im Satz beendet die Äußerung nicht", () => {
  const luecke = Math.floor(DEFAULT_VAD.hangoverMs / DEFAULT_VAD.frameMs) - 3;
  const { edges } = run([
    ...rep(noise(0.001), 60),
    ...rep(tone(0.3), 25),
    ...rep(noise(0.001), luecke), // Atempause
    ...rep(tone(0.3), 25),
    ...rep(noise(0.001), 40),
  ]);
  assert.equal(edges.filter((e) => e.edge === "start").length, 1, "nur ein Satzanfang");
  assert.equal(edges.filter((e) => e.edge === "end").length, 1);
});

// ------------------------------------------- Anpassung an die Umgebung

test("In lauter Umgebung hebt sich der Boden – leise Geräusche lösen dann nichts aus", () => {
  const laut = run(rep(noise(0.05), 200));
  assert.deepEqual(laut.edges, [], "gleichmäßiges Rauschen ist keine Sprache");
  assert.ok(laut.state.noiseDb > -45, `Boden nicht mitgewachsen: ${laut.state.noiseDb}`);

  // In dieser lauten Umgebung muss Sprache trotzdem erkannt werden
  const dann = run(rep(tone(0.4), 30), { state: laut.state });
  assert.equal(dann.edges[0]?.edge, "start");
});

test("Der Rauschboden wächst während einer Äußerung nicht mit", () => {
  const vorher = run(rep(noise(0.001), 60));
  const waehrend = run(rep(tone(0.4), 100), { state: vorher.state });
  assert.ok(Math.abs(waehrend.state.noiseDb - vorher.state.noiseDb) < 1, "sonst schaltet er mitten im Satz ab");
  assert.equal(waehrend.edges.filter((e) => e.edge === "end").length, 0, "die Äußerung läuft noch");
});

// ------------------------------------------------ Selbstunterbrechung

test("Während der Assistent spricht, liegt die Schwelle höher", () => {
  const boden = run(rep(noise(0.001), 60)).state;
  // Ein Pegel zwischen den beiden Schwellen: still, solange wir selbst
  // reden, aber deutlich genug, wenn wir schweigen.
  const zwischen = boden.noiseDb + (DEFAULT_VAD.openDb + DEFAULT_VAD.openDbWhileSpeaking) / 2;
  const leise = tone(Math.SQRT2 * 10 ** (zwischen / 20));
  const mitAusgabe = run(rep(leise, 30), { state: boden, speaking: true });
  const ohneAusgabe = run(rep(leise, 30), { state: boden, speaking: false });
  assert.deepEqual(mitAusgabe.edges, [], "der eigene Lautsprecher darf nicht unterbrechen");
  assert.equal(ohneAusgabe.edges[0]?.edge, "start", "derselbe Pegel zählt, wenn wir schweigen");
});

test("Deutlich lautere Sprache unterbricht auch die laufende Ausgabe", () => {
  const boden = run(rep(noise(0.001), 60)).state;
  const { edges } = run(rep(tone(0.4), 20), { state: boden, speaking: true });
  assert.equal(edges[0]?.edge, "start", "wer wirklich spricht, unterbricht immer");
});

// ------------------------------------------------ Abgewandt gesprochen

test("Leiser als sonst gesprochen ergibt einen negativen Relativpegel", () => {
  let state = run(rep(noise(0.001), 60)).state;
  // Zwei normale Äußerungen setzen den Sprechpegel der Sitzung
  for (let i = 0; i < 2; i++) {
    const r = run([...rep(tone(0.3), 40), ...rep(noise(0.001), 40)], { state });
    state = r.state;
  }
  assert.ok(state.speechDb !== null);

  const abgewandt = run([...rep(tone(0.05), 40), ...rep(noise(0.001), 40)], { state });
  const ende = abgewandt.edges.find((e) => e.edge === "end");
  assert.ok(ende, "die leise Äußerung wird trotzdem erkannt");
  assert.ok(ende.relativeDb < -9, `nicht als abgewandt erkannt: ${ende.relativeDb}`);
});

test("Gleich laut gesprochen ergibt einen Relativpegel nahe null", () => {
  let state = run(rep(noise(0.001), 60)).state;
  for (let i = 0; i < 2; i++) {
    const r = run([...rep(tone(0.3), 40), ...rep(noise(0.001), 40)], { state });
    state = r.state;
  }
  const gleich = run([...rep(tone(0.3), 40), ...rep(noise(0.001), 40)], { state });
  const ende = gleich.edges.find((e) => e.edge === "end");
  assert.ok(Math.abs(ende.relativeDb) < 3, `unerwartet weit weg: ${ende.relativeDb}`);
});

// ------------------------------------------------------------ Sauberkeit

test("Der übergebene Zustand wird nie verändert", () => {
  const before = initialVad();
  const snapshot = JSON.stringify(before);
  feed(before, tone(0.5));
  assert.equal(JSON.stringify(before), snapshot);
});
