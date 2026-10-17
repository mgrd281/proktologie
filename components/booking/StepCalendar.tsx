"use client";

import { cn } from "@/lib/cn";
import { LoadError } from "@/components/booking/LoadError";
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
 *
 * Ehrlich im Zustand: Dauert das Laden, steht „Freie Tage werden
 * geladen …“; scheitert es, steht genau das da – mit „Erneut versuchen“ und
 * Telefon. Geblättert wird nur, wo es etwas zu buchen gibt: nicht vor den
 * aktuellen Monat und nicht über den letzten buchbaren Tag hinaus.
 *
 * Mit echter Verfügbarkeit (verbindlicher Modus) öffnet der Kalender im
 * Monat des frühesten freien Tages; darüber steht ein Knopf, der diesen Tag
 * mit einem Tipp wählt. Bis der Tag feststeht, hält ein Platzhalter die
 * Maße – nichts springt, wenn Knopf und Monat erscheinen.
 */

interface StepCalendarProps {
  provider: BookingProvider;
  /** Gewählte Terminart – echte Verfügbarkeit gilt je Terminart. */
  typeId?: string | null;
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
/** „Mo., 19. Oktober“ – im Knopf zum frühesten freien Tag */
const earliestFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "long",
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
        "relative flex min-h-11 items-center justify-center rounded-xl text-sm tabular-nums transition-colors duration-200 focus-visible:rounded-xl!",
        day.selectable
          ? isSelected
            ? "bg-accent font-semibold text-deep"
            : "bg-mist font-medium text-ink hover:bg-primary/15 active:bg-primary/20"
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

/** Erst nach dieser Zeit erscheint der Ladehinweis – kurzes Laden flackert nicht. */
const LOADING_HINT_MS = 400;

/** Höhe des Rasters, solange die Tage laden: Platz für fünf Wochen. */
const GRID_RESERVE = "min-h-[14.75rem] max-md:min-h-[14.25rem]";

function WeekdayRow() {
  return (
    <div className="mt-4 grid grid-cols-7 text-center" aria-hidden="true">
      {bookingCopy.weekdaysShort.map((weekday) => (
        <span
          key={weekday}
          className="pb-2 text-xs font-medium tracking-wide text-ink/70 uppercase"
        >
          {weekday}
        </span>
      ))}
    </div>
  );
}

export function StepCalendar(props: StepCalendarProps) {
  const { provider, typeId } = props;
  // undefined = wird gesucht, null = keiner bekannt (oder Laden gescheitert –
  // das meldet dann der Monat selbst)
  const [earliest, setEarliest] = useState<ISODate | null | undefined>(() =>
    typeId && provider.getEarliestDate ? undefined : null,
  );
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!typeId || !provider.getEarliestDate) return;
    let cancelled = false;
    const timer = window.setTimeout(() => setHint(true), LOADING_HINT_MS);
    provider.getEarliestDate(typeId).then(
      (date) => !cancelled && setEarliest(date),
      () => !cancelled && setEarliest(null),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [provider, typeId]);

  if (earliest !== undefined) return <MonthCalendar {...props} earliest={earliest} />;

  // Platzhalter in den Maßen des Kalenders: Knopf, Monatszeile, Wochentage, Raster
  return (
    <div className="max-md:-mx-2" aria-busy="true">
      <div className="mb-4 min-h-14 max-md:mx-2" />
      <div className="h-11" />
      <WeekdayRow />
      <div className={cn("relative", GRID_RESERVE)}>
        {hint && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-ink/70">
            {bookingCopy.loadingDays}
          </p>
        )}
      </div>
    </div>
  );
}

