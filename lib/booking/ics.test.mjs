/**
 * Kalenderdatei „In den Kalender“ – ohne Browser.
 * Ausführen:  node --experimental-strip-types --test lib/booking/ics.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { berlinStamp, buildIcs, escapeText, foldLine } = await import("./ics.ts");

const entry = {
  uid: "4f1c2d@proktologie-eimsbuettel.de",
  start: new Date("2026-10-19T05:15:00Z"),
  end: new Date("2026-10-19T05:35:00Z"),
  title: "Termin · Proktologie Eimsbüttel",
  location: "Proktologie Eimsbüttel, Schäferkampsallee 56, 20357 Hamburg",
  description: "Ihre Referenz: T-7K2M",
  stamp: new Date("2026-10-17T09:00:00Z"),
};

test("Wandzeit Berlin – Sommer- und Winterzeit aus der Zeitzone", () => {
  assert.equal(berlinStamp(new Date("2026-10-19T05:15:00Z")), "20261019T071500", "Sommerzeit: UTC+2");
  assert.equal(berlinStamp(new Date("2026-10-26T06:15:00Z")), "20261026T071500", "Winterzeit: UTC+1");
  assert.equal(berlinStamp(new Date("2026-03-30T05:00:00Z")), "20260330T070000", "nach der Umstellung im März");
});

test("Termin mit neutralem Titel, Ort und der UID der Mail-Einladung", () => {
  const ics = buildIcs(entry);
  const lines = ics.split("\r\n");
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(lines.includes("METHOD:PUBLISH"));
  assert.ok(lines.includes("UID:4f1c2d@proktologie-eimsbuettel.de"));
  assert.ok(lines.includes("DTSTART;TZID=Europe/Berlin:20261019T071500"));
  assert.ok(lines.includes("DTEND;TZID=Europe/Berlin:20261019T073500"));
  assert.ok(lines.includes("DTSTAMP:20261017T090000Z"));
  assert.ok(lines.includes("SUMMARY:Termin · Proktologie Eimsbüttel"));
  assert.ok(lines.includes("TZID:Europe/Berlin"));
  // Ort mit Komma wird escaped, nichts zur Terminart
  assert.ok(ics.includes("LOCATION:Proktologie Eimsbüttel\\, Schäferkampsallee 56\\, 20357 Hamburg"));
  assert.ok(!/ATTENDEE|ORGANIZER/.test(ics), "Datei zum Selbst-Eintragen ohne Teilnehmer");
});

test("Escaping und Zeilenfaltung nach RFC 5545", () => {
  assert.equal(escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const long = `DESCRIPTION:${"ä".repeat(60)}`;
  const folded = foldLine(long);
  for (const part of folded.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), long, "Entfalten ergibt die Zeile");
});
