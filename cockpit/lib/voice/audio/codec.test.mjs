/**
 * Die Telefonkante. Hier ist ein Fehler besonders teuer, weil er sich als
 * schlechte Erkennung tarnt statt als Absturz: ein falscher Pegel, ein
 * vertauschtes Vorzeichen, eine um eine Probe verschobene Abtastung – und
 * der Assistent versteht ältere Anrufer plötzlich nicht mehr, ohne dass
 * irgendwo ein Fehler im Protokoll steht.
 *
 * Ausführen:  node --test lib/voice/audio/codec.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { encodeMulaw, decodeMulaw, encodeMulawBuffer, decodeMulawBuffer, resample, phoneToPcm24, pcm24ToPhone, floatToPcm16 } =
  await import("./codec.ts");

// ------------------------------------------------------------- µ-law

test("Alle µ-law-Bytes überstehen den Rundlauf – bis auf die zweite Null, die es in G.711 gibt", () => {
  // G.711 kennt zwei Codes für die Null: 0xFF (positiv) und 0x7F
  // (negativ). Beide dekodieren zu 0, und 0 kodiert immer zu 0xFF. Das
  // ist keine Ungenauigkeit dieser Umsetzung, sondern die Norm; der Test
  // hält es fest, damit niemand es später für einen Fehler hält.
  const NEGATIVE_ZERO = 0x7f;
  for (let byte = 0; byte < 256; byte++) {
    const linear = decodeMulaw(byte);
    const back = encodeMulaw(linear);
    if (byte === NEGATIVE_ZERO) {
      assert.equal(linear, 0);
      assert.equal(back, 0xff, "die negative Null kodiert zur positiven");
      continue;
    }
    assert.equal(back, byte, `Byte ${byte} → ${linear} → ${back}`);
  }
});

test("Nur die beiden Null-Codes bilden auf denselben Wert ab", () => {
  const seen = new Map();
  for (let byte = 0; byte < 256; byte++) {
    const linear = decodeMulaw(byte);
    const other = seen.get(linear);
    if (other !== undefined) {
      assert.deepEqual([other, byte].sort((a, b) => a - b), [0x7f, 0xff], `unerwartete Dopplung bei ${linear}`);
    }
    seen.set(linear, byte);
  }
  assert.equal(seen.size, 255, "255 verschiedene Werte aus 256 Codes");
});

test("Stille bleibt Stille, und das Vorzeichen bleibt erhalten", () => {
  assert.equal(decodeMulaw(encodeMulaw(0)), 0);
  for (const v of [1000, 5000, 20000, 32000]) {
    assert.ok(decodeMulaw(encodeMulaw(v)) > 0, `${v} verlor das Vorzeichen`);
    assert.ok(decodeMulaw(encodeMulaw(-v)) < 0, `${-v} verlor das Vorzeichen`);
  }
});

test("Der Fehler bleibt im Rahmen dessen, was acht Bit hergeben", () => {
  // µ-law ist logarithmisch: leise Stellen sind genau, laute grob. Der
  // relative Fehler muss überall klein bleiben, sonst klingt es verzerrt.
  for (let v = -32000; v <= 32000; v += 137) {
    const back = decodeMulaw(encodeMulaw(v));
    const error = Math.abs(back - v);
    const allowed = Math.max(8, Math.abs(v) * 0.09);
    assert.ok(error <= allowed, `${v} → ${back} (Fehler ${error}, erlaubt ${allowed})`);
  }
});

test("Übersteuerung wird begrenzt, nicht umgeklappt", () => {
  assert.ok(decodeMulaw(encodeMulaw(40000)) > 30000, "positiv bleibt positiv");
  assert.ok(decodeMulaw(encodeMulaw(-40000)) < -30000, "negativ bleibt negativ");
});

test("Ganze Puffer verhalten sich wie einzelne Proben", () => {
  const pcm = Int16Array.from([0, 100, -100, 12345, -12345, 32767, -32768]);
  const back = decodeMulawBuffer(encodeMulawBuffer(pcm));
  assert.equal(back.length, pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    assert.equal(Math.sign(back[i]), Math.sign(pcm[i]), `Vorzeichen bei ${i}`);
  }
});

// -------------------------------------------------------- Neuabtastung

test("Gleiche Rate ändert nichts – gibt aber eine eigene Kopie zurück", () => {
  const input = Int16Array.from([1, 2, 3]);
  const out = resample(input, 24_000, 24_000);
  assert.deepEqual([...out], [1, 2, 3]);
  out[0] = 99;
  assert.equal(input[0], 1, "das Original darf nicht mitverändert werden");
});

test("Hoch- und Herunterrechnen trifft die erwartete Länge", () => {
  const eineSekunde8k = new Int16Array(8000);
  assert.equal(resample(eineSekunde8k, 8000, 24_000).length, 24_000);
  const eineSekunde24k = new Int16Array(24_000);
  assert.equal(resample(eineSekunde24k, 24_000, 8000).length, 8000);
  assert.equal(resample(new Int16Array(48_000), 48_000, 24_000).length, 24_000);
});

test("Eine Rampe bleibt eine Rampe – die Form überlebt die Neuabtastung", () => {
  const ramp = Int16Array.from({ length: 100 }, (_v, i) => i * 100);
  const up = resample(ramp, 8000, 24_000);
  assert.equal(up[0], ramp[0], "Anfang");
  assert.equal(up[up.length - 1], ramp[ramp.length - 1], "Ende");
  // monoton steigend
  for (let i = 1; i < up.length; i++) assert.ok(up[i] >= up[i - 1], `Sprung bei ${i}`);
});

test("Ein Sinus behält beim Rundlauf seine Energie", () => {
  const rate = 24_000;
  const input = Int16Array.from({ length: rate }, (_v, i) => Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000));
  const rundlauf = resample(resample(input, rate, 8000), 8000, rate);
  const energie = (a) => Math.sqrt([...a].reduce((sum, v) => sum + v * v, 0) / a.length);
  const vorher = energie(input);
  const nachher = energie(rundlauf);
  assert.ok(Math.abs(nachher - vorher) / vorher < 0.1, `Energie verloren: ${vorher} → ${nachher}`);
});

test("Leere Eingabe und unsinnige Raten enden nicht in einem Absturz", () => {
  assert.equal(resample(new Int16Array(0), 8000, 24_000).length, 0);
  assert.throws(() => resample(Int16Array.from([1]), 0, 24_000), /positiv/);
  assert.throws(() => resample(Int16Array.from([1]), 8000, -1), /positiv/);
});

// -------------------------------------------------------- Telefonkante

test("Der ganze Telefonweg hin und zurück behält Länge und Form", () => {
  const rate = 24_000;
  const gesprochen = Int16Array.from({ length: rate / 2 }, (_v, i) => Math.round(Math.sin((2 * Math.PI * 300 * i) / rate) * 6000));
  const zumTelefon = pcm24ToPhone(gesprochen);
  assert.equal(zumTelefon.length, rate / 2 / 3, "8 kHz ist ein Drittel von 24 kHz");
  const zurueck = phoneToPcm24(zumTelefon);
  assert.equal(zurueck.length, gesprochen.length);
  const energie = (a) => Math.sqrt([...a].reduce((sum, v) => sum + v * v, 0) / a.length);
  assert.ok(Math.abs(energie(zurueck) - energie(gesprochen)) / energie(gesprochen) < 0.15);
});

test("Was das Telefon nicht überträgt, kommt auch nicht zurück", () => {
  // 6 kHz liegt weit über dem, was ein 8-kHz-Kanal tragen kann. Der Test
  // hält fest, dass Hochrechnen keine Information erfindet – wichtig für
  // die ehrliche Erwartung an die Erkennungsqualität am Telefon.
  const rate = 24_000;
  const hoch = Int16Array.from({ length: rate / 4 }, (_v, i) => Math.round(Math.sin((2 * Math.PI * 6000 * i) / rate) * 8000));
  const zurueck = phoneToPcm24(pcm24ToPhone(hoch));
  const energie = (a) => Math.sqrt([...a].reduce((sum, v) => sum + v * v, 0) / a.length);
  assert.ok(energie(zurueck) < energie(hoch) * 0.7, "der hohe Ton müsste stark gedämpft sein");
});

// ------------------------------------------------------------- Browser

test("Float aus dem Worklet wird sauber zu PCM16 – auch an den Rändern", () => {
  const out = floatToPcm16(Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -2]));
  assert.equal(out[0], 0);
  assert.equal(out[1], 32767);
  assert.equal(out[2], -32768);
  assert.equal(out[5], 32767, "über 1 wird begrenzt, nicht umgeklappt");
  assert.equal(out[6], -32768);
});