function MonthCalendar({
  provider,
  typeId,
  selected,
  onSelect,
  earliest,
}: StepCalendarProps & { earliest: ISODate | null }) {
  const [today] = useState(() => new Date());
  // Ohne gewählten Tag: der Monat des frühesten freien Tages
  const [view, setView] = useState(() => {
    const base = selected ? fromISO(selected) : earliest ? fromISO(earliest) : today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; days: BookingDay[] | null; failed: boolean } | null>(null);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<ISODate | null>(selected);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<ISODate | null>(null);

  // Ein Schlüssel je Anfrage: Wechselt Monat, Terminart oder Versuch, gilt
  // sofort „lädt“ – ohne den Zustand im Effekt erst zurückzusetzen.
  const requestKey = `${monthKey(view.year, view.month)}|${typeId ?? ""}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    const hint = window.setTimeout(() => setHintKey(requestKey), LOADING_HINT_MS);
    provider
      .getAvailableDates(monthKey(view.year, view.month), typeId)
      .then((result) => {
        if (!cancelled) setLoaded({ key: requestKey, days: result, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, days: null, failed: true });
      });
    return () => {
      cancelled = true;
      window.clearTimeout(hint);
    };
  }, [provider, view, typeId, requestKey]);
  const current = loaded?.key === requestKey ? loaded : null;
  const days = current?.days ?? null;
  const failed = current?.failed ?? false;
  const showLoadingHint = !current && hintKey === requestKey;

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

  // Blättergrenzen: kein Monat vor dem heutigen, keiner hinter dem letzten
  // buchbaren Tag (den kennt nur der verbindliche Modus nach dem ersten Laden).
  const lastDate = days ? (provider.lastBookableDate?.(typeId) ?? null) : null;
  const monthAllowed = useCallback(
    (year: number, month: number) => {
      if (year * 12 + month < today.getFullYear() * 12 + today.getMonth()) return false;
      return !lastDate || `${monthKey(year, month)}-01` <= lastDate;
    },
    [today, lastDate],
  );
  const prevMonth = new Date(view.year, view.month - 1, 1);
  const nextMonth = new Date(view.year, view.month + 1, 1);
  const canPrev = monthAllowed(prevMonth.getFullYear(), prevMonth.getMonth());
  const canNext = monthAllowed(nextMonth.getFullYear(), nextMonth.getMonth());

  const changeMonth = useCallback(
    (delta: number) => {
      const d = new Date(view.year, view.month + delta, 1);
      if (!monthAllowed(d.getFullYear(), d.getMonth())) return;
      setView({ year: d.getFullYear(), month: d.getMonth() });
    },
    [view, monthAllowed],
  );

  const moveFocus = useCallback(
    (base: ISODate, deltaDays: number) => {
      const target = fromISO(base);
      target.setDate(target.getDate() + deltaDays);
      const targetISO = toISO(target);
      if (
        target.getFullYear() !== view.year ||
        target.getMonth() !== view.month
      ) {
        if (!monthAllowed(target.getFullYear(), target.getMonth())) return;
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
    [view, monthAllowed],
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
        if (!monthAllowed(first.getFullYear(), first.getMonth())) return;
        pendingFocus.current = toISO(first);
        setView({ year: first.getFullYear(), month: first.getMonth() });
      }
    },
    [moveFocus, monthAllowed],
  );

  const monthLabel = `${bookingCopy.months[view.month]} ${view.year}`;
  const todayISO = toISO(today);
  // Erster Roving-Tabstop: gewählter Tag, sonst erster wählbarer Tag
  const tabStop =
    focusDate && days?.some((d) => d.date === focusDate)
      ? focusDate
      : (days?.find((d) => d.selectable)?.date ?? null);
  const leadingBlanks = (new Date(view.year, view.month, 1).getDay() + 6) % 7;

  // Handy: Der Kalender nutzt einen Teil des Rands mit, damit die Tagesfelder
  // trotz sieben Spalten breit genug zum Tippen werden (390 px: 49 px).
  return (
    <div className="max-md:-mx-2">
      {earliest && (
        <div className="mb-4 max-md:mx-2">
          <button
            type="button"
            onClick={() => onSelect(earliest)}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-mist px-4 py-2 text-left text-sm text-ink transition-colors duration-200 hover:bg-primary/15 active:bg-primary/20 focus-visible:rounded-2xl!"
          >
            <Icon name="calendar" size={18} className="shrink-0 text-primary-deep" />
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-1.5">
              <span>{bookingCopy.earliestDay}</span>
              <span className="font-semibold">{earliestFormat.format(fromISO(earliest))}</span>
            </span>
            <Icon name="arrow-right" size={16} className="shrink-0 text-primary-deep" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        {/* aria-disabled statt disabled: Der Fokus bleibt auf dem Knopf, wenn
            er am Rand ankommt, statt im Nichts zu landen. */}
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={bookingCopy.prevMonth}
          aria-disabled={!canPrev || undefined}
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-mist text-ink/75 transition-colors focus-visible:rounded-full!",
            canPrev ? "hover:bg-primary/15 hover:text-ink" : "cursor-default opacity-40",
          )}
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
          aria-disabled={!canNext || undefined}
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-mist text-ink/75 transition-colors focus-visible:rounded-full!",
            canNext ? "hover:bg-primary/15 hover:text-ink" : "cursor-default opacity-40",
          )}
        >
          <Icon name="arrow-right" size={16} />
        </button>
      </div>

      <WeekdayRow />

      {failed ? (
        <div className="max-md:mx-2">
          <LoadError onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      ) : (
      <div
        ref={gridRef}
        role="grid"
        aria-label={monthLabel}
        aria-busy={days === null || undefined}
        key={monthKey(view.year, view.month)}
        // Während die freien Tage laden, ist Platz für fünf Wochen reserviert –
        // sonst schrumpft die Karte kurz und wächst dann wieder.
        className={cn(
          "animate-step-in relative grid grid-cols-7 gap-1",
          days === null && GRID_RESERVE,
        )}
      >
        {showLoadingHint && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-ink/70">
            {bookingCopy.loadingDays}
          </p>
        )}
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
      )}
    </div>
  );
}
