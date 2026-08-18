/**
 * Tests der Kamerafahrt-Dramaturgie – ohne Browser.
 *
 * Ausführen: node --experimental-strip-types --test lib/cinema/timeline.test.mjs
 *
 * Diese Tests kodieren genau die Fragen, an denen die Fahrt gemessen wird:
 * Gibt es eine harte Kante? Überblenden die Szenen, statt sich abzulösen?
 * Taucht Team schon während „Behandlung“ auf? Beginnt Praxis, während Team
 * noch läuft? Laufen Bahn, Glow und Leiste wirklich durch?
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  STATES,
  STATE_COUNT,
  LAYERS,
  TEAM_INDEX,
  band,
  smoothstep,
  stateWeight,
  localProgress,
  spanProgress,
  activeState,
  progressForState,
  ROOM_BRIGHT,
  HEADER_SOLID_AT,
} = await import("./timeline.ts");

/** Feines Abtastraster über die gesamte Fahrt. */
const SAMPLES = 10_000;
const sample = (i) => i / SAMPLES;

test("Die sieben Zustände decken 0–1 lückenlos und überschneidungsfrei ab", () => {
  assert.equal(STATE_COUNT, 7);
  assert.equal(STATES[0].from, 0);
  assert.equal(STATES[STATE_COUNT - 1].to, 1);
  for (let i = 1; i < STATE_COUNT; i++) {
    assert.equal(
      STATES[i].from,
      STATES[i - 1].to,
      `Lücke oder Überlappung zwischen ${STATES[i - 1].id} und ${STATES[i].id}`,
    );
    assert.ok(STATES[i].to > STATES[i].from, `${STATES[i].id} hat keine Dauer`);
  }
  assert.deepEqual(
    STATES.map((s) => s.id),
    ["willkommen", "arzt", "beschwerden", "diagnostik", "behandlung", "team", "praxis"],
  );
});

test("Keine harte Kante: an JEDER Stelle trägt mindestens eine Ebene das Bild", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    const carrying = LAYERS.ambient(p) + LAYERS.team(p) + LAYERS.praxis(p);
    assert.ok(
      carrying > 0.25,
      `bei p=${p.toFixed(4)} trägt niemand das Bild (Summe ${carrying.toFixed(3)})`,
    );
  }
});

test("Keine harte Kante: an JEDER Stelle steht mindestens ein Textzustand", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    let sum = 0;
    for (let s = 0; s < STATE_COUNT; s++) sum += stateWeight(p, s);
    assert.ok(sum > 0.2, `bei p=${p.toFixed(4)} ist kein Zustand sichtbar (${sum.toFixed(3)})`);
  }
});

test("Übergänge sind Überblendungen: an jeder Grenze sind beide Nachbarn da", () => {
  for (let i = 1; i < STATE_COUNT; i++) {
    const boundary = STATES[i].from;
    const before = stateWeight(boundary, i - 1);
    const after = stateWeight(boundary, i);
    assert.ok(
      before > 0.1 && after > 0.1,
      `Grenze ${STATES[i - 1].id}→${STATES[i].id}: ${before.toFixed(2)} / ${after.toFixed(2)}`,
    );
  }
});

test("Team taucht auf, während „Behandlung“ noch läuft", () => {
  const teamStart = STATES[TEAM_INDEX].from; // 0.64
  const behandlung = TEAM_INDEX - 1;
  // Deutlich vor dem eigenen Zustand bereits sichtbar …
  assert.ok(LAYERS.team(teamStart - 0.04) > 0.1, "Team beginnt zu spät");
  // … und zwar während „Behandlung“ noch Gewicht hat
  assert.ok(
    stateWeight(teamStart - 0.04, behandlung) > 0.2,
    "Behandlung ist schon weg, wenn Team kommt",
  );
});

test("Praxis beginnt, während Team noch läuft – und Team weicht danach zurück", () => {
  const teamEnd = STATES[TEAM_INDEX].to; // 0.86
  assert.ok(LAYERS.praxis(teamEnd - 0.04) > 0.1, "Praxis beginnt zu spät");
  assert.ok(LAYERS.team(teamEnd - 0.04) > 0.5, "Team ist zu früh verschwunden");
  // Team verschwindet nicht schlagartig am Zustandsende
  assert.ok(LAYERS.team(teamEnd + 0.03) > 0.15, "Team wird hart abgeschnitten");
  assert.ok(LAYERS.team(1) < 0.05, "Team bleibt am Ende stehen");
});

test("Die Lichtsequenz übergibt an den Raum, statt zu schneiden", () => {
  // Während die Umgebung verblasst, ist der Team-Raum schon im Kommen
  const handover = 0.7;
  assert.ok(LAYERS.ambient(handover) > 0.05, "Ambient ist zu früh weg");
  assert.ok(LAYERS.team(handover) > 0.6, "Team ist beim Übergang noch nicht da");
  assert.ok(LAYERS.ambient(1) < 0.02, "Ambient bleibt am Ende stehen");
});

test("Bahn, Glow und Auslauf laufen durch bzw. greifen erst am Schluss", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    assert.ok(LAYERS.trajectory(p) > 0.05, `Bahn reißt bei p=${p.toFixed(4)} ab`);
    assert.ok(LAYERS.glow(p) > 0.05, `Glow reißt bei p=${p.toFixed(4)} ab`);
  }
  assert.equal(LAYERS.release(0.9), 0, "Auslauf beginnt zu früh");
  assert.ok(LAYERS.release(0.97) > 0.3 && LAYERS.release(0.97) < 0.9, "Auslauf springt");
  assert.equal(LAYERS.release(1), 1, "Auslauf ist am Ende nicht vollständig");
});

