"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { bookingCopy } from "@/content/booking";
import type { BookingProvider } from "@/lib/booking/provider";
import type { BookingDay, ISODate } from "@/lib/booking/types";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Schritt 2: Wunschtag – leichter, eigener Monatskalender (keine Dependency).
 *
 * Barrierefreiheit nach APG-Muster: role=grid, Roving-Tabindex,
 * Pfeiltasten (±1 Tag / ±1 Woche), Home/End (Wochenanfang/-ende),
 * PageUp/PageDown (Monat), aria-selected, sprechende Datums-Labels.
 * Touch-Ziele ≥ 44 px. Wird ausschließlich clientseitig nach einer
 * Nutzerinteraktion gerendert (kein Hydration-Konflikt mit „heute").
 */

interface StepCalendarProps {
  provider: BookingProvider;
  selected: ISODate | null;
  onSelect: (date: ISODate) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
const toISO = (d: Date): ISODate =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayLabelFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Führende Leerzellen + Monatstage zu 7er-Wochen gruppieren. */
function chunkIntoWeeks(
  leadingBlanks: number,
  days: BookingDay[],
): (BookingDay | null)[][] {
  const cells: (BookingDay | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  const weeks: (BookingDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

interface CalendarCellProps {
  day: BookingDay;
  isSelected: boolean;
  isToday: boolean;
  isTabStop: boolean;
  onFocusDate: (date: ISODate) => void;
  onKeyDown: (event: React.KeyboardEvent, date: ISODate) => void;
  onSelect: (date: ISODate) => void;
}

function CalendarCell({
  day,
  isSelected,
  isToday,
  isTabStop,
  onFocusDate,
  onKeyDown,
  onSelect,
}: CalendarCellProps) {
  const date = fromISO(day.date);
  return (
    <button
      type="button"
      role="gridcell"
      data-date={day.date}
      aria-selected={isSelected}
      aria-label={`${dayLabelFormat.format(date)}${day.selectable ? "" : " – nicht wählbar"}`}
      // aria-disabled statt disabled: Zellen bleiben für die Pfeiltasten-
      // Navigation fokussierbar (APG-Datepicker-Muster), lösen aber nichts aus.
      aria-disabled={!day.selectable || undefined}
      tabIndex={isTabStop ? 0 : -1}
      onFocus={() => onFocusDate(day.date)}
      onKeyDown={(event) => onKeyDown(event, day.date)}
      onClick={() => day.selectable && onSelect(day.date)}
      className={cn(
        "relative flex min-h-11 items-center justify-center rounded-lg text-sm tabular-nums transition-colors duration-200",
        day.selectable
          ? isSelected
            ? "bg-accent font-semibold text-deep"
            : "bg-white font-medium text-ink ring-1 ring-ink/8 hover:ring-primary/50"
          : "text-ink/25",
      )}
    >
      {date.getDate()}
      {isToday && (
        <span
          aria-hidden="true"
          title={bookingCopy.today}
          className={cn(
            "absolute bottom-1.5 size-1 rounded-full",
            isSelected ? "bg-deep" : "bg-primary",
          )}
        />
      )}
    </button>
  );
}

export function StepCalendar({ provider, selected, onSelect }: StepCalendarProps) {
  const today = useRef(new Date()).current;
  const [view, setView] = useState(() => {
    const base = selected ? fromISO(selected) : today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [days, setDays] = useState<BookingDay[] | null>(null);
  const [focusDate, setFocusDate] = useState<ISODate | null>(selected);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<ISODate | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDays(null);
    provider
      .getAvailableDates(monthKey(view.year, view.month))
      .then((result) => {
        if (!cancelled) setDays(result);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, view]);

  // Nach Monatswechsel per Tastatur: Fokus auf den Zieltag setzen
  useEffect(() => {
    if (!days || !pendingFocus.current) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    setFocusDate(target);
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)
        ?.focus();
    });
  }, [days]);

  const changeMonth = useCallback((delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const moveFocus = useCallback(
    (base: ISODate, deltaDays: number) => {
      const target = fromISO(base);
      target.setDate(target.getDate() + deltaDays);
      const targetISO = toISO(target);
      if (
        target.getFullYear() !== view.year ||
        target.getMonth() !== view.month
      ) {
        pendingFocus.current = targetISO;
        setView({ year: target.getFullYear(), month: target.getMonth() });
      } else {
        setFocusDate(targetISO);
        requestAnimationFrame(() => {
          gridRef.current
            ?.querySelector<HTMLButtonElement>(`[data-date="${targetISO}"]`)
            ?.focus();
        });
      }
    },
    [view],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, date: ISODate) => {
      const map: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: 7,
        ArrowUp: -7,
      };
      if (event.key in map) {
        event.preventDefault();
        moveFocus(date, map[event.key]);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        // Wochenanfang (Mo) / Wochenende (So)
        const dow = (fromISO(date).getDay() + 6) % 7;
        moveFocus(date, event.key === "Home" ? -dow : 6 - dow);
      } else if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        // Tag auf die Länge des Zielmonats klemmen (31. Aug → 30. Sep),
        // sonst läuft setMonth() über und springt einen Monat zu weit.
        const source = fromISO(date);
        const first = new Date(
          source.getFullYear(),
          source.getMonth() + (event.key === "PageUp" ? -1 : 1),
          1,
        );
        const lastDay = new Date(
          first.getFullYear(),
          first.getMonth() + 1,
          0,
        ).getDate();
        first.setDate(Math.min(source.getDate(), lastDay));
        pendingFocus.current = toISO(first);
        setView({ year: first.getFullYear(), month: first.getMonth() });
      }
    },
    [moveFocus],
  );

  const monthLabel = `${bookingCopy.months[view.month]} ${view.year}`;
  const todayISO = toISO(today);
  // Erster Roving-Tabstop: gewählter Tag, sonst erster wählbarer Tag
  const tabStop =
    focusDate && days?.some((d) => d.date === focusDate)
      ? focusDate
      : (days?.find((d) => d.selectable)?.date ?? null);
  const leadingBlanks = (new Date(view.year, view.month, 1).getDay() + 6) % 7;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={bookingCopy.prevMonth}
          className="flex size-11 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:border-primary/50 hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" />
        </button>
        <p aria-live="polite" className="font-display text-lg font-medium text-ink">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label={bookingCopy.nextMonth}
          className="flex size-11 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:border-primary/50 hover:text-ink"
        >
          <Icon name="arrow-right" size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center" aria-hidden="true">
        {bookingCopy.weekdaysShort.map((weekday) => (
          <span
            key={weekday}
            className="pb-2 text-[11px] font-medium tracking-wide text-ink/45 uppercase"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={monthLabel}
        key={monthKey(view.year, view.month)}
        className="animate-step-in grid grid-cols-7 gap-1"
      >
        {/* Gültige Grid-Semantik: Zellen in Wochen-Rows (display:contents
            lässt die Zellen weiter am 7-Spalten-Grid teilnehmen). */}
        {chunkIntoWeeks(leadingBlanks, days ?? []).map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} role="row" className="contents">
            {week.map((day, dayIndex) =>
              day === null ? (
                <span
                  key={`blank-${weekIndex}-${dayIndex}`}
                  role="gridcell"
                  aria-hidden="true"
                />
              ) : (
                <CalendarCell
                  key={day.date}
                  day={day}
                  isSelected={selected === day.date}
                  isToday={day.date === todayISO}
                  isTabStop={day.date === tabStop}
                  onFocusDate={setFocusDate}
                  onKeyDown={onKeyDown}
                  onSelect={onSelect}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
