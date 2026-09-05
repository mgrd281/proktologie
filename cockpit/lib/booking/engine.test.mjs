import { test } from "node:test";
import assert from "node:assert/strict";

const time = await import("../time.ts");
const engine = await import("./engine.ts");

const HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: "07:00", closes: "12:00" })),
  ...[2, 4].map((weekday) => ({ weekday, opens: "14:00", closes: "18:00" })),
];
const TYPE = { id: "kontrolle", durationMin: 20, bufferMin: 0, leadTimeHours: 0, maxAheadDays: 56 };
const base = (over = {}) => ({
  hours: HOURS,
  exceptions: [],
  busy: [],
  stepMin: 15,
  now: new Date("2026-03-02T05:00:00Z"), // Mo 06:00 Berlin (Winter)
  type: TYPE,
  ...over,
});

test("Wandzeit → UTC: Winter (+1) und Sommer (+2)", () => {
  assert.equal(time.zonedToUtc("2026-03-23", "07:00").toISOString(), "2026-03-23T06:00:00.000Z");
  assert.equal(time.zonedToUtc("2026-03-30", "07:00").toISOString(), "2026-03-30T05:00:00.000Z");
  assert.equal(time.offsetMinutes(new Date("2026-01-15T12:00:00Z")), 60);
  assert.equal(time.offsetMinutes(new Date("2026-07-15T12:00:00Z")), 120);
});

test("DST-Umstellung im März: Lücke 02:00–03:00 wird auf die nächste gültige Zeit gelegt", () => {
  // 29.03.2026 ist der Umstellsonntag
  assert.equal(time.zonedToUtc("2026-03-29", "01:30").toISOString(), "2026-03-29T00:30:00.000Z");
  assert.equal(time.zonedToUtc("2026-03-29", "03:30").toISOString(), "2026-03-29T01:30:00.000Z");
  const gap = time.zonedToUtc("2026-03-29", "02:30");
  assert.equal(time.timeKey(gap), "03:30");
});

test("DST-Umstellung im Oktober: 01:30 (Sommer) und 03:30 (Winter) sind eindeutig", () => {
  assert.equal(time.zonedToUtc("2026-10-25", "01:30").toISOString(), "2026-10-24T23:30:00.000Z");
  assert.equal(time.zonedToUtc("2026-10-25", "03:30").toISOString(), "2026-10-25T02:30:00.000Z");
});

test("Datums-Helfer: Wochentag, Wochenstart, addDays über Monatsgrenzen", () => {
  assert.equal(time.isoWeekday("2026-03-02"), 1);
  assert.equal(time.isoWeekday("2026-03-08"), 7);
  assert.equal(time.startOfWeek("2026-03-05"), "2026-03-02");
  assert.equal(time.addDays("2026-02-27", 3), "2026-03-02");
  assert.equal(time.dateKey(new Date("2026-03-02T23:30:00Z")), "2026-03-03"); // 00:30 Berlin
});

test("Dienstag: Vormittag + Nachmittag im 15-Minuten-Raster, letzter Slot passt vor Ende", () => {
  const slots = engine.generateSlots(base({ date: "2026-03-03" }));
  const times = slots.map((s) => s.time);
  assert.equal(times[0], "07:00");
  assert.ok(times.includes("11:30"));
  assert.ok(!times.includes("11:45"), "11:45 + 20 min läge nach 12:00");
  assert.ok(times.includes("14:00"));
  assert.equal(times.at(-1), "17:30");
  assert.equal(slots[0].startsAt.toISOString(), "2026-03-03T06:00:00.000Z");
  // Vormittag 07:00–11:30 = 19 Slots, Nachmittag 14:00–17:30 = 15 Slots
  assert.equal(times.length, 34);
});

test("Montag: nur Vormittag; Samstag: keine Sprechzeit", () => {
  assert.equal(engine.generateSlots(base({ date: "2026-03-02" })).length, 19);
  assert.equal(engine.generateSlots(base({ date: "2026-03-07" })).length, 0);
});

