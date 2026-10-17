import { test } from "node:test";
import assert from "node:assert/strict";

const engine = await import("./engine.ts");
const time = await import("../time.ts");

// Mo–Fr vormittags, Di und Do zusätzlich nachmittags (wie die Praxis)
const HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "07:00", closes: "12:00" })),
  ...[2, 4].map((weekday) => ({ weekday, opens: "14:00", closes: "18:00" })),
];
const span = (kind, date, from, to) => ({ kind, startsAt: time.zonedToUtc(date, from), endsAt: time.zonedToUtc(date, to) });
const day = (kind, from, toExclusive) => ({ kind, startsAt: time.startOfDay(from), endsAt: time.startOfDay(toExclusive), allDay: true });

test("Sprechzeit eines normalen Tages, Dienstag mit Nachmittag", () => {
  assert.deepEqual(engine.openWindows("2026-10-19", HOURS, []), [{ from: "07:00", to: "12:00" }]);
  assert.deepEqual(engine.openWindows("2026-10-20", HOURS, []), [
    { from: "07:00", to: "12:00" },
    { from: "14:00", to: "18:00" },
  ]);
  assert.deepEqual(engine.openWindows("2026-10-24", HOURS, []), [], "Samstag");
});

test("Feiertag und Urlaub schließen den Tag, Blocker nicht", () => {
  assert.deepEqual(engine.openWindows("2026-12-25", HOURS, []), [], "1. Weihnachtstag");
  assert.deepEqual(engine.openWindows("2026-10-19", HOURS, [day("urlaub", "2026-10-19", "2026-10-20")]), []);
  assert.deepEqual(engine.openWindows("2026-10-19", HOURS, [span("blocker", "2026-10-19", "08:00", "10:00")]), [{ from: "07:00", to: "12:00" }]);
});

test("Teilweise geschlossen: die Sprechzeit wird zerteilt", () => {
  assert.deepEqual(engine.openWindows("2026-10-20", HOURS, [span("closed", "2026-10-20", "10:00", "15:00")]), [
    { from: "07:00", to: "10:00" },
    { from: "15:00", to: "18:00" },
  ]);
});

test("Nächste Öffnung: Freitag → Montag, mit Urlaub am Montag → Dienstag, über Weihnachten hinweg", () => {
  assert.deepEqual(engine.openingSummary("2026-10-23", HOURS, []).next, { date: "2026-10-26", from: "07:00" });
  assert.deepEqual(engine.openingSummary("2026-10-23", HOURS, [day("urlaub", "2026-10-26", "2026-10-27")]).next, { date: "2026-10-27", from: "07:00" });
  // Do 24.12., Fr 25./Sa 26. Feiertag/Wochenende … nächster Termin Mo 28.12.
  const s = engine.openingSummary("2026-12-24", HOURS, []);
  assert.deepEqual(s.today, [
    { from: "07:00", to: "12:00" },
    { from: "14:00", to: "18:00" },
  ]);
  assert.deepEqual(s.next, { date: "2026-12-28", from: "07:00" });
});

test("Zeitumstellung: Wandzeiten bleiben Wandzeiten", () => {
  // Mo 30.03.2026 – erster Werktag nach der Umstellung auf Sommerzeit
  assert.deepEqual(engine.openWindows("2026-03-30", HOURS, []), [{ from: "07:00", to: "12:00" }]);
  // Mo 26.10.2026 – erster Werktag nach der Umstellung auf Winterzeit
  assert.deepEqual(engine.openWindows("2026-10-26", HOURS, []), [{ from: "07:00", to: "12:00" }]);
});
