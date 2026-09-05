/**
 * Terminmotor – reine Funktionen ohne Datenbank. Die Datenzugriffe
 * (lib/booking/repo.ts) liefern Sprechzeiten, Ausnahmen und belegte
 * Intervalle; hier entsteht daraus die Verfügbarkeit.
 *
 * Regeln:
 * - Slots starten im Raster `stepMin` innerhalb der Sprechzeit des Tages.
 * - Ein Slot passt, wenn Dauer + Puffer vor dem Ende der Sprechzeit liegen.
 * - Belegte Intervalle blockieren inklusive ihres eigenen Puffers.
 * - Vorlauf (leadTimeHours) und Horizont (maxAheadDays) gelten je Terminart.
 * - Ausnahmen: closed/urlaub sperren, blocker/extern belegen.
 * Alles in Europe/Berlin; Rückgabe als UTC-Zeitpunkte plus Anzeige "HH:MM".
 */
import { addDays, dateKey, isoWeekday, minutesOfDay, zonedToUtc } from "../time.ts";

export interface OpeningWindow {
  /** ISO-Wochentag 1–7 */
  weekday: number;
  opens: string;
  closes: string;
  validFrom?: Date | null;
  validTo?: Date | null;
}

export interface ExceptionSpan {
  kind: "closed" | "blocker" | "urlaub" | "extern";
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
}

export interface BusySpan {
  startsAt: Date;
  endsAt: Date;
  bufferMin?: number;
}

export interface TypeSpec {
  id: string;
  durationMin: number;
  bufferMin: number;
  leadTimeHours: number;
  maxAheadDays: number;
}

export interface Slot {
  time: string;
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  date: string;
  type: TypeSpec;
  hours: OpeningWindow[];
  exceptions: ExceptionSpan[];
  busy: BusySpan[];
  stepMin: number;
  now: Date;
}

const MS = 60_000;

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Sprechzeitfenster eines Tages – Wandzeit-Strings plus UTC-Zeitpunkte. */
export function windowsForDay(
  date: string,
  hours: OpeningWindow[],
): Array<{ opens: string; closes: string; start: Date; end: Date }> {
  const wd = isoWeekday(date);
  const dayStart = zonedToUtc(date, "00:00").getTime();
  return hours
    .filter((h) => h.weekday === wd)
    .filter((h) => !h.validFrom || h.validFrom.getTime() <= dayStart)
    .filter((h) => !h.validTo || h.validTo.getTime() >= dayStart)
    .map((h) => ({ opens: h.opens, closes: h.closes, start: zonedToUtc(date, h.opens), end: zonedToUtc(date, h.closes) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function dayIsClosed(date: string, exceptions: ExceptionSpan[]): boolean {
  const start = zonedToUtc(date, "00:00").getTime();
  const end = zonedToUtc(addDays(date, 1), "00:00").getTime();
  return exceptions.some(
    (e) =>
      (e.kind === "closed" || e.kind === "urlaub") &&
      overlaps(start, end, e.startsAt.getTime(), e.endsAt.getTime()),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function generateSlots(q: SlotQuery): Slot[] {
  const { date, type, stepMin } = q;
  if (dayIsClosed(date, q.exceptions)) return [];

  const today = dateKey(q.now);
  const horizon = addDays(today, type.maxAheadDays);
  if (date < today || date > horizon) return [];

  const earliest = q.now.getTime() + type.leadTimeHours * 60 * MS;
  const need = (type.durationMin + type.bufferMin) * MS;

  const busy: Array<[number, number]> = [
    ...q.busy.map((b): [number, number] => [b.startsAt.getTime(), b.endsAt.getTime() + (b.bufferMin ?? 0) * MS]),
    ...q.exceptions
      .filter((e) => e.kind === "blocker" || e.kind === "extern")
      .map((e): [number, number] => [e.startsAt.getTime(), e.endsAt.getTime()]),
  ];

  const slots: Slot[] = [];
  for (const w of windowsForDay(date, q.hours)) {
    // Raster in Wandzeit-Minuten; jeder Slot wird einzeln über zonedToUtc
    // in UTC übersetzt – so bleibt das Raster auch an DST-Tagen korrekt.
    const openMin = minutesOfDay(w.opens);
    const closeMin = minutesOfDay(w.closes);
    for (let m = openMin; m + type.durationMin + type.bufferMin <= closeMin; m += stepMin) {
      const t = toTime(m);
      const start = zonedToUtc(date, t);
      const s = start.getTime();
      if (s < earliest) continue;
      const blockEnd = s + need;
      if (busy.some(([bs, be]) => overlaps(s, blockEnd, bs, be))) continue;
      slots.push({ time: t, startsAt: start, endsAt: new Date(s + type.durationMin * MS) });
    }
  }
  return slots;
}

export interface Conflict {
  with: BusySpan;
}

/** Konfliktprüfung für eine interne Anlage/Verschiebung. */
export function findConflicts(candidate: BusySpan, busy: BusySpan[]): Conflict[] {
  const s = candidate.startsAt.getTime();
  const e = candidate.endsAt.getTime() + (candidate.bufferMin ?? 0) * MS;
  return busy
    .filter((b) => overlaps(s, e, b.startsAt.getTime(), b.endsAt.getTime() + (b.bufferMin ?? 0) * MS))
    .map((b) => ({ with: b }));
}

/** Liegt der Zeitpunkt innerhalb der Sprechzeiten? (Interne Anlage warnt nur, sperrt nicht.) */
export function withinOpeningHours(start: Date, end: Date, hours: OpeningWindow[]): boolean {
  const date = dateKey(start);
  return windowsForDay(date, hours).some((w) => w.start <= start && end <= w.end);
}
