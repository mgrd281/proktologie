/**
 * „Jetzt geöffnet“ – ohne Browser.
 * Ausführen:  node --experimental-strip-types --test lib/booking/opening.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { berlinNow, dayLabel, isoWeekday, openLine, openState } = await import("./opening.ts");

// Di 20.10.2026 (Sommerzeit bis 25.10.: Berlin = UTC+2)
const TUE = { date: "2026-10-20", today: [{ from: "07:00", to: "12:00" }, { from: "14:00", to: "18:00" }], next: { date: "2026-10-21", from: "07:00" } };
const at = (utc) => new Date(utc);

test("Berliner Zeit – auch über die Zeitumstellung", () => {
  assert.deepEqual(berlinNow(at("2026-10-20T05:30:00Z")), { date: "2026-10-20", time: "07:30" });
  assert.deepEqual(berlinNow(at("2026-10-26T06:30:00Z")), { date: "2026-10-26", time: "07:30" }, "Winterzeit");
  assert.deepEqual(berlinNow(at("2026-10-20T22:30:00Z")), { date: "2026-10-21", time: "00:30" }, "nach Mitternacht");
  assert.equal(isoWeekday("2026-10-20"), 2);
  assert.equal(isoWeekday("2026-10-25"), 7);
});

test("Zustände im Tageslauf", () => {
  assert.equal(openLine(openState(TUE, at("2026-10-20T04:30:00Z")), at("2026-10-20T04:30:00Z")), "Heute geöffnet · 07:00 – 12:00 und 14:00 – 18:00 Uhr");
  assert.equal(openLine(openState(TUE, at("2026-10-20T06:00:00Z")), at("2026-10-20T06:00:00Z")), "Jetzt geöffnet · bis 12:00 Uhr");
  assert.equal(openLine(openState(TUE, at("2026-10-20T11:00:00Z")), at("2026-10-20T11:00:00Z")), "Heute geöffnet · 14:00 – 18:00 Uhr", "Mittagspause");
  assert.equal(openLine(openState(TUE, at("2026-10-20T15:59:00Z")), at("2026-10-20T15:59:00Z")), "Jetzt geöffnet · bis 18:00 Uhr");
  assert.equal(openLine(openState(TUE, at("2026-10-20T16:00:00Z")), at("2026-10-20T16:00:00Z")), "Jetzt geschlossen · wieder morgen ab 07:00 Uhr");
});

test("Ganzer Tag zu, nächste Öffnung später in der Woche oder nach dem Urlaub", () => {
  const sat = { date: "2026-10-24", today: [], next: { date: "2026-10-26", from: "07:00" } };
  assert.equal(openLine(openState(sat, at("2026-10-24T08:00:00Z")), at("2026-10-24T08:00:00Z")), "Heute geschlossen · wieder Mo ab 07:00 Uhr");
  const urlaub = { date: "2026-10-26", today: [], next: { date: "2026-11-09", from: "07:00" } };
  assert.equal(openLine(openState(urlaub, at("2026-10-26T08:00:00Z")), at("2026-10-26T08:00:00Z")), "Heute geschlossen · wieder Mo, 09.11. ab 07:00 Uhr");
  assert.equal(dayLabel("2026-10-22", "2026-10-20"), "Do");
});

test("Meldung von gestern: keine Aussage statt einer falschen", () => {
  assert.equal(openState(TUE, at("2026-10-21T06:00:00Z")), null);
});
