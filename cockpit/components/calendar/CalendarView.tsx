"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { cn } from "@/lib/cn";
import { holidayName } from "@/lib/booking/holidays";
import { KIND_LABEL, SOURCE_LABEL, STATUS_LABEL, type AppointmentStatus, type AppointmentView, type ExceptionView, type HoursRow, type TypeView } from "@/lib/booking/model";
import { addDays, dateKey, fmtLongDate, isoWeekday, minutesOfDay, startOfWeek, timeKey, WEEKDAYS_SHORT_DE, MONTHS_DE, parseDateKey } from "@/lib/time";
import { DemoBadge, EmptyState, PageTitle, Segmented, StatusPill, TypeDot } from "@/components/ui/Bits";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useNow } from "@/components/ui/useNow";
import { AppointmentDrawer, type DrawerState, type NewPrefill } from "./AppointmentDrawer";
import { ExceptionDrawer } from "./ExceptionDrawer";
import { RemoveExceptionDialog } from "./RemoveExceptionDialog";

export type CalendarViewMode = "tag" | "woche" | "agenda";

const PX_PER_MIN = 1.6; // 15 min = 24 px, 1 h = 96 px

interface Props {
  view: CalendarViewMode;
  date: string;
  today: string;
  now: string;
  appointments: AppointmentView[];
  exceptions: ExceptionView[];
  types: TypeView[];
  hours: HoursRow[];
  openNew: boolean;
  /** Vorbelegung aus „Nächster freier Termin“ (?t=, ?art=) */
  openTime: string | null;
  openType: string | null;
  /** Aus einer Anfrage oder von der Warteliste (?anfrage=, ?warteliste=) */
  openPrefill: NewPrefill | null;
  openException: boolean;
  openId: string | null;
}

const NARROW = "(max-width: 767px)";
const subscribeNarrow = (onChange: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
/** Unter 768 px gibt es keine Wochenansicht – dort ist sie unlesbar. Auf dem Server: breit. */
function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
}

