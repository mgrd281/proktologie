/**
 * Tests der Kamerafahrt-Dramaturgie – ohne Browser.
 *
 * Ausführen: node --experimental-strip-types --test lib/cinema/timeline.test.mjs
 *
 * Diese Tests kodieren die Fragen, an denen die Fahrt gemessen wird:
 * Gibt es eine harte Kante? Überblenden die Szenen, statt sich abzulösen?
 * Erbt jede Szene Elemente der vorigen? Laufen Bahn, Glow und Leiste durch?
 * Reitet die Buchungs-Vorschau wirklich auf dem Auslauf?
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  STATES,
  STATE_COUNT,
  LAYERS,
  TEAM_INDEX,
  LEISTUNGEN_INDEX,
  SYMPTOME_INDEX,
  AMBIENT_LAST,
  TEXT_BANDS,
  TEXT_BAND_COUNT,
  ANCHORS,
  ROOM_BRIGHT,
  HEADER_SOLID_AT,
  band,
  smoothstep,
  ov,
  cycleWeight,
  textBandWeight,
  textBandLocal,
  localProgress,
  spanProgress,
  activeState,
  progressForState,
  brightness,
} = await import("./timeline.ts");

/** Feines Abtastraster über die gesamte Fahrt. */
const SAMPLES = 10_000;
const sample = (i) => i / SAMPLES;

test("Die neun Zustände decken 0–1 lückenlos und überschneidungsfrei ab", () => {
  assert.equal(STATE_COUNT, 9);
  assert.equal(STATES[0].from, 0);
  assert.equal(STATES[STATE_COUNT - 1].to, 1);
  for (let i = 1; i < STATE_COUNT; i++) {
    assert.equal(
      STATES[i].from,
      STATES[i - 1].to,
      `Luecke oder Ueberlappung zwischen ${STATES[i - 1].id} und ${STATES[i].id}`,
    );
  }
  // Exakt die vom Nutzer vorgegebene Abbildung
  const expected = [
    ["willkommen", 0.0, 0.1],
    ["beschwerden", 0.1, 0.2],
    ["leistungen", 0.2, 0.31],
    ["symptome", 0.31, 0.41],
    ["diagnostik", 0.41, 0.52],
    ["behandlung", 0.52, 0.63],
    ["team", 0.63, 0.79],
    ["praxis", 0.79, 0.9],
    ["termin", 0.9, 1.0],
  ];
  expected.forEach(([id, from, to], i) => {
    assert.equal(STATES[i].id, id);
    assert.ok(Math.abs(STATES[i].from - from) < 1e-9);
    assert.ok(Math.abs(STATES[i].to - to) < 1e-9);
  });
});

test("Textbaender decken 0–1 ab; Zustand 01 traegt zwei Texte", () => {
  assert.equal(TEXT_BAND_COUNT, 10);
  assert.equal(TEXT_BANDS[0].id, "willkommen");
  assert.equal(TEXT_BANDS[1].id, "arzt");
  assert.equal(TEXT_BANDS[0].railIndex, 0);
  assert.equal(TEXT_BANDS[1].railIndex, 0);
  assert.equal(TEXT_BANDS[0].to, TEXT_BANDS[1].from);
  for (let i = 1; i < TEXT_BAND_COUNT; i++) {
    assert.equal(TEXT_BANDS[i].from, TEXT_BANDS[i - 1].to);
    assert.ok(TEXT_BANDS[i].railIndex >= TEXT_BANDS[i - 1].railIndex, "railIndex monoton");
  }
  assert.equal(TEXT_BANDS[TEXT_BAND_COUNT - 1].to, 1);
});

test("H1 steht bei p=0 voll da (Regression: frueher nur halbes Gewicht)", () => {
  assert.ok(textBandWeight(0, 0) > 0.999, `willkommen(0)=${textBandWeight(0, 0)}`);
  // ... und das letzte Band bleibt bis zum Schluss voll
  assert.ok(
    textBandWeight(1, TEXT_BAND_COUNT - 1) > 0.999,
    `termin(1)=${textBandWeight(1, TEXT_BAND_COUNT - 1)}`,
  );
});

