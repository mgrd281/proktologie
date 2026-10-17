/**
 * Gesetzliche Feiertage in Hamburg – reine Rechnung, keine Tabelle, die
 * jedes Jahr gepflegt werden müsste, und kein Paket:
 *
 * - feste Tage: Neujahr, 1. Mai, Tag der Deutschen Einheit, Reformationstag
 *   (in Hamburg seit 2018), 1. und 2. Weihnachtstag;
 * - bewegliche Tage um Ostern: Karfreitag, Ostermontag, Christi Himmelfahrt,
 *   Pfingstmontag.
 *
 * An diesen Tagen bietet die Online-Buchung nichts an, die Warteliste
 * verteilt keine Plätze, und der Kalender im Cockpit zeigt „Feiertag“. Von
 * Hand kann das Praxisteam trotzdem einen Termin anlegen (mit Hinweis
 * „außerhalb der Sprechzeiten“).
 */
import { addDays } from "../time.ts";

/** Ostersonntag (gregorianisch, Gauß-Verfahren nach Meeus/Jones/Butcher) als "YYYY-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const byYear = new Map<number, Map<string, string>>();

/** Alle Feiertage eines Jahres: Datum → Name. */
export function hamburgHolidays(year: number): Map<string, string> {
  const cached = byYear.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const days = new Map<string, string>([
    [`${year}-01-01`, "Neujahr"],
    [addDays(easter, -2), "Karfreitag"],
    [addDays(easter, 1), "Ostermontag"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [addDays(easter, 39), "Christi Himmelfahrt"],
    [addDays(easter, 50), "Pfingstmontag"],
    [`${year}-10-03`, "Tag der Deutschen Einheit"],
    ...(year >= 2018 ? ([[`${year}-10-31`, "Reformationstag"]] as Array<[string, string]>) : []),
    [`${year}-12-25`, "1. Weihnachtstag"],
    [`${year}-12-26`, "2. Weihnachtstag"],
  ]);
  byYear.set(year, days);
  return days;
}

/** Name des Feiertags an diesem Tag ("YYYY-MM-DD") – oder null. */
export function holidayName(date: string): string | null {
  return hamburgHolidays(Number(date.slice(0, 4))).get(date) ?? null;
}
