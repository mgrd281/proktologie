import { test } from "node:test";
import assert from "node:assert/strict";

const holidays = await import("./holidays.ts");
const engine = await import("./engine.ts");
const time = await import("../time.ts");

const HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "07:00", closes: "12:00" })),
  ...[2, 4].map((weekday) => ({ weekday, opens: "14:00", closes: "18:00" })),
];
const TYPE = { id: "kontrolle", durationMin: 20, bufferMin: 0, leadTimeHours: 0, maxAheadDays: 56 };
const query = (date, now) => ({ date, hours: HOURS, exceptions: [], busy: [], stepMin: 15, now: new Date(now), type: TYPE });

test("Ostersonntag nach Gauß stimmt für bekannte Jahre (auch frühestes/spätestes Datum)", () => {
  const known = {
    2008: "2008-03-23",
    2019: "2019-04-21",
    2024: "2024-03-31",
    2025: "2025-04-20",
    2026: "2026-04-05",
    2027: "2027-03-28",
    2038: "2038-04-25",
  };
  for (const [year, date] of Object.entries(known)) assert.equal(holidays.easterSunday(Number(year)), date, `Ostern ${year}`);
});

test("Hamburg 2026: genau die zehn gesetzlichen Feiertage", () => {
  const days = [...holidays.hamburgHolidays(2026).keys()].sort();
  assert.deepEqual(days, [
    "2026-01-01",
    "2026-04-03",
    "2026-04-06",
    "2026-05-01",
    "2026-05-14",
    "2026-05-25",
    "2026-10-03",
    "2026-10-31",
    "2026-12-25",
    "2026-12-26",
  ]);
  assert.equal(holidays.holidayName("2026-12-25"), "1. Weihnachtstag");
  assert.equal(holidays.holidayName("2026-12-24"), null, "Heiligabend ist kein gesetzlicher Feiertag");
});

test("Reformationstag gilt in Hamburg erst seit 2018", () => {
  assert.equal(holidays.holidayName("2017-10-31"), null);
  assert.equal(holidays.holidayName("2018-10-31"), "Reformationstag");
});

test("Am Feiertag keine Online-Zeiten, am nächsten Werktag schon", () => {
  // Freitag, 25.12.2026 – der Buchungshorizont reicht ab Anfang November hin
  assert.equal(engine.generateSlots(query("2026-12-25", "2026-12-01T08:00:00Z")).length, 0);
  // Montag, 28.12.2026 – normale Sprechzeit
  assert.equal(engine.generateSlots(query("2026-12-28", "2026-12-01T08:00:00Z")).length, 19);
  // Karfreitag und Ostermontag 2027 (26.03. / 29.03.)
  assert.equal(engine.generateSlots(query("2027-03-26", "2027-03-01T08:00:00Z")).length, 0);
  assert.equal(engine.generateSlots(query("2027-03-29", "2027-03-01T08:00:00Z")).length, 0);
});

test("Feiertag zählt als außerhalb der Sprechzeiten (Warnung bei Anlage von Hand)", () => {
  const start = time.zonedToUtc("2026-12-25", "09:00");
  const end = time.zonedToUtc("2026-12-25", "09:20");
  assert.equal(engine.withinOpeningHours(start, end, HOURS), false);
  const monday = time.zonedToUtc("2026-12-28", "09:00");
  assert.equal(engine.withinOpeningHours(monday, new Date(monday.getTime() + 20 * 60_000), HOURS), true);
  assert.equal(engine.dayIsClosed("2026-12-25", []), true);
  assert.equal(engine.dayIsClosed("2026-12-28", []), false);
});
