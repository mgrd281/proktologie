/**
 * „Jetzt geöffnet · bis 12:00 Uhr“ – aus der Sprechzeit, die das Cockpit
 * für heute meldet (Urlaub und Feiertage schon eingerechnet), und der Uhr
 * des Browsers in Berliner Zeit. Reine Logik ohne DOM, prüfbar mit
 *
 *   node --experimental-strip-types --test lib/booking/opening.test.mjs
 *
 * Gilt die Meldung nicht für heute (Seite über Mitternacht offen, alter
 * Zwischenspeicher), gibt es keine Aussage statt einer falschen.
 */
import type { HoursInfo } from "./status.ts";

const parts = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Datum ("YYYY-MM-DD") und Uhrzeit ("HH:MM") in Berlin. */
export function berlinNow(now: Date): { date: string; time: string } {
  const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** ISO-Wochentag 1 (Montag) … 7 (Sonntag) eines Datums "YYYY-MM-DD". */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export type OpenState =
  | { kind: "open"; until: string }
  | { kind: "later"; windows: Array<{ from: string; to: string }> }
  | { kind: "closed"; wholeDay: boolean; next: { date: string; from: string } | null };

export function openState(info: HoursInfo, now: Date): OpenState | null {
  const { date, time } = berlinNow(now);
  if (info.date !== date) return null;
  const current = info.today.find((w) => w.from <= time && time < w.to);
  if (current) return { kind: "open", until: current.to };
  const later = info.today.filter((w) => w.from > time);
  if (later.length) return { kind: "later", windows: later };
  return { kind: "closed", wholeDay: info.today.length === 0, next: info.next };
}

const WEEKDAY = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** „morgen“, „Di“ (innerhalb einer Woche) oder „Mo, 26.10.“ (später, etwa nach dem Urlaub). */
export function dayLabel(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (days === 1) return "morgen";
  const wd = WEEKDAY[isoWeekday(date) - 1];
  if (days < 7) return wd ?? date;
  return `${wd}, ${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

/** Die Zeile zum Zustand, z. B. „Jetzt geöffnet · bis 12:00 Uhr“. */
export function openLine(state: OpenState, now: Date): string {
  if (state.kind === "open") return `Jetzt geöffnet · bis ${state.until} Uhr`;
  if (state.kind === "later") return `Heute geöffnet · ${state.windows.map((w) => `${w.from} – ${w.to}`).join(" und ")} Uhr`;
  const lead = state.wholeDay ? "Heute geschlossen" : "Jetzt geschlossen";
  if (!state.next) return lead;
  return `${lead} · wieder ${dayLabel(state.next.date, berlinNow(now).date)} ab ${state.next.from} Uhr`;
}
