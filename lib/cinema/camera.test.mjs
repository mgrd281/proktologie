/**
 * Tests der Kameramathematik und des Quellen-Registers – ohne Browser.
 * Ausführen: node --experimental-strip-types --test lib/cinema/camera.test.mjs
 *
 * Die Kameramathe trägt aktuell keine Live-Quelle (der Film ist offline
 * gebacken, scripts/bake-film.mjs), bleibt aber der Renderpfad künftiger
 * Still-Quellen – getestet wird sie an der früheren Untersuchungsraum-
 * Fahrt als repräsentativer Keyframe-Kette.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { MAX_ZOOM, STILL_DPR_CAP, camAt, mixCam, sourceRectFor } = await import("./camera.ts");
const { FILM_DESKTOP, FILM_MOBILE, SOURCES } = await import("./sources.ts");
const { TOTAL_FRAMES } = await import("./frames.ts");

/** Repräsentative Still-Fahrt (ehemalige Untersuchungsraum-Kamera). */
const SAMPLE = {
  srcW: 1536,
  srcH: 1024,
  camera: [
    { at: 228, cam: { x: 0.5, y: 0.42, zoom: 1.0 } },
    { at: 290.5, cam: { x: 0.58, y: 0.46, zoom: 1.09 } },
    { at: 355, cam: { x: 0.42, y: 0.6, zoom: 1.2 } },
  ],
};

test("Quellrechteck bleibt IMMER innerhalb der Bildgrenzen", () => {
  const { srcW, srcH } = SAMPLE;
  for (let f = 200; f <= 380; f += 0.5) {
    const cam = camAt(SAMPLE.camera, f);
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
  let prev = camAt(SAMPLE.camera, framesList[0]);
  for (const f of framesList) {
    const cam = camAt(SAMPLE.camera, f);
    assert.ok(Math.abs(cam.x - prev.x) < 0.01, `x springt bei ${f}`);
    assert.ok(Math.abs(cam.y - prev.y) < 0.01, `y springt bei ${f}`);
    assert.ok(Math.abs(cam.zoom - prev.zoom) < 0.02, `zoom springt bei ${f}`);
    prev = cam;
  }
  const forward = framesList.map((f) => camAt(SAMPLE.camera, f));
  const backward = [...framesList].reverse().map((f) => camAt(SAMPLE.camera, f)).reverse();
  assert.deepEqual(forward, backward, "Kamerafahrt ist richtungsabhaengig");
});

test("Zoom respektiert den Aufloesungs-Deckel des gelieferten Fotos", () => {
  assert.ok(MAX_ZOOM <= 1.25 && STILL_DPR_CAP <= 1.5);
  for (const k of SAMPLE.camera) {
    assert.ok(k.cam.zoom <= MAX_ZOOM + 1e-9, `Keyframe bei ${k.at} zoomt ueber den Deckel`);
    assert.ok(k.cam.zoom >= 1);
  }
  // Hochskalierung an der engsten Stelle: <= 1.85x bei DPR-Cap
  const close = SAMPLE.camera[SAMPLE.camera.length - 1].cam;
  const r = sourceRectFor(close, SAMPLE.srcW, SAMPLE.srcH, 1440, 900);
  const upscale = (1440 * STILL_DPR_CAP) / r.sw;
  assert.ok(upscale <= 1.85, `Nahaufnahme ${upscale.toFixed(2)}x hochskaliert`);
});

test("Registry: der Film traegt die GESAMTE Timeline auf beiden Geraeteklassen", () => {
  const frames = SOURCES.filter((s) => s.mode === "frames");
  assert.equal(frames.length, 2);
  assert.equal(frames.filter((s) => s.media === "desktop").length, 1);
  assert.equal(frames.filter((s) => s.media === "mobile").length, 1);

  for (const src of frames) {
    assert.deepEqual(src.span, [1, TOTAL_FRAMES], `${src.id} traegt nicht alles`);
    assert.ok(src.path(1).includes("0001"));
    assert.ok(src.path(1).startsWith(`/sequence/${src.media}/`), src.path(1));
    // Immer voll sichtbar – die Blenden liegen IM gebackenen Material
    for (const f of [1, 140, 263, 450, TOTAL_FRAMES]) {
      assert.ok(src.alpha(f) > 0.99, `${src.id} unsichtbar bei f=${f}`);
    }
  }

  // Mobil ist die halbierte, leichtere Fassung derselben Fahrt
  assert.equal(FILM_DESKTOP.count, 500);
  assert.equal(FILM_MOBILE.count, 250);
  assert.ok(FILM_MOBILE.store.windowRadius < FILM_DESKTOP.store.windowRadius);
  assert.ok(FILM_MOBILE.store.ladderWidth <= FILM_DESKTOP.store.ladderWidth);
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