export function CalendarView(p: Props) {
  const router = useRouter();
  const newFromAddress = (): DrawerState => ({ mode: "new", date: p.date, time: p.openTime ?? undefined, typeId: p.openType ?? undefined, prefill: p.openPrefill ?? undefined });
  const [drawer, setDrawer] = useState<DrawerState>(
    p.openNew ? newFromAddress() : p.openId ? (() => {
      const a = p.appointments.find((x) => x.id === p.openId);
      return a ? { mode: "edit" as const, appointment: a } : null;
    })() : null,
  );
  const [exceptionOpen, setExceptionOpen] = useState(p.openException);
  const [removing, setRemoving] = useState<ExceptionView | null>(null);

  // Die Adresse ändert sich auch, während der Kalender offen ist: „n“, ein
  // Treffer der Suche (?id=), „Blocker / Urlaub eintragen“ aus der Palette
  const linked = p.openPrefill?.link;
  const request = p.openNew
    ? `neu:${p.date}:${p.openTime ?? ""}:${p.openType ?? ""}:${linked?.requestId ?? linked?.waitlistId ?? ""}`
    : p.openId
      ? `id:${p.openId}`
      : p.openException
        ? "ausnahme"
        : "";
  const [handled, setHandled] = useState(request);
  if (request !== handled) {
    setHandled(request);
    if (p.openNew) setDrawer(newFromAddress());
    else if (p.openId) {
      const a = p.appointments.find((x) => x.id === p.openId);
      if (a) setDrawer({ mode: "edit", appointment: a });
    } else if (p.openException) setExceptionOpen(true);
  }

  // Blättern im Hintergrund: Das Raster bleibt stehen und wird gedimmt, bis der neue Tag da ist
  const [paging, startPaging] = useTransition();
  const go = useCallback(
    (view: CalendarViewMode, date: string) => startPaging(() => router.push(`/termine?v=${view}&d=${date}`)),
    [router],
  );
  const narrow = useNarrow();
  const view: CalendarViewMode = narrow && p.view === "woche" ? "agenda" : p.view;
  const step = p.view === "tag" ? 1 : 7;
  const nowMs = useNow(p.now);

  // Tastatur: ← → t
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (drawer || exceptionOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") go(p.view, addDays(p.date, -step));
      if (e.key === "ArrowRight") go(p.view, addDays(p.date, step));
      if (e.key === "t") go(p.view, p.today);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [p.view, p.date, p.today, step, go, drawer, exceptionOpen]);

  const grid = useMemo(() => gridBounds(p.hours), [p.hours]);
  const week = startOfWeek(p.date);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => isoWeekday(d) <= 5 || p.hours.some((h) => h.weekday === isoWeekday(d))), [week, p.hours]);

  const label =
    p.view === "tag"
      ? fmtLongDate(new Date(`${p.date}T12:00:00Z`))
      : `${WEEKDAYS_SHORT_DE[0]} ${fmtDM(week)} – ${WEEKDAYS_SHORT_DE[weekDays.length - 1]} ${fmtDM(weekDays.at(-1)!)} · ${MONTHS_DE[parseDateKey(week).m - 1]} ${parseDateKey(week).y}`;

  // Stabil über Neuberechnungen hinweg: Das Termin-Fenster setzt sich nur bei
  // einem neuen Öffnen zurück, nicht, weil die Seite sich aktualisiert hat.
  const { openNew, openId, openException, date } = p;
  const closeDrawer = useCallback(() => {
    setDrawer(null);
    if (openNew || openId) router.replace(`/termine?v=${p.view}&d=${date}`);
  }, [openNew, openId, p.view, date, router]);
  const closeException = useCallback(() => {
    setExceptionOpen(false);
    if (openException) router.replace(`/termine?v=${p.view}&d=${date}`);
  }, [openException, p.view, date, router]);
  const drawerTypes = useMemo(
    () => p.types.filter((t) => t.active || (drawer?.mode === "edit" && drawer.appointment.typeId === t.id)),
    [p.types, drawer],
  );

  return (
    <>
      <PageTitle
        eyebrow="Termine"
        title={label}
        actions={
          <>
            <Button variant="ghost" size="sm" icon="clock" onClick={() => setExceptionOpen(true)}>
              Blocker / Urlaub
            </Button>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setDrawer({ mode: "new", date: p.date })}>
              Neuer Termin
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <IconButton label="Zurück" icon="chevron-left" onClick={() => go(p.view, addDays(p.date, -step))} />
          <Button variant="secondary" size="sm" onClick={() => go(p.view, p.today)}>
            Heute
          </Button>
          <IconButton label="Weiter" icon="chevron-right" onClick={() => go(p.view, addDays(p.date, step))} />
        </div>
        <input
          type="date"
          aria-label="Datum wählen"
          value={p.date}
          onChange={(e) => e.target.value && go(p.view, e.target.value)}
          className="tnum h-9 rounded-full border border-line bg-surface-raised px-3 text-[13px] text-text max-md:h-11 max-md:text-[16px]"
        />
        <div className="ml-auto">
          <Segmented
            label="Ansicht"
            value={view}
            onChange={(v) => go(v, p.date)}
            options={[
              { value: "tag" as const, label: "Tag" },
              ...(narrow ? [] : [{ value: "woche" as const, label: "Woche" }]),
              { value: "agenda" as const, label: "Agenda" },
            ]}
          />
        </div>
      </div>

      <div aria-busy={paging || undefined} className={cn("transition-opacity duration-200", paging && "opacity-50")}>
        {view === "agenda" ? (
          <AgendaView days={weekDays} appointments={p.appointments} onOpen={(a) => setDrawer({ mode: "edit", appointment: a })} today={p.today} />
        ) : (
          <TimeGrid
            days={view === "tag" ? [p.date] : weekDays}
            grid={grid}
            hours={p.hours}
            today={p.today}
            nowMs={nowMs}
            appointments={p.appointments}
            exceptions={p.exceptions}
            onOpen={(a) => setDrawer({ mode: "edit", appointment: a })}
            onSlot={(date, time, warning) => setDrawer({ mode: "new", date, time, warning })}
            onException={setRemoving}
          />
        )}
      </div>

      <AppointmentDrawer
        state={drawer}
        types={drawerTypes}
        onClose={closeDrawer}
        onFollowUp={(prefill) => setDrawer({ mode: "new", date: p.today, prefill })}
      />
      <ExceptionDrawer open={exceptionOpen} date={p.date} onClose={closeException} />
      <RemoveExceptionDialog exception={removing} onClose={() => setRemoving(null)} />
    </>
  );
}

function fmtDM(date: string) {
  const { d, m } = parseDateKey(date);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}

function gridBounds(hours: HoursRow[]) {
  const opens = hours.map((h) => minutesOfDay(h.opens));
  const closes = hours.map((h) => minutesOfDay(h.closes));
  const start = Math.max(0, Math.floor((opens.length ? Math.min(...opens) : 7 * 60) / 60) * 60 - 60);
  const end = Math.min(24 * 60, Math.ceil((closes.length ? Math.max(...closes) : 18 * 60) / 60) * 60 + 60);
  return { start, end };
}

