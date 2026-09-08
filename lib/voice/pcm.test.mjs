/**
 * Die Umrechnung zwischen Mikrofon und Leitung. Ein Fehler hier klingt
 * nicht nach einem Fehler, sondern nach schlechter Erkennung.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/pcm.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { floatToPcm16, pcm16ToFloat, resample, prepareFrame, levelDb, levelBar, TARGET_RATE } from "./pcm.ts";

test("Fließkomma zu ganzzahlig – auch an den Rändern, ohne Umklappen", () => {
  const out = floatToPcm16(Float32Array.from([0, 1, -1, 0.5, 2, -2]));
  assert.equal(out[0], 0);
  assert.equal(out[1], 32767);
  assert.equal(out[2], -32768);
  assert.equal(out[4], 32767, "über 1 wird begrenzt");
  assert.equal(out[5], -32768);
});

test("Der Rundlauf verliert nur, was acht zusätzliche Bit erklären", () => {
  const input = Float32Array.from({ length: 200 }, (_v, i) => Math.sin(i / 5) * 0.8);
  const back = pcm16ToFloat(floatToPcm16(input));
  for (let i = 0; i < input.length; i++) {
    assert.ok(Math.abs(back[i] - input[i]) < 1e-4, `bei ${i}: ${input[i]} → ${back[i]}`);
  }
});

test("Neuabtastung trifft die Länge und behält die Form", () => {
  const eineSekunde48k = new Float32Array(48_000);
  assert.equal(resample(eineSekunde48k, 48_000, TARGET_RATE).length, TARGET_RATE);
  const ramp = Float32Array.from({ length: 100 }, (_v, i) => i / 100);
  const up = resample(ramp, 8000, 24_000);
  assert.ok(Math.abs(up[0] - ramp[0]) < 1e-6);
  assert.ok(Math.abs(up[up.length - 1] - ramp[ramp.length - 1]) < 1e-6);
  for (let i = 1; i < up.length; i++) assert.ok(up[i] >= up[i - 1] - 1e-6, `Sprung bei ${i}`);
});

test("Gleiche Rate gibt eine Kopie, kein geteiltes Feld", () => {
  const input = Float32Array.from([0.1, 0.2]);
  const out = resample(input, TARGET_RATE, TARGET_RATE);
  out[0] = 0.9;
  assert.ok(Math.abs(input[0] - 0.1) < 1e-6);
});

test("Unsinnige Raten enden nicht in einem Absturz", () => {
  assert.throws(() => resample(Float32Array.from([1]), 0, 24_000), /positiv/);
  assert.equal(resample(new Float32Array(0), 48_000, 24_000).length, 0);
});

test("Der ganze Weg vom Worklet zur Leitung – auch wenn Safari eine andere Rate liefert", () => {
  const bei48k = Float32Array.from({ length: 960 }, (_v, i) => Math.sin((2 * Math.PI * 440 * i) / 48_000) * 0.5);
  const out = prepareFrame(bei48k, 48_000);
  assert.ok(out instanceof Int16Array);
  assert.equal(out.length, 480, "20 ms bei 24 kHz");

  const schon24k = Float32Array.from({ length: 480 }, () => 0.5);
  assert.equal(prepareFrame(schon24k, 24_000).length, 480);
});

test("Die Aussteuerung zeigt Stille als Stille und Sprache als Sprache", () => {
  assert.equal(levelDb(new Float32Array(100)), -Infinity);
  const laut = Float32Array.from({ length: 480 }, (_v, i) => Math.sin(i / 3) * 0.5);
  assert.ok(levelDb(laut) > -12, String(levelDb(laut)));
  const leise = Float32Array.from({ length: 480 }, (_v, i) => Math.sin(i / 3) * 0.001);
  assert.ok(levelDb(leise) < -50, String(levelDb(leise)));
  // Ganzzahlige Rahmen werden gleich bewertet
  assert.ok(Math.abs(levelDb(floatToPcm16(laut)) - levelDb(laut)) < 0.1);
});

test("Der Balken bleibt zwischen null und eins", () => {
  assert.equal(levelBar(-Infinity), 0);
  assert.equal(levelBar(-60), 0);
  assert.equal(levelBar(0), 1);
  assert.ok(levelBar(-30) > 0.4 && levelBar(-30) < 0.6);
  assert.equal(levelBar(20), 1, "über der Vollaussteuerung bleibt der Balken voll");
});
