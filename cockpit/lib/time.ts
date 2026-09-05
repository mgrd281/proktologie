/**
 * Zeit in der Praxis ist immer Europe/Berlin – gespeichert wird UTC.
 * Keine Abhängigkeit: Intl liefert die Wandzeit, daraus ergibt sich der
 * Versatz; Sommer-/Winterzeit ist damit korrekt (Tests in engine.test.mjs).
 */
export const TZ = "Europe/Berlin";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
  /** ISO-Wochentag 1 = Montag … 7 = Sonntag */
  weekday: number;
}

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function wall(date: Date): Wall {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(date)) p[type] = value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    s: Number(p.second),
    weekday: WD[p.weekday!] ?? 0,
  };
}

/** Versatz Berlin→UTC in Minuten für einen Zeitpunkt (60 im Winter, 120 im Sommer). */
export function offsetMinutes(date: Date): number {
  const w = wall(date);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "YYYY-MM-DD" der Berliner Wandzeit. */
export function dateKey(date: Date): string {
  const w = wall(date);
  return `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

/** "HH:MM" der Berliner Wandzeit. */
export function timeKey(date: Date): string {
  const w = wall(date);
  return `${String(w.h).padStart(2, "0")}:${String(w.min).padStart(2, "0")}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Ungültiges Datum: ${key}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function parseTimeKey(key: string): { h: number; min: number } {
  const m = key.match(/^(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Ungültige Uhrzeit: ${key}`);
  return { h: Number(m[1]), min: Number(m[2]) };
}

/**
 * Berliner Wandzeit → UTC-Zeitpunkt. Kandidaten über den Versatz bilden und
 * per Rückrechnung prüfen; eine nicht existierende Zeit (02:30 am
 * Umstellsonntag im März) landet auf der NÄCHSTEN gültigen Wandzeit (03:30),
 * eine doppelte (Oktober) auf ihrem zweiten, dem Winter-Vorkommen.
 */
export function zonedToUtc(date: string, time: string): Date {
  const { y, m, d } = parseDateKey(date);
  const { h, min } = parseTimeKey(time);
  const naive = Date.UTC(y, m - 1, d, h, min, 0);
  const a = new Date(naive - offsetMinutes(new Date(naive)) * 60_000);
  if (timeKey(a) === time && dateKey(a) === date) return a;
  const b = new Date(naive - offsetMinutes(a) * 60_000);
  if (timeKey(b) === time && dateKey(b) === date) return b;
  // Lücke: vorwärts auf die nächste gültige Zeit
  return a.getTime() > b.getTime() ? a : b;
}

/** Mitternacht (Berlin) des Tages als UTC-Zeitpunkt. */
export function startOfDay(dateKeyStr: string): Date {
  return zonedToUtc(dateKeyStr, "00:00");
}

export function addDays(dateKeyStr: string, days: number): string {
  const { y, m, d } = parseDateKey(dateKeyStr);
  const t = Date.UTC(y, m - 1, d + days);
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

export function isoWeekday(dateKeyStr: string): number {
  const { y, m, d } = parseDateKey(dateKeyStr);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = So
  return wd === 0 ? 7 : wd;
}

/** Montag der Woche, in der `dateKeyStr` liegt. */
export function startOfWeek(dateKeyStr: string): string {
  return addDays(dateKeyStr, 1 - isoWeekday(dateKeyStr));
}

export function minutesOfDay(time: string): number {
  const { h, min } = parseTimeKey(time);
  return h * 60 + min;
}

export function fmtTime(date: Date): string {
  return timeKey(date);
}

const longDate = new Intl.DateTimeFormat("de-DE", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("de-DE", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export function fmtLongDate(date: Date): string {
  return longDate.format(date);
}
export function fmtShortDate(date: Date): string {
  return shortDate.format(date);
}

export const WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAYS_SHORT_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