test("Zu jedem Fortschritt traegt mindestens ein Text den Frame", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    let max = 0;
    for (let b = 0; b < TEXT_BAND_COUNT; b++) max = Math.max(max, textBandWeight(p, b));
    assert.ok(max > 0.2, `kein Text bei p=${p.toFixed(4)} (max=${max.toFixed(3)})`);
  }
});

test("An jeder Textgrenze sind BEIDE Nachbarn gleichzeitig sichtbar", () => {
  for (let i = 1; i < TEXT_BAND_COUNT; i++) {
    const boundary = TEXT_BANDS[i].from;
    const left = textBandWeight(boundary, i - 1);
    const right = textBandWeight(boundary, i);
    assert.ok(left > 0.4, `${TEXT_BANDS[i - 1].id} an eigener Grenze zu schwach: ${left}`);
    assert.ok(right > 0.4, `${TEXT_BANDS[i].id} an eigener Grenze zu schwach: ${right}`);
  }
});

test("Zu jedem Fortschritt traegt eine Umgebung das Bild (kein leerer Frame)", () => {
  // Traeger sind Lichtsequenz, Untersuchungsraum und Empfangs-Ambiente.
  // (Frueher zaehlten nur ambient/room – mit dem echten Untersuchungsraum
  // als eigener Ebene ist die Kette jetzt dreigliedrig.)
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    const carrier = Math.max(LAYERS.ambient(p), LAYERS.exam(p), LAYERS.room(p));
    assert.ok(carrier > 0.25, `leerer Frame bei p=${p.toFixed(4)} (carrier=${carrier.toFixed(3)})`);
  }
});

test("Szenen erben Elemente der vorigen (Stichproben an jeder Grenze)", () => {
  // 01→02: der Arzt bleibt praesent, waehrend die Praxis-Worte kommen
  assert.ok(LAYERS.doctor(0.12) > 0.9, `doctor(0.12)=${LAYERS.doctor(0.12)}`);
  // 02→03: die Panels sind schon vor ihrem Zustand da
  assert.ok(LAYERS.leistungen(0.2) > 0.5, `leistungen(0.20)=${LAYERS.leistungen(0.2)}`);
  // 03→04: die Panels laufen in Symptome hinein aus
  assert.ok(LAYERS.leistungen(0.33) > 0.1, `leistungen(0.33)=${LAYERS.leistungen(0.33)}`);
  assert.ok(LAYERS.symptome(0.33) > 0.4, `symptome(0.33)=${LAYERS.symptome(0.33)}`);
  // 04→05: der echte Untersuchungsraum setzt VOR Diagnostik ein
  assert.ok(LAYERS.exam(0.43) === 0 && LAYERS.exam(0.47) > 0.1, "exam kommt zu frueh/spaet");
  assert.ok(LAYERS.symptome(0.43) > 0.1, `symptome(0.43)=${LAYERS.symptome(0.43)}`);
  // 05→06: Behandlung spielt im SELBEN Raum (exam voll)
  assert.ok(LAYERS.exam(0.55) > 0.99 && LAYERS.exam(0.63) > 0.99, "exam traegt Behandlung nicht");
  // 06→07: Team erscheint, waehrend Behandlung noch steht
  assert.ok(LAYERS.team(0.59) > 0.2, `team(0.59)=${LAYERS.team(0.59)}`);
  const behandlungIdx = TEXT_BANDS.findIndex((b) => b.id === "behandlung");
  assert.ok(textBandWeight(0.59, behandlungIdx) > 0.9, "Behandlung-Text schon weg");
  // 07: Untersuchungsraum uebergibt ans Empfangs-Ambiente ohne Loch
  assert.ok(LAYERS.exam(0.7) > 0.5 && LAYERS.room(0.7) > 0.5, "Raum-Uebergabe reisst");
  // 07→08: Praxis beginnt, waehrend Team voll da ist
  assert.ok(LAYERS.praxis(0.75) > 0.15, `praxis(0.75)=${LAYERS.praxis(0.75)}`);
  assert.ok(LAYERS.team(0.75) > 0.99, `team(0.75)=${LAYERS.team(0.75)}`);
  // 08→09: Termin-Vorschau beginnt, bevor Praxis geht
  assert.ok(LAYERS.termin(0.9) > 0.15, `termin(0.90)=${LAYERS.termin(0.9)}`);
  assert.ok(LAYERS.praxis(0.9) > 0.15, `praxis(0.90)=${LAYERS.praxis(0.9)}`);
});

