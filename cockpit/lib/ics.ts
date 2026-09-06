/**
 * iCalendar-Erzeugung ohne Abhängigkeit (RFC 5545). Termine tragen die
 * Zeitzone Europe/Berlin mit eingebetteter VTIMEZONE-Definition, damit
 * Kalender-Apps die Wandzeit korrekt anzeigen – auch über die
 * Sommerzeit-Umstellung hinweg. METHOD:REQUEST für Einladungen,
 * METHOD:CANCEL für Absagen; SEQUENCE steigt bei jeder Änderung.
 */
import { wall } from "./time.ts";

export interface IcsEvent {
  uid: string;
  sequence: number;
  method: "REQUEST" | "CANCEL";
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
  /** Zeitpunkt der Erzeugung – für reproduzierbare Tests injizierbar */
  stamp?: Date;
  url?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Wandzeit Berlin als "YYYYMMDDTHHMMSS" (für DTSTART;TZID=…). */
export function localStamp(d: Date): string {
  const w = wall(d);
  return `${w.y}${pad(w.m)}${pad(w.d)}T${pad(w.h)}${pad(w.min)}${pad(w.s)}`;
}

/** UTC als "YYYYMMDDTHHMMSSZ" (für DTSTAMP). */
export function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Text-Escaping nach RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen auf 75 Oktette falten (Fortsetzung mit Leerzeichen). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  let chunkBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74; // Folgezeilen beginnen mit " "
    if (chunkBytes + b > limit) {
      out.push(chunk);
      chunk = ch;
      chunkBytes = b;
    } else {
      chunk += ch;
      chunkBytes += b;
    }
  }
  if (chunk) out.push(chunk);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "X-LIC-LOCATION:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(e: IcsEvent): string {
  const stamp = e.stamp ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Proktologie Eimsbüttel//Praxis-Cockpit//DE",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;TZID=Europe/Berlin:${localStamp(e.start)}`,
    `DTEND;TZID=Europe/Berlin:${localStamp(e.end)}`,
    `SUMMARY:${escapeText(e.summary)}`,
    `STATUS:${e.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.organizerEmail) lines.push(`ORGANIZER;CN=${escapeText(e.organizerName ?? e.organizerEmail)}:mailto:${e.organizerEmail}`);
  if (e.attendeeEmail) lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${e.method === "CANCEL" ? "NEEDS-ACTION" : "ACCEPTED"}:mailto:${e.attendeeEmail}`);
  lines.push("TRANSP:OPAQUE", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
