/**
 * Tests des Leistungs-Korridors – ohne Browser.
 *
 * Ausführen: node --experimental-strip-types --test lib/cinema/leistungen.test.mjs
 *
 * Geprüft wird, was die Komposition trägt: Jede Tafel erreicht den Fokus,
 * der Korridor bleibt rechts der Textspalte, die Rezession ist monoton,
 * nichts springt, und mobil zieht eine ruhige Liste statt eines
 * geschrumpften Desktops.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  PANEL_COUNT,
  STATION_COUNT,
  T_START,
  T_END,
  DESKTOP,
  MOBILE,
  panelState,
  stationOf,
  activeStation,
  corridorTime,
} = await import("./leistungen.ts");

const SAMPLES = 2000;
/** Abtastung entlang der ECHTEN Kamerafahrt (t = corridorTime(local)). */
const tAt = (i) => corridorTime(i / SAMPLES);

test("8 Tafeln in 4 Stationen zu je 2", () => {
  assert.equal(PANEL_COUNT, 8);
  assert.equal(STATION_COUNT, 4);
  const seen = new Map();
  for (let i = 0; i < PANEL_COUNT; i++) {
    const { station, slot } = stationOf(i);
    assert.ok(station >= 0 && station < STATION_COUNT);
    assert.ok(slot === 0 || slot === 1);
    seen.set(station, (seen.get(station) ?? 0) + 1);
  }
  for (let s = 0; s < STATION_COUNT; s++) assert.equal(seen.get(s), 2, `Station ${s}`);
});

test("Die Kamerafahrt beginnt vor Station 0 und endet AUF Station 3", () => {
  assert.ok(T_START < 0.5, "Station 0 waere beim Einblenden schon passiert");
  assert.equal(T_END, STATION_COUNT - 0.5, "Fahrt muss auf der letzten Station enden");
  assert.equal(corridorTime(0), T_START);
  assert.equal(corridorTime(1), T_END);
  // Am Ende der Fahrt ist die letzte Station voll da – die Tafeln verlassen
  // die Buehne ueber die Ebenen-Blende, nicht durch Vorbeifahren.
  const last = panelState(PANEL_COUNT - 1, T_END, DESKTOP);
  assert.ok(last.opacity > 0.9 && last.focus > 0.999, "letzte Station am Ende nicht im Fokus");
});

test("Jede Tafel erreicht den Fokus – lesbar und deckend", () => {
  for (const geo of [DESKTOP, MOBILE]) {
    for (let i = 0; i < PANEL_COUNT; i++) {
      const { station } = stationOf(i);
      const st = panelState(i, station + 0.5, geo);
      assert.ok(st.focus > 0.999, `Tafel ${i} nie im Fokus`);
      assert.ok(st.opacity > 0.9, `Tafel ${i} im Fokus zu blass (${st.opacity})`);
      assert.equal(st.blurStep, 0, `Tafel ${i} im Fokus verschleiert`);
      assert.ok(st.scale > 0.85 && st.scale < 1.15, `Tafel ${i} Fokus-Groesse ${st.scale}`);
    }
  }
});

test("Desktop: sichtbare Tafeln bleiben rechts der Textspalte", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const t = tAt(i);
    for (let p = 0; p < PANEL_COUNT; p++) {
      const st = panelState(p, t, DESKTOP);
      if (st.opacity > 0.3) {
        assert.ok(st.x >= 0.5, `Tafel ${p} bei t=${t.toFixed(2)} links: x=${st.x.toFixed(3)}`);
      }
    }
  }
});

test("Ueber den ganzen Lauf sind stets mehrere Tafeln im Bild (Tiefe)", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const t = tAt(i);
    const visible = [];
    for (let p = 0; p < PANEL_COUNT; p++) {
      if (panelState(p, t, DESKTOP).opacity > 0.15) visible.push(p);
    }
    assert.ok(visible.length >= 2, `nur ${visible.length} Tafeln bei t=${t.toFixed(2)}`);
  }
});

test("Rezession ist monoton: naeher = groesser und deckender", () => {
  // Zwei Stationen vor der Kamera: die nähere muss größer und kräftiger sein
  for (let i = 0; i <= 100; i++) {
    const t = 0.5 + (i / 100) * 1.0; // Kamera zwischen Station 0 und 1
    const near = panelState(2, t, DESKTOP); // Station 1
    const far = panelState(4, t, DESKTOP); // Station 2
    assert.ok(near.scale >= far.scale - 1e-9, `Skalen kippen bei t=${t.toFixed(2)}`);
    assert.ok(near.blurStep <= far.blurStep, `Schleier kippt bei t=${t.toFixed(2)}`);
  }
});

test("Nichts springt: Position, Groesse und Deckkraft sind stetig", () => {
  for (const geo of [DESKTOP, MOBILE]) {
    for (let p = 0; p < PANEL_COUNT; p++) {
      let prev = panelState(p, tAt(0), geo);
      for (let i = 1; i <= SAMPLES; i++) {
        const st = panelState(p, tAt(i), geo);
        for (const key of ["x", "y", "scale", "opacity", "focus"]) {
          assert.ok(
            Math.abs(st[key] - prev[key]) < 0.03,
            `${key} springt: Tafel ${p} bei t=${tAt(i).toFixed(3)}`,
          );
          assert.ok(Number.isFinite(st[key]), `${key} ist ${st[key]}`);
        }
        prev = st;
      }
    }
  }
});

test("Passierte Tafeln blenden aus, statt die Kamera zu ueberfahren", () => {
  for (let p = 0; p < PANEL_COUNT; p++) {
    const { station } = stationOf(p);
    const st = panelState(p, station + 0.5 + DESKTOP.visibleBehind + 0.35, DESKTOP);
    assert.ok(st.opacity < 0.05, `Tafel ${p} bleibt hinter der Kamera stehen (${st.opacity})`);
  }
});

test("Mobil: hoechstens 3 Tafeln sichtbar, keine Perspektive noetig", () => {
  for (let i = 0; i <= SAMPLES; i++) {
    const t = tAt(i);
    let visible = 0;
    for (let p = 0; p < PANEL_COUNT; p++) {
      const st = panelState(p, t, MOBILE);
      if (st.opacity > 0.15) visible++;
      assert.equal(st.blurStep, 0, "mobil kein Tiefenschleier");
      assert.ok(Math.abs(st.x - MOBILE.vanishX) < 1e-9, "mobil keine Seitwaertsfahrt");
    }
    assert.ok(visible <= 3, `${visible} Tafeln mobil bei t=${t.toFixed(2)}`);
    assert.ok(visible >= 1, `mobil leer bei t=${t.toFixed(2)}`);
  }
});

test("activeStation zaehlt monoton 0 → 3", () => {
  let prev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = activeStation(tAt(i));
    assert.ok(a >= prev && a - prev <= 1);
    prev = a;
  }
  assert.equal(activeStation(corridorTime(0)), 0);
  assert.equal(activeStation(corridorTime(1)), STATION_COUNT - 1);
});
