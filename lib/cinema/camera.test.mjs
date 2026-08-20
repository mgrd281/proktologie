/**
 * Tests der Kameramathematik und des Quellen-Registers – ohne Browser.
 * Ausführen: node --experimental-strip-types --test lib/cinema/camera.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { MAX_ZOOM, STILL_DPR_CAP, camAt, mixCam, sourceRectFor } = await import("./camera.ts");
const { AMBIENT_SOURCE, EXAM_SOURCE, SOURCES } = await import("./sources.ts");
const { TOTAL_FRAMES, FRAME_LAYERS, SCENES } = await import("./frames.ts");

test("Quellrechteck bleibt IMMER innerhalb der Bildgrenzen", () => {
  const { srcW, srcH } = EXAM_SOURCE;
  for (let f = 200; f <= 380; f += 0.5) {
    const cam = camAt(EXAM_SOURCE.camera, f);
    for (const [vw, vh] of [[1440, 900], [1280, 720], [390, 844], [2560, 1440]]) {
      const r = sourceRectFor(cam, srcW, srcH, vw, vh);
      assert.ok(r.sx >= -1e-9 && r.sy >= -1e-9, `negativ bei f=${f}`);
      assert.ok(r.sx + r.sw <= srcW + 1e-9, `rechts raus bei f=${f} ${vw}x${vh}`);
      assert.ok(r.sy + r.sh <= srcH + 1e-9, `unten raus bei f=${f} ${vw}x${vh}`);
      assert.ok(r.sw > 0 && r.sh > 0);
    }
  }
});

test("Kamerafahrt ist stetig und exakt umkehrbar", () => {
  const framesList = [];
  for (let f = 220; f <= 365; f += 0.25) framesList.push(f);
  let prev = camAt(EXAM_SOURCE.camera, framesList[0]);
  for (const f of framesList) {
    const cam = camAt(EXAM_SOURCE.camera, f);
    assert.ok(Math.abs(cam.x - prev.x) < 0.01, `x springt bei ${f}`);
    assert.ok(Math.abs(cam.y - prev.y) < 0.01, `y springt bei ${f}`);
    assert.ok(Math.abs(cam.zoom - prev.zoom) < 0.02, `zoom springt bei ${f}`);
    prev = cam;
  }
  const forward = framesList.map((f) => camAt(EXAM_SOURCE.camera, f));
  const backward = [...framesList].reverse().map((f) => camAt(EXAM_SOURCE.camera, f)).reverse();
  assert.deepEqual(forward, backward, "Kamerafahrt ist richtungsabhaengig");
});

test("Zoom respektiert den Aufloesungs-Deckel des gelieferten Fotos", () => {
  assert.ok(MAX_ZOOM <= 1.25 && STILL_DPR_CAP <= 1.5);
  for (const k of EXAM_SOURCE.camera) {
    assert.ok(k.cam.zoom <= MAX_ZOOM + 1e-9, `Keyframe bei ${k.at} zoomt ueber den Deckel`);
    assert.ok(k.cam.zoom >= 1);
  }
  // Hochskalierung an der engsten Stelle: <= 1.85x bei DPR-Cap
  const close = EXAM_SOURCE.camera[EXAM_SOURCE.camera.length - 1].cam;
  const r = sourceRectFor(close, EXAM_SOURCE.srcW, EXAM_SOURCE.srcH, 1440, 900);
  const upscale = (1440 * STILL_DPR_CAP) / r.sw;
  assert.ok(upscale <= 1.85, `Nahaufnahme ${upscale.toFixed(2)}x hochskaliert`);
});

test("Keyframes decken das Alpha-Band der Quelle ab (kein Pose-Sprung am Rand)", () => {
  const first = EXAM_SOURCE.camera[0].at;
  const last = EXAM_SOURCE.camera[EXAM_SOURCE.camera.length - 1].at;
  // Ausserhalb der Kette wird geklemmt – die Kette muss dort beginnen/enden,
  // wo die Quelle ein-/ausblendet, sonst staende die Kamera schon still.
  assert.ok(FRAME_LAYERS.exam(first) < 0.01, "Kamera startet nach dem Einblenden");
  assert.ok(FRAME_LAYERS.exam(last) < 0.01, "Kamera endet vor dem Ausblenden");
});

test("Registry: Spannen gueltig, Alphas ueberlappen die Szenengrenzen", () => {
  for (const src of SOURCES) {
    if (src.mode === "frames") {
      assert.ok(src.count > 0 && src.span[0] >= 1 && src.span[1] <= TOTAL_FRAMES);
      assert.ok(src.span[0] < src.span[1]);
      assert.ok(src.path(1).includes("0001"));
    } else {
      assert.ok(src.srcW > 0 && src.srcH > 0 && src.src && src.srcMobile);
    }
    // Jede Quelle ist irgendwo wirklich sichtbar
    let max = 0;
    for (let f = 1; f <= TOTAL_FRAMES; f++) max = Math.max(max, src.alpha(f));
    assert.ok(max > 0.99, `${src.id} wird nie voll sichtbar`);
  }
  // Die Ambient-Quelle traegt die Szenen 01–04 (Ende der 4. Szene: Beschwerden)
  assert.ok(AMBIENT_SOURCE.alpha(SCENES[3].last - 10) > 0.5);
});

test("mixCam interpoliert linear und klemmt t", () => {
  const a = { x: 0, y: 0, zoom: 1 };
  const b = { x: 1, y: 0.5, zoom: 1.2 };
  assert.deepEqual(mixCam(a, b, 0), a);
  assert.deepEqual(mixCam(a, b, 1), b);
  assert.deepEqual(mixCam(a, b, 2), b);
  const mid = mixCam(a, b, 0.5);
  assert.ok(Math.abs(mid.x - 0.5) < 1e-9 && Math.abs(mid.zoom - 1.1) < 1e-9);
});
