/**
 * „In den Kalender“ nach der Buchung: Der Browser erzeugt die Datei selbst
 * (RFC 5545), es geht nichts weiter an einen Dienst. Gleicher Aufbau wie im
 * Cockpit (cockpit/lib/ics.ts): Wandzeit Europe/Berlin mit eingebetteter
 * VTIMEZONE – Sommer- und Winterzeit kommen aus der Zeitzone, nie per Hand.
 * Die UID ist die der Einladung aus der Bestätigungs-Mail, damit
 * Kalender-Apps beide als EINEN Termin führen. Der Titel nennt bewusst
 * keine Terminart (Datenschutz). Prüfbar mit
 *
 *   node --experimental-strip-types --test lib/booking/ics.test.mjs
 */

export interface CalendarEntry {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  location: string;
  description?: string;
  /** Zeitpunkt der Erzeugung – für reproduzierbare Tests */
  stamp?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

const berlin = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wandzeit Berlin als "YYYYMMDDTHHMMSS" (für DTSTART;TZID=…). */
export function berlinStamp(d: Date): string {
  const p = Object.fromEntries(berlin.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

/** UTC als "YYYYMMDDTHHMMSSZ" (für DTSTAMP). */
export function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Text-Escaping nach RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const utf8 = new TextEncoder();

/** Zeilen auf 75 Oktette falten (Fortsetzung mit Leerzeichen). */
export function foldLine(line: string): string {
  if (utf8.encode(line).length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  let size = 0;
  for (const ch of line) {
    const b = utf8.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // Folgezeilen beginnen mit " "
    if (size + b > limit) {
      out.push(chunk);
      chunk = ch;
      size = b;
    } else {
      chunk += ch;
      size += b;
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

export function buildIcs(e: CalendarEntry): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Proktologie Eimsbüttel//Website//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    "SEQUENCE:0",
    `DTSTAMP:${utcStamp(e.stamp ?? new Date())}`,
    `DTSTART;TZID=Europe/Berlin:${berlinStamp(e.start)}`,
    `DTEND;TZID=Europe/Berlin:${berlinStamp(e.end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    "STATUS:CONFIRMED",
    `LOCATION:${escapeText(e.location)}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  lines.push("TRANSP:OPAQUE", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