/** Sprechzeiten eines Wochentags als Minuten-Spannen, sortiert. */
function openSpans(date: string, hours: HoursRow[]): Array<[number, number]> {
  const wd = isoWeekday(date);
  return hours
    .filter((h) => h.weekday === wd)
    .map((h): [number, number] => [minutesOfDay(h.opens), minutesOfDay(h.closes)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
}

/** Die Lücken zwischen den Sprechzeiten im sichtbaren Raster – dort wird schattiert. */
function closedSpans(open: Array<[number, number]>, grid: { start: number; end: number }): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cursor = grid.start;
  for (const [a, b] of open) {
    if (a > cursor) out.push([cursor, Math.min(a, grid.end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < grid.end) out.push([cursor, grid.end]);
  return out.filter(([a, b]) => b > a);
}

/** Status nicht nur als Farbe: Symbol im Block, Wort darunter (oder für Screenreader). */
const STATUS_ICON: Partial<Record<AppointmentStatus, IconName>> = {
  confirmed: "check",
  reminded: "bell",
  completed: "check",
  no_show: "close",
};

// ---------- Zeitraster (Tag / Woche) ----------

function TimeGrid({
  days,
  grid,
  hours,
  today,
  nowMs,
  appointments,
  exceptions,
  onOpen,
  onSlot,
  onException,
}: {
  days: string[];
  grid: { start: number; end: number };
  hours: HoursRow[];
  today: string;
  nowMs: number;
  appointments: AppointmentView[];
  exceptions: ExceptionView[];
  onOpen: (a: AppointmentView) => void;
  /** Klick ins Raster – mit Warnung, wenn die Praxis dann zu ist */
  onSlot: (date: string, time: string, warning?: string) => void;
  /** Blocker/Urlaub angeklickt – anzeigen und auf Wunsch entfernen */
  onException: (e: ExceptionView) => void;
}) {
  const hoursList = useMemo(() => {
    const out: number[] = [];
    for (let m = grid.start; m < grid.end; m += 60) out.push(m);
    return out;
  }, [grid]);
  const height = (grid.end - grid.start) * PX_PER_MIN;
  const nowMin = minutesOfDay(timeKey(new Date(nowMs)));
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef("");

  // Beim Öffnen eines Tages zur aktuellen Zeit bzw. zum Beginn der Sprechzeit
  // scrollen – nur einmal je Tag/Woche. Das Ticken der Uhr und das Neuladen
  // im Hintergrund lassen die Scrollposition stehen.
  const daysKey = `${days.join(",")}|${grid.start}`;
  useEffect(() => {
    const el = scroller.current;
    if (!el || scrolledFor.current === daysKey) return;
    scrolledFor.current = daysKey;
    const minute = minutesOfDay(timeKey(new Date()));
    const target = daysKey.includes(today) ? (minute - grid.start - 90) * PX_PER_MIN : 60 * PX_PER_MIN;
    el.scrollTop = Math.max(0, target);
  }, [daysKey, today, grid.start]);

  const byDay = (date: string) => appointments.filter((a) => dateKey(new Date(a.startsAt)) === date && a.status !== "cancelled");
  const exceptionsFor = (date: string) => {
    const dayStart = new Date(`${date}T00:00:00Z`).getTime() - 3 * 3600_000; // grob, nur zur Vorauswahl
    const dayEnd = dayStart + 30 * 3600_000;
    return exceptions.filter((e) => new Date(e.startsAt).getTime() < dayEnd && new Date(e.endsAt).getTime() > dayStart);
  };

  const onGridClick = (e: React.MouseEvent<HTMLDivElement>, date: string, warnDay: string | null, open: Array<[number, number]>) => {
    if ((e.target as HTMLElement).closest("[data-appt], [data-exception]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15 + grid.start;
    const outside = !open.some(([a, b]) => minutes >= a && minutes < b);
    onSlot(
      date,
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
      warnDay ?? (outside ? "Diese Zeit liegt außerhalb der Sprechzeiten." : undefined),
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-line">
      {days.length > 1 && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => {
            const wd = isoWeekday(d);
            const { d: dd } = parseDateKey(d);
            return (
              <div key={d} className={cn("border-l border-line px-2 py-2 text-center", d === today && "bg-brand-soft/50")}>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-text-muted uppercase">{WEEKDAYS_SHORT_DE[wd - 1]}</p>
                <p className={cn("font-display tnum text-[20px] leading-tight", d === today ? "text-brand" : "text-text")}>{dd}</p>
              </div>
            );
          })}
        </div>
      )}
      <div ref={scroller} className="max-h-[calc(100dvh-280px)] min-h-[420px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))`, height }}>
          {/* Zeitachse */}
          <div className="relative">
            {hoursList.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-text-muted" style={{ top: (m - grid.start) * PX_PER_MIN }}>
                {String(m / 60).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((date) => {
            const dayExceptions = exceptionsFor(date);
            const allDay = dayExceptions.filter((e) => e.allDay || e.kind === "urlaub" || e.kind === "closed");
            // Gesetzlicher Feiertag: online geschlossen, von Hand trotzdem buchbar
            const holiday = holidayName(date);
            const open = openSpans(date, hours);
            const closedDay = open.length === 0;
            const firstAllDay = allDay[0];
            const warnDay = holiday
              ? `Feiertag · ${holiday} – die Praxis ist geschlossen.`
              : firstAllDay
                ? `${KIND_LABEL[firstAllDay.kind]}${firstAllDay.label ? ` · ${firstAllDay.label}` : ""} – an diesem Tag ist die Praxis zu.`
                : closedDay
                  ? "An diesem Tag ist keine Sprechzeit."
                  : null;
            return (
              <div
                key={date}
                className={cn("relative cursor-crosshair border-l border-line", date === today && "bg-brand-soft/20")}
                onClick={(e) => onGridClick(e, date, warnDay, open)}
                role="presentation"
              >
                {/* Außerhalb der Sprechzeiten: schattiert */}
                {closedSpans(open, grid).map(([a, b]) => (
                  <div key={`c${a}`} aria-hidden="true" className="absolute inset-x-0 bg-surface-sunken/70" style={{ top: (a - grid.start) * PX_PER_MIN, height: (b - a) * PX_PER_MIN }} />
                ))}
                {hoursList.map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-line" style={{ top: (m - grid.start) * PX_PER_MIN }} />
                ))}
                {hoursList.map((m) => (
                  <div key={`h${m}`} className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: (m + 30 - grid.start) * PX_PER_MIN }} />
                ))}
                {(allDay.length > 0 || holiday) && (
                  <div className="absolute inset-0 z-[1] bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--line)_10px_11px)]">
                    {holiday ? (
                      <p className="sticky top-1 mx-2 mt-2 inline-block rounded-md bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-muted ring-1 ring-line">
                        Feiertag · {holiday}
                      </p>
                    ) : (
                      <button
                        type="button"
                        data-exception
                        onClick={() => onException(firstAllDay!)}
                        className="sticky top-1 mx-2 mt-2 inline-block rounded-md bg-surface-raised px-2 py-1 text-left text-[11px] font-medium text-text-muted ring-1 ring-line hover:text-text hover:ring-line-strong"
                      >
                        {KIND_LABEL[firstAllDay!.kind]}
                        {firstAllDay!.label ? ` · ${firstAllDay!.label}` : ""}
                      </button>
                    )}
                  </div>
                )}
                {closedDay && !holiday && allDay.length === 0 && (
                  <p className="pointer-events-none sticky top-1 z-[1] mx-2 mt-2 inline-block rounded-md bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-muted ring-1 ring-line">
                    Geschlossen
                  </p>
                )}
                {dayExceptions
                  .filter((e) => !allDay.includes(e))
                  .map((e) => {
                    const s = minutesOfDay(timeKey(new Date(e.startsAt)));
                    const en = minutesOfDay(timeKey(new Date(e.endsAt)));
                    return (
                      <button
                        type="button"
                        key={e.id}
                        data-exception
                        onClick={() => onException(e)}
                        className="absolute inset-x-1 z-[1] block rounded-lg bg-[repeating-linear-gradient(135deg,transparent_0_8px,var(--line)_8px_9px)] text-left ring-1 ring-line-strong hover:ring-text-muted"
                        style={{ top: (s - grid.start) * PX_PER_MIN, height: Math.max(20, (en - s) * PX_PER_MIN) }}
                      >
                        <span className="block truncate px-2 py-1 text-[11px] font-medium text-text-muted">
                          {KIND_LABEL[e.kind]}
                          {e.label ? ` · ${e.label}` : ""}
                        </span>
                      </button>
                    );
                  })}
                {byDay(date).map((a) => {
                  const s = minutesOfDay(timeKey(new Date(a.startsAt)));
                  const en = minutesOfDay(timeKey(new Date(a.endsAt)));
                  const h = Math.max(22, (en - s) * PX_PER_MIN);
                  const done = a.status === "completed" || a.status === "no_show";
                  const statusIcon = STATUS_ICON[a.status];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-appt
                      onClick={() => onOpen(a)}
                      className={cn(
                        "absolute inset-x-1 z-[2] overflow-hidden rounded-lg border-l-[3px] bg-surface-raised text-left shadow-sm ring-1 ring-line transition-shadow hover:shadow-md hover:ring-line-strong",
                        done && "opacity-70",
                        a.status === "no_show" && "border-warn",
                        a.status !== "no_show" && colorBorder[a.color],
                      )}
                      style={{ top: (s - grid.start) * PX_PER_MIN + 1, height: h - 2 }}
                    >
                      <span className="flex items-center gap-1 truncate px-2 pt-0.5 text-[12px] leading-tight font-medium text-text">
                        {statusIcon && <Icon name={statusIcon} size={12} className={a.status === "no_show" ? "shrink-0 text-warn" : "shrink-0 text-text-muted"} />}
                        <span className="tnum text-text-muted">{timeKey(new Date(a.startsAt))}</span>
                        <span className="truncate">
                          {a.pii.lastName}, {a.pii.firstName}
                        </span>
                      </span>
                      {h >= 36 ? (
                        <span className="block truncate px-2 text-[11px] text-text-muted">
                          {a.typeLabel}
                          {a.status !== "booked" ? ` · ${STATUS_LABEL[a.status]}` : ""}
                          {a.isDemo ? " · Demo" : ""}
                        </span>
                      ) : (
                        <span className="sr-only">
                          {a.typeLabel} · {STATUS_LABEL[a.status]}
                        </span>
                      )}
                    </button>
                  );
                })}
                {date === today && nowMin >= grid.start && nowMin <= grid.end && (
                  <div className="pointer-events-none absolute inset-x-0 z-[3] flex items-center" style={{ top: (nowMin - grid.start) * PX_PER_MIN }}>
                    <span className="-ml-1 size-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger/70" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const colorBorder: Record<string, string> = {
  green: "border-brand-fill",
  moss: "border-primary",
  amber: "border-warn",
  slate: "border-text-faint",
  blue: "border-info",
};

// ---------- Agenda ----------

function AgendaView({ days, appointments, onOpen, today }: { days: string[]; appointments: AppointmentView[]; onOpen: (a: AppointmentView) => void; today: string }) {
  const rows = appointments.filter((a) => a.status !== "cancelled");
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-raised ring-1 ring-line">
        <EmptyState icon="calendar" title="Keine Termine in dieser Woche" text="Mit ← → zur nächsten Woche, mit t zurück zu heute." compact />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {days.map((d) => {
        const dayRows = rows.filter((a) => dateKey(new Date(a.startsAt)) === d);
        if (!dayRows.length) return null;
        return (
          <section key={d}>
            <h2 className={cn("mb-2 flex items-baseline gap-2 text-[13px] font-semibold tracking-[0.12em] uppercase", d === today ? "text-brand" : "text-text-muted")}>
              {fmtLongDate(new Date(`${d}T12:00:00Z`))}
              <span className="tnum font-normal normal-case text-text-muted tracking-normal">{dayRows.length === 1 ? "1 Termin" : `${dayRows.length} Termine`}</span>
            </h2>
            <DataTable<AppointmentView>
              caption={`Termine am ${d}`}
              rows={dayRows}
              rowKey={(a) => a.id}
              onOpen={onOpen}
              dense
              columns={[
                { key: "zeit", header: "Zeit", width: "110px", numeric: true, cell: (a) => `${timeKey(new Date(a.startsAt))} – ${timeKey(new Date(a.endsAt))}` },
                {
                  key: "name",
                  header: "Patient",
                  cell: (a) => (
                    <span className="flex items-center gap-2 font-medium text-text">
                      {a.pii.lastName}, {a.pii.firstName}
                      {a.isDemo && <DemoBadge />}
                    </span>
                  ),
                },
                {
                  key: "art",
                  header: "Terminart",
                  cell: (a) => (
                    <span className="flex items-center gap-1.5 text-text-muted">
                      <TypeDot color={a.color} />
                      {a.typeLabel}
                    </span>
                  ),
                },
                { key: "quelle", header: "Quelle", hideBelow: "md", cell: (a) => <span className="text-text-muted">{SOURCE_LABEL[a.source]}</span> },
                { key: "ref", header: "Ref", hideBelow: "lg", numeric: true, cell: (a) => <span className="text-text-muted">{a.ref}</span> },
                { key: "status", header: "Status", align: "right", cell: (a) => <StatusPill status={a.status} /> },
              ]}
            />
          </section>
        );
      })}
    </div>
  );
}

export { Icon as _Icon };
