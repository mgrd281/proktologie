import { test } from "node:test";
import assert from "node:assert/strict";

const ics = await import("./ics.ts");

const base = {
  uid: "appt-123@cockpit",
  sequence: 0,
  method: "REQUEST",
  start: new Date("2026-07-14T05:00:00Z"), // 07:00 Berlin (Sommer)
  end: new Date("2026-07-14T05:20:00Z"),
  summary: "Kontrolltermin · Proktologie Eimsbüttel",
  location: "Schäferkampsallee 56, 20357 Hamburg",
  stamp: new Date("2026-07-01T10:00:00Z"),
};

test("Wandzeit mit TZID – Sommer und Winter", () => {
  assert.equal(ics.localStamp(new Date("2026-07-14T05:00:00Z")), "20260714T070000");
  assert.equal(ics.localStamp(new Date("2026-01-14T06:00:00Z")), "20260114T070000");
  assert.equal(ics.utcStamp(new Date("2026-07-01T10:00:00Z")), "20260701T100000Z");
});

test("Kalenderdatei: Struktur, Zeitzone, Escaping", () => {
  const out = ics.buildIcs({ ...base, description: "Bitte 10 Minuten früher kommen; Karte mitbringen, danke.\nBis dann" });
  assert.ok(out.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(out.endsWith("END:VCALENDAR\r\n"));
  assert.match(out, /METHOD:REQUEST/);
  assert.match(out, /BEGIN:VTIMEZONE[\s\S]*TZID:Europe\/Berlin[\s\S]*END:VTIMEZONE/);
  assert.match(out, /DTSTART;TZID=Europe\/Berlin:20260714T070000/);
  assert.match(out, /DTEND;TZID=Europe\/Berlin:20260714T072000/);
  assert.match(out, /DTSTAMP:20260701T100000Z/);
  assert.match(out, /STATUS:CONFIRMED/);
  // Jede Zeile ≤ 75 Oktette
  for (const line of out.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `Zeile zu lang: ${line}`);
  // Escaping: ; , und Zeilenumbruch – nach dem Entfalten prüfen (RFC 5545 §3.1)
  const unfolded = out.replace(/\r\n /g, "");
  assert.match(unfolded, /DESCRIPTION:Bitte 10 Minuten früher kommen\\; Karte mitbringen\\, danke\.\\nBis dann/);
});

test("Absage: METHOD:CANCEL, STATUS:CANCELLED, SEQUENCE erhöht", () => {
  const out = ics.buildIcs({ ...base, method: "CANCEL", sequence: 2 });
  assert.match(out, /METHOD:CANCEL/);
  assert.match(out, /STATUS:CANCELLED/);
  assert.match(out, /SEQUENCE:2/);
});

test("Zeilenfaltung bricht nicht in einem Mehrbyte-Zeichen", () => {
  const long = "Ä".repeat(100); // 200 Bytes
  const folded = ics.foldLine(`SUMMARY:${long}`);
  const parts = folded.split("\r\n");
  assert.ok(parts.length >= 3);
  for (const p of parts) assert.ok(Buffer.byteLength(p, "utf8") <= 75);
  // Entfaltet ergibt wieder den Ursprung
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), `SUMMARY:${long}`);
});