test("Die Buchungs-Vorschau verblasst nie – sie reitet auf dem Auslauf", () => {
  let prev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const w = LAYERS.termin(sample(i));
    assert.ok(w >= prev - 1e-9, `termin faellt bei p=${sample(i).toFixed(4)}`);
    prev = w;
  }
  assert.ok(LAYERS.termin(1) > 0.999);
});

test("Uebergabe Licht → Untersuchungsraum ist mittig in Diagnostik", () => {
  const p = 0.49;
  assert.ok(LAYERS.ambient(p) > 0.4, `ambient(0.49)=${LAYERS.ambient(p)}`);
  assert.ok(LAYERS.exam(p) > 0.4, `exam(0.49)=${LAYERS.exam(p)}`);
  // und die Lichtsequenz ist bei Behandlung wirklich vorbei
  assert.ok(LAYERS.ambient(0.58) < 0.001, "ambient reicht in Behandlung hinein");
  assert.equal(AMBIENT_LAST, STATES.findIndex((s) => s.id === "diagnostik"));
});

test("Schwere Ebenen schliessen sich gegenseitig aus (max. 2 gleichzeitig)", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    const heavy = [LAYERS.leistungen(p), LAYERS.symptome(p), LAYERS.team(p)].filter(
      (w) => w > 0.05,
    ).length;
    assert.ok(heavy <= 2, `${heavy} schwere Ebenen bei p=${p.toFixed(4)}`);
  }
});

test("Fensterproben: Panels und Zyklus stehen in ihren Zustaenden", () => {
  assert.ok(LAYERS.leistungen(0.255) > 0.999, "Panels nicht voll in 03");
  assert.equal(LAYERS.leistungen(0.14), 0, "Panels zu frueh");
  assert.equal(LAYERS.leistungen(0.41), 0, "Panels zu spaet");
  assert.ok(LAYERS.symptome(0.36) > 0.999, "Zyklus nicht voll in 04");
  assert.equal(LAYERS.symptome(0.2), 0, "Zyklus zu frueh");
  assert.equal(LAYERS.symptome(0.5), 0, "Zyklus zu spaet");
});

test("Bahn und Glow laufen ohne Unterbrechung durch", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    if (p >= 0.01 && p <= 0.97) {
      assert.ok(LAYERS.trajectory(p) > 0.1, `Bahn reisst bei p=${p.toFixed(4)}`);
    }
    if (p >= 0.01) assert.ok(LAYERS.glow(p) > 0.1, `Glow reisst bei p=${p.toFixed(4)}`);
  }
});

test("Auslauf erst ganz am Ende; Leiste geht mit", () => {
  assert.equal(LAYERS.release(0.955), 0);
  assert.ok(LAYERS.release(0.98) > 0.2 && LAYERS.release(0.98) < 0.9);
  assert.ok(LAYERS.release(1) > 0.999);
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sample(i);
    const chrome = 1 - LAYERS.release(p);
    if (p < 0.955) assert.equal(chrome, 1, `Leiste verblasst zu frueh bei p=${p.toFixed(4)}`);
  }
});

test("Alle Baender sind stetig (kein Sprung ueber 10 000 Abtastungen)", () => {
  const fns = [
    ...Object.values(LAYERS),
    brightness,
    ...TEXT_BANDS.map((_, i) => (p) => textBandWeight(p, i)),
  ];
  const step = 1 / SAMPLES;
  for (const fn of fns) {
    let prev = fn(0);
    for (let i = 1; i <= SAMPLES; i++) {
      const v = fn(sample(i));
      assert.ok(Math.abs(v - prev) < 40 * step, `Sprung bei p=${sample(i).toFixed(4)}`);
      prev = v;
    }
  }
});

