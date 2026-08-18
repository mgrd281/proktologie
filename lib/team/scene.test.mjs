/**
 * Geometrie-Tests der Team-Szene – ohne Browser.
 *
 * Ausführen:  node --experimental-strip-types --test lib/team/scene.test.mjs
 *
 * Geprüft wird das, was die Komposition ausmacht: Fokus liegt auf der
 * richtigen Ebene, die Szene bleibt zusammenhängend, niemand fliegt durch
 * die Kamera, und das Finale bringt alle sechs ins Bild.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  DESKTOP,
  MOBILE,
  MEMBER_COUNT,
  T_MAX,
  cardState,
  cameraAt,
  basePosition,
  project,
  chapterAt,
  progressForStop,
} = await import("./scene.ts");

const VIEW = { w: 1440, h: 900 };
const VH = VIEW.h;
const geos = [
  ["desktop", DESKTOP],
  ["mobil", MOBILE],
];

for (const [label, geo] of geos) {
  test(`${label}: fokussierte Ebene steht vorn, scharf und voll sichtbar`, () => {
    for (let i = 0; i < MEMBER_COUNT; i++) {
      const s = cardState(i, i + 1, geo, VIEW);
      assert.ok(Math.abs(s.z) < 1, `Ebene ${i}: z=${s.z} sollte ~0 sein`);
      assert.ok(Math.abs(s.x) < 1, `Ebene ${i}: x=${s.x} sollte ~0 sein`);
      assert.equal(s.opacity, 1, `Ebene ${i}: volle Deckkraft erwartet`);
      assert.equal(s.blurStep, 0, `Ebene ${i}: darf nicht unscharf sein`);
    }
  });

  test(`${label}: Nachbarn bleiben sichtbar – die Szene reißt nie ab`, () => {
    for (let i = 0; i < MEMBER_COUNT; i++) {
      const states = Array.from({ length: MEMBER_COUNT }, (_, j) =>
        cardState(j, i + 1, geo, VIEW),
      );
      // Mindestens drei Ebenen gleichzeitig wahrnehmbar
      const perceivable = states.filter((s) => s.opacity > 0.1).length;
      assert.ok(perceivable >= 3, `bei Fokus ${i}: nur ${perceivable} Ebenen sichtbar`);
      // Die nächste Person ist bereits zu ahnen, bevor sie aktiv wird
      if (i + 1 < MEMBER_COUNT) {
        assert.ok(
          states[i + 1].opacity > 0.1,
          `bei Fokus ${i}: nächste Ebene unsichtbar (${states[i + 1].opacity})`,
        );
      }
    }
  });

  test(`${label}: keine Ebene fliegt durch die Kamera`, () => {
    for (let step = 0; step <= 700; step++) {
      const t = (step / 700) * T_MAX;
      for (let i = 0; i < MEMBER_COUNT; i++) {
        const s = cardState(i, t, geo, VIEW);
        // Nie in die Nähe der Projektionsebene – dort explodiert die Perspektive
        assert.ok(
          s.z < geo.perspective * 0.3,
          `t=${t.toFixed(2)} Ebene ${i}: z=${s.z.toFixed(0)} zu nah an der Projektionsebene`,
        );
        // Wer passiert wurde, liegt seitlich – niemals mittig vor dem Gesicht
        if (s.z > 120) {
          const p = project(s, geo);
          assert.ok(
            Math.abs(p.x) > geo.cardWidth * 0.6,
            `t=${t.toFixed(2)} Ebene ${i}: passierte Ebene steht mittig (x=${p.x.toFixed(0)})`,
          );
        }
      }
    }
  });

  test(`${label}: Bewegung ist stetig – keine Sprünge zwischen Frames`, () => {
    const STEPS = 1400;
    for (let i = 0; i < MEMBER_COUNT; i++) {
      let prev = cardState(i, 0, geo, VIEW);
      for (let step = 1; step <= STEPS; step++) {
        const s = cardState(i, (step / STEPS) * T_MAX, geo, VIEW);
        const jump = Math.hypot(s.x - prev.x, s.y - prev.y, s.z - prev.z);
        assert.ok(jump < 60, `Ebene ${i}: Sprung von ${jump.toFixed(1)}px bei t-Schritt ${step}`);
        prev = s;
      }
    }
  });

  test(`${label}: Finale zeigt alle sechs gleichzeitig im Bild`, () => {
    const states = Array.from({ length: MEMBER_COUNT }, (_, i) =>
      cardState(i, T_MAX, geo, VIEW),
    );
    for (const [i, s] of states.entries()) {
      assert.ok(s.opacity > 0.45, `Ebene ${i} im Finale zu blass (${s.opacity.toFixed(2)})`);
      const p = project(s, geo);
      assert.ok(p.visible, `Ebene ${i} im Finale nicht projizierbar`);
      // Innerhalb einer großzügigen Bühne (halbe Breite ~ 960px)
      assert.ok(Math.abs(p.x) < 960, `Ebene ${i} im Finale außerhalb (x=${p.x.toFixed(0)})`);
      assert.ok(Math.abs(p.y) < VH, `Ebene ${i} im Finale außerhalb (y=${p.y.toFixed(0)})`);
    }
    // Die Gruppe steht nebeneinander, nicht als Stapel: der Abstand
    // benachbarter Ebenen muss größer sein als ihre halbe Bildbreite.
    for (let a = 0; a < states.length; a++) {
      for (let b = a + 1; b < states.length; b++) {
        const pa = project(states[a], geo);
        const pb = project(states[b], geo);
        const ka = geo.perspective / (geo.perspective - states[a].z);
        const minGap = geo.cardWidth * ka * 0.5;
        assert.ok(
          Math.hypot(pa.x - pb.x, pa.y - pb.y) > minGap,
          `Ebenen ${a}/${b} überdecken sich im Finale (${Math.hypot(pa.x - pb.x, pa.y - pb.y).toFixed(0)} < ${minGap.toFixed(0)})`,
        );
      }
    }
  });

  test(`${label}: Kamera bewegt sich monoton in die Tiefe`, () => {
    let prevZ = Infinity;
    for (let step = 0; step <= 600; step++) {
      const t = (step / 600) * MEMBER_COUNT; // bis zum letzten Mitglied
      const cam = cameraAt(t, geo);
      assert.ok(cam.z <= prevZ + 1e-6, `Kamera springt vorwärts bei t=${t.toFixed(2)}`);
      prevZ = cam.z;
    }
  });
}

test("Intro zeigt alle sechs Ebenen bereits in der Tiefe", () => {
  const states = Array.from({ length: MEMBER_COUNT }, (_, i) =>
    cardState(i, 0, DESKTOP, VIEW),
  );
  for (const [i, s] of states.entries()) {
    assert.ok(s.opacity > 0.1, `Ebene ${i} im Intro unsichtbar`);
    assert.ok(s.z < 0, `Ebene ${i} im Intro nicht in der Tiefe (z=${s.z})`);
  }
});

test("Kapitel-Zuordnung und Sprungmarken passen zusammen", () => {
  assert.equal(chapterAt(0), 0);
  assert.equal(chapterAt(1.4), 1);
  assert.equal(chapterAt(T_MAX), T_MAX);
  assert.equal(progressForStop(0), 0);
  assert.equal(progressForStop(T_MAX), 1);
  for (let stop = 0; stop <= T_MAX; stop++) {
    assert.equal(chapterAt(progressForStop(stop) * T_MAX), stop);
  }
});

test("Pfad ist geschwungen – keine gerade Linie, keine Dopplung", () => {
  const points = Array.from({ length: MEMBER_COUNT }, (_, i) =>
    basePosition(i, DESKTOP),
  );
  const ys = new Set(points.map((p) => p.y));
  assert.equal(ys.size, MEMBER_COUNT, "Höhenversatz wiederholt sich");
  // Abstände zwischen benachbarten Ebenen variieren (kein starres Raster)
  const gaps = points.slice(1).map((p, i) => Math.abs(p.x - points[i].x));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 80, "Abstände zu gleichförmig");
});