test("Alle Bänder sind stetig – keine Sprünge zwischen zwei Frames", () => {
  const step = 1 / SAMPLES;
  for (const [name, fn] of Object.entries(LAYERS)) {
    let prev = fn(0);
    for (let i = 1; i <= SAMPLES; i++) {
      const value = fn(sample(i));
      assert.ok(
        Math.abs(value - prev) < 40 * step,
        `${name} springt bei p=${sample(i).toFixed(4)} um ${(value - prev).toFixed(4)}`,
      );
      prev = value;
    }
  }
  for (let s = 0; s < STATE_COUNT; s++) {
    let prev = stateWeight(0, s);
    for (let i = 1; i <= SAMPLES; i++) {
      const value = stateWeight(sample(i), s);
      assert.ok(Math.abs(value - prev) < 40 * step, `Zustand ${STATES[s].id} springt`);
      prev = value;
    }
  }
});

test("Lokale Fortschritte laufen sauber von 0 nach 1", () => {
  for (let s = 0; s < STATE_COUNT; s++) {
    assert.equal(localProgress(STATES[s].from, s), 0);
    assert.equal(localProgress(STATES[s].to, s), 1);
    assert.equal(localProgress(0, s), s === 0 ? 0 : 0);
    assert.equal(localProgress(1, s), 1);
    // monoton
    let prev = -1;
    for (let i = 0; i <= 500; i++) {
      const v = localProgress(sample(i * 20), s);
      assert.ok(v >= prev - 1e-9, `localProgress(${STATES[s].id}) fällt`);
      prev = v;
    }
  }
  // Team führt seinen eigenen Unter-Fortschritt (01/06) über seinen Zustand
  assert.equal(localProgress(STATES[TEAM_INDEX].from, TEAM_INDEX), 0);
  assert.equal(localProgress(STATES[TEAM_INDEX].to, TEAM_INDEX), 1);
});

test("Spannen-Fortschritt für die Lichtsequenz über 01–05", () => {
  assert.equal(spanProgress(0, 0, 4), 0);
  assert.equal(spanProgress(STATES[4].to, 0, 4), 1);
  assert.ok(Math.abs(spanProgress(0.32, 0, 4) - 0.5) < 0.01);
});

test("Leiste: aktiver Zustand und Sprungmarken passen zusammen", () => {
  assert.equal(activeState(0), 0);
  assert.equal(activeState(0.13), 1);
  assert.equal(activeState(0.7), TEAM_INDEX);
  assert.equal(activeState(1), STATE_COUNT - 1);
  for (let s = 0; s < STATE_COUNT; s++) {
    assert.equal(activeState(progressForState(s)), s, `Sprungmarke ${STATES[s].id} verfehlt`);
  }
  // Der aktive Zustand wechselt monoton mit dem Fortschritt
  let prev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = activeState(sample(i));
    assert.ok(a >= prev, `Leiste springt zurück bei p=${sample(i).toFixed(4)}`);
    assert.ok(a - prev <= 1, "Leiste überspringt einen Zustand");
    prev = a;
  }
});

test("band() und smoothstep() verhalten sich wie erwartet", () => {
  assert.equal(band(0.5, 0, 0.1, 0.9, 1), 1);
  assert.equal(band(-1, 0, 0.1, 0.9, 1), 0);
  assert.equal(band(2, 0, 0.1, 0.9, 1), 0);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.equal(smoothstep(0, 1, -5), 0);
  assert.equal(smoothstep(0, 1, 5), 1);
  assert.equal(smoothstep(0.3, 0.3, 0.4), 1, "Nullbreite darf nicht NaN liefern");
});

test("Header schaltet um, bevor die Buehne hell wird", () => {
  // Vor der Schwelle ist der Raum noch dunkel genug fuer helle Schrift ...
  assert.ok(
    LAYERS.room(HEADER_SOLID_AT) < ROOM_BRIGHT,
    "Header wuerde erst nach dem Hellwerden umschalten",
  );
  // ... und danach kommt die helle Phase auch wirklich.
  const bright = [];
  for (let i = 0; i <= SAMPLES; i++) {
    if (LAYERS.room(sample(i)) > ROOM_BRIGHT) bright.push(sample(i));
  }
  assert.ok(bright.length > 0, "Die helle Phase tritt nie ein");
  assert.ok(bright[0] > HEADER_SOLID_AT, "Helle Phase beginnt vor dem Header-Umschalten");
  assert.ok(bright[0] - HEADER_SOLID_AT < 0.08, "Header schaltet unnoetig frueh um");
});

test("Auslauf nimmt die Leiste mit, aber erst ganz am Ende", () => {
  // 1 - release ist die Deckkraft von Leiste, Zaehler und Hinweis.
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    const chrome = 1 - LAYERS.release(p);
    if (p < 0.94) {
      assert.equal(chrome, 1, `Leiste verblasst zu frueh bei p=${p.toFixed(4)}`);
    }
    assert.ok(chrome >= 0 && chrome <= 1, "Deckkraft ausserhalb 0-1");
  }
  assert.ok(1 - LAYERS.release(1) < 0.001, "Leiste steht am Ende noch ueber der Seite");
});
