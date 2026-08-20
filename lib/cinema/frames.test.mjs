/**
 * Tests der Master-FRAME-Timeline – ohne Browser.
 *
 * Ausführen: node --experimental-strip-types --test lib/cinema/frames.test.mjs
 *
 * Kodiert die Abnahmekriterien des Filmwerks: 500 Frames lückenlos in
 * 8 Szenen + Finale; jede Grenzblende 15–25 % der kürzeren Nachbarszene;
 * nie ein leerer oder weißer Frame; höchstens zwei Szenen gleichzeitig;
 * exakte Umkehrbarkeit; Anker auf voll tragenden Szenen; Header vor der
 * hellen Phase.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  TOTAL_FRAMES,
  LERP,
  SCENES,
  SCENE_COUNT,
  RAIL_SCENES,
  SCENE_EDGES,
  dissolveWidth,
  sceneAlpha,
  sceneLocal,
  frameForProgress,
  progressForFrame,
  activeScene,
  FRAME_LAYERS,
  brightnessF,
  ROOM_BRIGHT,
  HEADER_SOLID_FRAME,
  headerSolidProgress,
  ANCHOR_FRAMES,
  AMBIENT_SPAN,
  TEAM_SCENE,
} = await import("./frames.ts");

const STEP = 0.25;
const frames = [];
for (let f = 1; f <= TOTAL_FRAMES; f += STEP) frames.push(f);

test("500 Frames, 8 Hauptszenen + Termin-Finale, lueckenlos", () => {
  assert.equal(TOTAL_FRAMES, 500);
  assert.equal(SCENE_COUNT, 9);
  assert.equal(RAIL_SCENES.length, 8, "die Leiste traegt 8 Punkte");
  assert.equal(SCENES[SCENE_COUNT - 1].rail, false, "Termin ist Finale, kein Leistenpunkt");
  assert.equal(SCENES[0].first, 1);
  assert.equal(SCENES[SCENE_COUNT - 1].last, 500);
  for (let i = 1; i < SCENE_COUNT; i++) {
    assert.equal(SCENES[i].first, SCENES[i - 1].last + 1, `Luecke vor ${SCENES[i].id}`);
  }
  // Die vom Nutzer entschiedene Dramaturgie in genau dieser Reihenfolge
  assert.deepEqual(
    SCENES.map((s) => s.id),
    ["willkommen", "arzt", "leistungen", "beschwerden", "diagnostik", "behandlung", "team", "praxis", "termin"],
  );
});

test("Jede Grenzblende betraegt 15–25 % der kuerzeren Nachbarszene", () => {
  for (let i = 0; i < SCENE_COUNT - 1; i++) {
    const durA = SCENES[i].last - SCENES[i].first + 1;
    const durB = SCENES[i + 1].last - SCENES[i + 1].first + 1;
    const w = dissolveWidth(i);
    const ratio = w / Math.min(durA, durB);
    assert.ok(ratio >= 0.15 && ratio <= 0.25, `Grenze ${i}: ${(ratio * 100).toFixed(1)} %`);
    // Nachbarn teilen sich exakt dieselbe Blende (Alpha-Summe bleibt 1)
    assert.equal(SCENE_EDGES[i].outStart, SCENE_EDGES[i + 1].inStart);
    assert.equal(SCENE_EDGES[i].outEnd, SCENE_EDGES[i + 1].inEnd);
  }
});

test("Nie ein leerer/weisser Frame: Alpha-Summe in [0.98, 2.02], max. 2 Szenen aktiv", () => {
  for (const f of frames) {
    let sum = 0;
    let active = 0;
    for (let i = 0; i < SCENE_COUNT; i++) {
      const a = sceneAlpha(f, i);
      sum += a;
      if (a > 0.01) active++;
    }
    assert.ok(sum >= 0.98 && sum <= 2.02, `Alpha-Summe ${sum.toFixed(3)} bei f=${f}`);
    assert.ok(active <= 2, `${active} Szenen bei f=${f}`);
  }
  // Erste Szene steht bei Frame 1 voll, das Finale haelt bis 500
  assert.ok(sceneAlpha(1, 0) > 0.999);
  assert.ok(sceneAlpha(500, SCENE_COUNT - 1) > 0.999);
});

test("An jeder Grenze sind BEIDE Nachbarszenen gleichzeitig sichtbar", () => {
  for (let i = 0; i < SCENE_COUNT - 1; i++) {
    const b = SCENES[i].last + 0.5;
    assert.ok(sceneAlpha(b, i) > 0.45 && sceneAlpha(b, i + 1) > 0.45, `Grenze ${SCENES[i].id}`);
  }
});

test("Immer traegt eine Umgebung das Bild (ambient → exam → room)", () => {
  for (const f of frames) {
    const carrier = Math.max(
      FRAME_LAYERS.ambient(f),
      FRAME_LAYERS.exam(f),
      FRAME_LAYERS.room(f),
    );
    assert.ok(carrier > 0.25, `leerer Traeger bei f=${f} (${carrier.toFixed(3)})`);
  }
});

test("Szenen erben einander (Stichproben an den Grenzen)", () => {
  assert.ok(FRAME_LAYERS.doctor(60) > 0.99, "Arzt traegt 01+02");
  assert.ok(FRAME_LAYERS.doctor(116) > 0.05 && FRAME_LAYERS.leistungen(116) > 0.4,
    "Arzt uebergibt an die Tafeln");
  assert.ok(FRAME_LAYERS.leistungen(176) > 0.1 && FRAME_LAYERS.symptome(176) > 0.2,
    "Tafeln laufen in Beschwerden aus");
  assert.ok(FRAME_LAYERS.symptome(232) > 0.1 && FRAME_LAYERS.exam(232) > 0.05,
    "Beschwerden uebergibt an den echten Raum");
  assert.ok(FRAME_LAYERS.exam(300) > 0.99, "der Raum traegt Behandlung");
  assert.ok(FRAME_LAYERS.team(340) > 0.2 && FRAME_LAYERS.exam(340) > 0.9,
    "Team erscheint IM Behandlungsraum");
  assert.ok(FRAME_LAYERS.exam(346) > 0.3 && FRAME_LAYERS.room(346) > 0.3,
    "Raum-Uebergabe exam → Empfang ueberblendet");
  assert.ok(FRAME_LAYERS.praxisCard(428) > 0.2 && FRAME_LAYERS.team(428) > 0.2,
    "Praxis-Karte kommt, waehrend Team noch steht");
  assert.ok(FRAME_LAYERS.terminCard(468) > 0.3 && FRAME_LAYERS.praxisCard(468) > 0.3,
    "Termin-Vorschau kommt, bevor die Praxis-Karte geht");
});

test("Die Buchungs-Vorschau verblasst nie; Release erst nach Termin-Einsatz", () => {
  let prev = 0;
  for (const f of frames) {
    const w = FRAME_LAYERS.terminCard(f);
    assert.ok(w >= prev - 1e-9, `terminCard faellt bei f=${f}`);
    prev = w;
  }
  assert.ok(FRAME_LAYERS.terminCard(500) > 0.999);
  assert.equal(FRAME_LAYERS.release(478), 0);
  assert.ok(FRAME_LAYERS.release(490) > 0.2 && FRAME_LAYERS.release(490) < 0.9);
  assert.ok(FRAME_LAYERS.release(500) > 0.999);
  assert.ok(FRAME_LAYERS.terminCard(478) > 0.999, "Vorschau steht, BEVOR der Release beginnt");
});

test("Bahn und Glow laufen ohne Unterbrechung durch", () => {
  for (const f of frames) {
    if (f >= 10 && f <= 485) assert.ok(FRAME_LAYERS.trajectory(f) > 0.1, `Bahn reisst bei ${f}`);
    if (f >= 5) assert.ok(FRAME_LAYERS.glow(f) > 0.1, `Glow reisst bei ${f}`);
  }
});

test("Alle Baender sind stetig (kein Sprung)", () => {
  const fns = [
    ...Object.values(FRAME_LAYERS),
    brightnessF,
    ...SCENES.map((_, i) => (f) => sceneAlpha(f, i)),
  ];
  for (const fn of fns) {
    let prev = fn(1);
    for (const f of frames) {
      const v = fn(f);
      assert.ok(Math.abs(v - prev) < 0.08, `Sprung bei f=${f}`);
      prev = v;
    }
  }
});

test("frame ↔ progress: Endpunkte und Roundtrip", () => {
  assert.equal(frameForProgress(0), 1);
  assert.equal(frameForProgress(1), 500);
  assert.equal(progressForFrame(1), 0);
  assert.equal(progressForFrame(500), 1);
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    assert.ok(Math.abs(progressForFrame(frameForProgress(p)) - p) < 1 / 499);
  }
  // Ziel-Frame-Formel der Spezifikation
  assert.equal(1 + Math.round(0.5 * (TOTAL_FRAMES - 1)), 251);
  assert.ok(LERP === 0.12);
});

test("Exakte Umkehrbarkeit: Vorwaerts- und Rueckwaerts-Sweep sind elementgleich", () => {
  const evaluate = (f) => {
    const out = [];
    for (let i = 0; i < SCENE_COUNT; i++) out.push(sceneAlpha(f, i), sceneLocal(f, i));
    for (const fn of Object.values(FRAME_LAYERS)) out.push(fn(f));
    return out;
  };
  const forward = frames.map(evaluate);
  const backward = [...frames].reverse().map(evaluate).reverse();
  for (let k = 0; k < frames.length; k++) {
    assert.deepEqual(forward[k], backward[k], `Richtungsabhaengigkeit bei f=${frames[k]}`);
  }
});

test("Header schaltet um, bevor die Buehne hell wird – und flackert nie", () => {
  assert.ok(brightnessF(HEADER_SOLID_FRAME) < ROOM_BRIGHT);
  let firstBright = null;
  for (const f of frames) {
    if (brightnessF(f) > ROOM_BRIGHT) { firstBright = f; break; }
  }
  assert.ok(firstBright !== null && firstBright > HEADER_SOLID_FRAME);
  assert.ok(firstBright - HEADER_SOLID_FRAME < 40, "Header schaltet unnoetig frueh");
  for (const f of frames) {
    if (f >= firstBright) assert.ok(brightnessF(f) > ROOM_BRIGHT, `hell-dunkel-Flackern bei ${f}`);
  }
  const p = headerSolidProgress();
  assert.ok(p > 0 && p < 1 && Math.abs(frameForProgress(p) - HEADER_SOLID_FRAME) < 1);
});

test("Anker: 8 Marken, streng steigend, auf voll tragenden Szenen", () => {
  assert.equal(ANCHOR_FRAMES.length, RAIL_SCENES.length);
  for (let i = 0; i < ANCHOR_FRAMES.length; i++) {
    const a = ANCHOR_FRAMES[i];
    if (i > 0) assert.ok(a > ANCHOR_FRAMES[i - 1], "Anker nicht steigend");
    assert.equal(activeScene(a), i, `Anker ${i} landet in fremder Szene`);
    assert.ok(sceneAlpha(a, i) > 0.99, `Anker ${i} landet in einer Blende (${sceneAlpha(a, i)})`);
    assert.equal(FRAME_LAYERS.release(a), 0);
  }
});

test("Leiste: aktive Szene monoton, alle Szenen erreicht", () => {
  let prev = 0;
  const seen = new Set();
  for (const f of frames) {
    const a = activeScene(f);
    seen.add(a);
    assert.ok(a >= prev && a - prev <= 1);
    prev = a;
  }
  assert.equal(seen.size, SCENE_COUNT);
});

test("Team-Untersequenz: Ebenen kommen vor Szene 07 und gehen vor der Praxis-Karte", () => {
  const team = SCENES[TEAM_SCENE];
  assert.ok(FRAME_LAYERS.team(team.first - 8) > 0.2, "Team erscheint nicht vor seiner Szene");
  assert.ok(FRAME_LAYERS.team(team.last + 5) < 0.5, "Team weicht nicht rechtzeitig");
  // Lokaler Fortschritt monoton ueber die Szene
  let prev = -1;
  for (let f = team.first; f <= team.last; f += 0.5) {
    const l = sceneLocal(f, TEAM_SCENE);
    assert.ok(l >= prev);
    prev = l;
  }
});

test("Lichtsequenz-Spanne liegt innerhalb ihres Bandes", () => {
  const [a, b] = AMBIENT_SPAN;
  assert.ok(a >= 1 && b <= 250 && a < b);
  assert.ok(FRAME_LAYERS.ambient(b) > 0.2, "Spanne endet erst nach dem Band-Ausklang");
});
