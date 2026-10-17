"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/content/site";
import { berlinNow, isoWeekday } from "@/lib/booking/opening";

const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const noop = () => () => {};

/** Heutiger Wochentag in Berlin – erst im Browser bekannt (statische Seite); auf dem Server keiner. */
function useTodayWeekday(): number | null {
  return useSyncExternalStore(
    noop,
    () => isoWeekday(berlinNow(new Date()).date),
    () => null,
  );
}

/** Sprechzeiten-Liste; die Zeile von heute trägt die Marke „Heute“. */
export function HoursList() {
  const weekday = useTodayWeekday();
  const todayName = weekday ? DAY_NAMES[weekday - 1] : null;
  return (
    <dl className="mt-3 space-y-2 text-sm text-ink/70 max-md:space-y-3">
      {site.hours.map((entry) => {
        const today = Boolean(todayName && entry.days.includes(todayName));
        return (
          <div key={entry.days} aria-current={today ? "date" : undefined} className="flex justify-between gap-4 max-md:flex-col max-md:gap-0.5">
            <dt>
              {entry.days}
              {today && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap text-primary-deep">Heute</span>}
            </dt>
            <dd className="text-right font-medium text-ink/80 max-md:text-left">{entry.time}</dd>
          </div>
        );
      })}
    </dl>
  );
}