test("Header schaltet um, bevor die Buehne hell wird", () => {
  assert.ok(
    brightness(HEADER_SOLID_AT) < ROOM_BRIGHT,
    "Header wuerde erst nach dem Hellwerden umschalten",
  );
  let firstBright = null;
  for (let i = 0; i <= SAMPLES; i++) {
    if (brightness(sample(i)) > ROOM_BRIGHT) {
      firstBright = sample(i);
      break;
    }
  }
  assert.ok(firstBright !== null, "Die helle Phase tritt nie ein");
  assert.ok(firstBright > HEADER_SOLID_AT, "Helle Phase beginnt vor dem Header-Umschalten");
  assert.ok(firstBright - HEADER_SOLID_AT < 0.08, "Header schaltet unnoetig frueh um");
  // Und die helle Phase reisst bis zum Ende nicht mehr ab (kein Flackern):
  for (let i = Math.ceil(0.56 * SAMPLES); i <= SAMPLES; i++) {
    assert.ok(brightness(sample(i)) > ROOM_BRIGHT, `hell-dunkel-Flackern bei ${sample(i)}`);
  }
});

test("Leiste: aktiver Zustand und Sprungmarken passen zusammen", () => {
  assert.equal(ANCHORS.length, STATE_COUNT);
  assert.equal(activeState(0), 0);
  assert.equal(activeState(0.7), TEAM_INDEX);
  assert.equal(activeState(1), STATE_COUNT - 1);
  for (let s = 0; s < STATE_COUNT; s++) {
    const a = progressForState(s);
    assert.equal(activeState(a), s, `Sprungmarke ${STATES[s].id} verfehlt`);
    // An jeder Sprungmarke traegt der dominante Text voll
    let best = 0;
    for (let b = 0; b < TEXT_BAND_COUNT; b++) best = Math.max(best, textBandWeight(a, b));
    assert.ok(best > 0.9, `Sprungmarke ${STATES[s].id} landet in einer Blende (${best})`);
    // ... und der staerkste Text gehoert zum angesprungenen Leistenpunkt
    let strongest = 0;
    for (let b = 0; b < TEXT_BAND_COUNT; b++) {
      if (textBandWeight(a, b) > textBandWeight(a, strongest)) strongest = b;
    }
    assert.equal(TEXT_BANDS[strongest].railIndex, s);
    assert.equal(LAYERS.release(a), 0, "Sprungmarke landet im Auslauf");
  }
  // Der aktive Zustand wechselt monoton mit dem Fortschritt
  let prev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = activeState(sample(i));
    assert.ok(a >= prev, `Leiste springt zurueck bei p=${sample(i).toFixed(4)}`);
    assert.ok(a - prev <= 1, "Leiste ueberspringt einen Zustand");
    prev = a;
  }
});

test("cycleWeight: Fenster decken den Zyklus, Raender bleiben stehen", () => {
  const N = 4;
  const o = 0.06;
  assert.ok(cycleWeight(0, 0, N, o) > 0.999, "erstes Fenster nicht sofort da");
  assert.ok(cycleWeight(1, N - 1, N, o) > 0.999, "letztes Fenster haelt nicht");
  for (let i = 0; i <= 1000; i++) {
    const local = i / 1000;
    let max = 0;
    for (let k = 0; k < N; k++) max = Math.max(max, cycleWeight(local, k, N, o));
    assert.ok(max > 0.4, `Zyklusloch bei local=${local}`);
  }
  // Jedes Fenster erreicht volles Gewicht
  for (let k = 0; k < N; k++) {
    const mid = (k + 0.5) / N;
    assert.ok(cycleWeight(mid, k, N, o) > 0.999, `Fenster ${k} nie voll`);
  }
});

test("ov(): Untergrenze und Deckel halten die Blenden weich und lesbar", () => {
  assert.equal(ov(0.05), 0.02);
  assert.ok(Math.abs(ov(0.1) - 0.03) < 1e-9);
  assert.equal(ov(0.16), 0.035);
});

test("localProgress/spanProgress/textBandLocal sind monoton", () => {
  for (const [fn, args] of [
    [(p) => localProgress(p, TEAM_INDEX)],
    [(p) => localProgress(p, LEISTUNGEN_INDEX)],
    [(p) => localProgress(p, SYMPTOME_INDEX)],
    [(p) => spanProgress(p, 0, AMBIENT_LAST)],
    [(p) => textBandLocal(p, 1)],
  ]) {
    let prev = -1;
    for (let i = 0; i <= 1000; i++) {
      const v = fn(i / 1000);
      assert.ok(v >= prev, "nicht monoton");
      assert.ok(v >= 0 && v <= 1);
      prev = v;
    }
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
