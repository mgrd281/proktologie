"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { addDays, addMonths, isoWeekday, parseDateKey, WEEKDAYS_SHORT_DE } from "@/lib/time";

export interface FreeDay {
  date: string;
  times: string[];
}

export type FreeTimesState = { status: "loading" } | { status: "error" } | { status: "ok"; days: FreeDay[] };

/** Je Tag zunächst so viele Zeiten, der Rest hinter „+N“. */
const PER_ROW = 4;
/** So viele Tage stehen sofort da, der Rest hinter „Weitere Tage“. */
const ROWS = 5;

function dayLabel(date: string, today: string): string {
  if (date === today) return "Heute";
  if (date === addDays(today, 1)) return "Morgen";
  const { d, m } = parseDateKey(date);
  return `${WEEKDAYS_SHORT_DE[isoWeekday(date) - 1]} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}

/**
 * „Nächste freie Zeiten“ fürs Team: die nächsten Praxistage mit freien
 * Zeiten ab einem Datum. Ein Klick übernimmt Tag und Uhrzeit. Für das Team
 * gelten Vorlauf und Horizont der Website nicht – heute, morgen und die
 * Kontrolle in drei Monaten stehen hier ebenso.
 */
export function FreeTimes({
  state,
  today,
  from,
  onFrom,
  selected,
  onPick,
  onRetry,
  typeLabel,
  starts,
}: {
  state: FreeTimesState;
  today: string;
  /** Erster Tag der Leiste */
  from: string;
  onFrom: (date: string) => void;
  selected: { date: string; time: string };
  onPick: (date: string, time: string) => void;
  onRetry: () => void;
  typeLabel?: string;
  /** Schnellwahl „ab …“ – Standard: heute, in 1 Woche, in 3 Monaten */
  starts?: Array<[label: string, date: string]>;
}) {
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [allRows, setAllRows] = useState(false);
  const quick = starts ?? [
    ["ab heute", today],
    ["in 1 Woche", addDays(today, 7)],
    ["in 3 Monaten", addMonths(today, 3)],
  ];

  return (
    <section aria-labelledby="free-times-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="free-times-title" className="text-[13px] font-medium text-text">
          Nächste freie Zeiten{typeLabel ? <span className="font-normal text-text-muted"> · {typeLabel}</span> : null}
        </h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Freie Zeiten suchen ab">
          {quick.map(([label, date]) => (
            <button
              key={label}
              type="button"
              aria-pressed={from === date}
              onClick={() => onFrom(date)}
              className={cn(
                "min-h-8 rounded-full px-2.5 text-[12px] font-medium transition-colors max-md:min-h-11",
                from === date ? "bg-brand-soft text-text" : "text-text-muted hover:bg-surface-sunken hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.status === "loading" && <p className="text-[12px] text-text-muted">Freie Zeiten werden geladen …</p>}
      {state.status === "error" && (
        <p role="alert" className="text-[12px] text-danger">
          Die freien Zeiten konnten gerade nicht geladen werden.{" "}
          <button type="button" onClick={onRetry} className="min-h-8 font-medium underline underline-offset-2">
            Erneut versuchen
          </button>
        </p>
      )}
      {state.status === "ok" && state.days.length === 0 && (
        <p className="text-[12px] text-text-muted">In den nächsten 90 Tagen ist für diese Terminart nichts frei – Sprechzeiten, Urlaub oder Blocker prüfen.</p>
      )}
      {state.status === "ok" && state.days.length > 0 && (
        <div className="space-y-1.5">
          {(allRows ? state.days : state.days.slice(0, ROWS)).map((day) => {
            const open = openDays.includes(day.date);
            const shown = open ? day.times : day.times.slice(0, PER_ROW);
            return (
              <div key={day.date} className="flex items-start gap-3 max-md:flex-col max-md:gap-1">
                <span className={cn("tnum w-[72px] shrink-0 pt-1.5 text-[12px] font-medium max-md:w-auto max-md:pt-0", day.date === today ? "text-brand" : "text-text-muted")}>
                  {dayLabel(day.date, today)}
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={dayLabel(day.date, today)}>
                  {shown.map((time) => {
                    const active = selected.date === day.date && selected.time === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onPick(day.date, time)}
                        className={cn(
                          "tnum min-h-8 rounded-lg border px-2.5 text-[12px] font-medium transition-colors max-md:min-h-11",
                          active ? "border-brand-fill bg-brand-fill text-deep" : "border-line text-text-muted hover:border-line-strong hover:text-text",
                        )}
                      >
                        {time}
                      </button>
                    );
                  })}
                  {!open && day.times.length > PER_ROW && (
                    <button
                      type="button"
                      onClick={() => setOpenDays((d) => [...d, day.date])}
                      aria-label={`${day.times.length - PER_ROW} weitere Zeiten ${dayLabel(day.date, today)}`}
                      className="tnum min-h-8 rounded-lg px-2 text-[12px] font-medium text-brand hover:bg-surface-sunken max-md:min-h-11"
                    >
                      +{day.times.length - PER_ROW}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!allRows && state.days.length > ROWS && (
            <button type="button" onClick={() => setAllRows(true)} className="min-h-8 text-[12px] font-medium text-brand underline-offset-2 hover:underline max-md:min-h-11">
              Weitere Tage
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Die ersten `n` freien Zeiten ab Tag und Uhrzeit – für den Hinweis nach einer Überschneidung. */
export function nextAfter(days: FreeDay[], date: string, time: string, n = 3): Array<{ date: string; time: string }> {
  const out: Array<{ date: string; time: string }> = [];
  for (const day of days) {
    for (const t of day.times) {
      if (day.date > date || (day.date === date && t > time)) out.push({ date: day.date, time: t });
      if (out.length === n) return out;
    }
  }
  return out;
}