test("Sommerzeit: Raster bleibt an der Wandzeit, UTC verschiebt sich", () => {
  const slots = engine.generateSlots(base({ date: "2026-03-31", now: new Date("2026-03-30T05:00:00Z") }));
  assert.equal(slots[0].time, "07:00");
  assert.equal(slots[0].startsAt.toISOString(), "2026-03-31T05:00:00.000Z");
  assert.equal(slots.length, 34);
});

test("Belegte Zeiten blockieren inklusive Puffer, Dauer + Puffer müssen ins Fenster passen", () => {
  const busy = [
    {
      startsAt: time.zonedToUtc("2026-03-02", "08:00"),
      endsAt: time.zonedToUtc("2026-03-02", "08:20"),
      bufferMin: 10,
    },
  ];
  const slots = engine.generateSlots(base({ date: "2026-03-02", busy })).map((s) => s.time);
  assert.ok(!slots.includes("08:00"));
  assert.ok(!slots.includes("08:15"), "08:15 überlappt Termin");
  assert.ok(!slots.includes("07:45"), "07:45 + 20 min ragt in 08:00");
  assert.ok(slots.includes("08:30"), "08:30 liegt nach Termin + 10 min Puffer");
  assert.ok(slots.includes("07:30"));

  const withBuffer = engine
    .generateSlots(base({ date: "2026-03-02", type: { ...TYPE, bufferMin: 10 } }))
    .map((s) => s.time);
  assert.equal(withBuffer.at(-1), "11:30", "11:30 + 20 + 10 = 12:00 passt exakt");
});

test("Vorlauf und Horizont je Terminart", () => {
  const now = new Date("2026-03-02T09:30:00Z"); // 10:30 Berlin
  const lead = engine
    .generateSlots(base({ date: "2026-03-02", now, type: { ...TYPE, leadTimeHours: 1 } }))
    .map((s) => s.time);
  assert.equal(lead[0], "11:30");
  const tooFar = engine.generateSlots(base({ date: "2026-05-15", now, type: { ...TYPE, maxAheadDays: 7 } }));
  assert.equal(tooFar.length, 0);
  const past = engine.generateSlots(base({ date: "2026-02-27", now }));
  assert.equal(past.length, 0);
});

test("Ausnahmen: Urlaub sperrt den Tag, Blocker belegt ein Intervall", () => {
  const urlaub = [
    { kind: "urlaub", startsAt: time.zonedToUtc("2026-03-02", "00:00"), endsAt: time.zonedToUtc("2026-03-07", "00:00") },
  ];
  assert.equal(engine.generateSlots(base({ date: "2026-03-03", exceptions: urlaub })).length, 0);
  assert.ok(engine.generateSlots(base({ date: "2026-03-09", exceptions: urlaub })).length > 0);

  const blocker = [
    { kind: "blocker", startsAt: time.zonedToUtc("2026-03-02", "09:00"), endsAt: time.zonedToUtc("2026-03-02", "10:00") },
  ];
  const times = engine.generateSlots(base({ date: "2026-03-02", exceptions: blocker })).map((s) => s.time);
  assert.ok(!times.includes("09:00") && !times.includes("09:45"));
  assert.ok(times.includes("10:00") && times.includes("08:30"));
});

test("Konfliktprüfung für interne Anlage", () => {
  const busy = [{ startsAt: time.zonedToUtc("2026-03-02", "08:00"), endsAt: time.zonedToUtc("2026-03-02", "08:30") }];
  const clash = engine.findConflicts(
    { startsAt: time.zonedToUtc("2026-03-02", "08:15"), endsAt: time.zonedToUtc("2026-03-02", "08:45") },
    busy,
  );
  assert.equal(clash.length, 1);
  const free = engine.findConflicts(
    { startsAt: time.zonedToUtc("2026-03-02", "08:30"), endsAt: time.zonedToUtc("2026-03-02", "09:00") },
    busy,
  );
  assert.equal(free.length, 0);
  assert.ok(
    engine.withinOpeningHours(time.zonedToUtc("2026-03-02", "08:30"), time.zonedToUtc("2026-03-02", "09:00"), HOURS),
  );
  assert.ok(
    !engine.withinOpeningHours(time.zonedToUtc("2026-03-02", "13:00"), time.zonedToUtc("2026-03-02", "13:30"), HOURS),
  );
});
