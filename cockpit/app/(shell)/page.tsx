import Link from "next/link";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listTypes, nextFreeSlot, todayOverview } from "@/lib/booking/repo";
import { fmtLongDate, fmtShortDate, WEEKDAYS_SHORT_DE } from "@/lib/time";
import { Card, Eyebrow, PageTitle } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { KpiTile } from "@/components/ui/Kpi";
import { TodayList } from "@/components/calendar/TodayList";

export const metadata = { title: "Heute" };

/**
 * Das Dashboard beginnt mit EINEM Satz: Ist heute alles in Ordnung?
 * Erst darunter die Zahlen, dann die Liste. Progressive Disclosure.
 */
export default async function TodayPage() {
  const actor = await requireActorOrRedirect();
  const now = new Date();
  const [ov, types] = await Promise.all([todayOverview(now), listTypes()]);
  const firstTypes = types.slice(0, 3);
  const nextFree = await Promise.all(firstTypes.map((t) => nextFreeSlot(t.id, now)));

  const hour = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 11 ? "Guten Morgen" : hour < 17 ? "Guten Tag" : "Guten Abend";
  const firstName = actor.name.split(/\s+/)[0] ?? actor.name;

  const allGood = ov.counts.open === 0 && ov.openRequests === 0;
  const summary =
    ov.counts.total === 0
      ? "Heute stehen keine Termine im Kalender."
      : `Heute ${ov.counts.total} ${ov.counts.total === 1 ? "Termin" : "Termine"} · ${ov.counts.open} ${ov.counts.open === 1 ? "unbestätigter" : "unbestätigte"} · ${ov.openRequests} offene ${ov.openRequests === 1 ? "Anfrage" : "Anfragen"}${allGood ? " · alles im grünen Bereich." : "."}`;

  const weekMax = Math.max(1, ...ov.weekLoad.map((d) => d.count));

  return (
    <>
      <PageTitle
        eyebrow={fmtLongDate(now)}
        title={
          <>
            {greeting}, {firstName}
            <span className="text-brand">.</span>
          </>
        }
        actions={
          <>
            <Button href="/termine?neu=1" variant="primary" icon="plus">
              Neuer Termin
            </Button>
            <Button href="/termine" variant="secondary" icon="calendar">
              Kalender
            </Button>
          </>
        }
      />

      <p className={`mb-6 flex items-center gap-3 rounded-2xl px-5 py-4 text-[15px] ${allGood ? "bg-brand-soft text-text" : "bg-surface-raised text-text ring-1 ring-line"}`}>
        <span className={`size-2.5 shrink-0 rounded-full ${allGood ? "bg-brand-fill" : "bg-warn"}`} aria-hidden="true" />
        {summary}
        <span
          className={`ml-auto hidden rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] uppercase md:inline ${
            ov.bookingLive && !ov.bookingPaused ? "bg-brand-soft text-brand" : ov.bookingPaused ? "bg-warn/12 text-warn" : "bg-surface-sunken text-text-muted"
          }`}
        >
          {ov.bookingLive && !ov.bookingPaused ? "Website-Buchung: live" : ov.bookingPaused ? "Website-Buchung: pausiert" : "Website-Buchung: noch nicht live"}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiTile label="Termine heute" value={ov.counts.total} spark={ov.weekLoad.map((d) => d.count)} sub="Verlauf dieser Woche" />
        <KpiTile label="Unbestätigt" value={ov.counts.open} tone={ov.counts.open > 0 ? "warn" : "ok"} sub={ov.counts.open > 0 ? "Erinnerung ausstehend" : "Alle bestätigt"} />
        <KpiTile label="Wahrgenommen" value={ov.counts.completed} tone="ok" sub={`${ov.counts.noShow} nicht erschienen`} />
        <KpiTile label="Über die Website" value={ov.webBookingsWeek} tone="neutral" sub="Buchungen in 7 Tagen" />
        <KpiTile label="Warteliste" value={ov.waitlistOpen} tone={ov.waitlistOpen > 0 ? "warn" : "neutral"} sub={ov.openRequests > 0 ? `${ov.openRequests} offene Anfragen (Phase 2)` : "Angebote laufen automatisch"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <Eyebrow>Tagesplan</Eyebrow>
              <h2 className="font-display mt-1 text-xl font-medium text-text">{fmtShortDate(now)}</h2>
            </div>
            <Link href={`/termine?v=tag&d=${ov.date}`} className="flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              Im Kalender <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <TodayList appointments={ov.appointments} now={now.toISOString()} />
        </Card>

        <div className="space-y-6">
          <Card>
            <Eyebrow>Diese Woche</Eyebrow>
            <ul className="mt-4 space-y-2">
              {ov.weekLoad.map((d, i) => (
                <li key={d.date} className="flex items-center gap-3 text-[13px]">
                  <span className={`w-6 shrink-0 font-medium ${d.date === ov.date ? "text-brand" : "text-text-muted"}`}>{WEEKDAYS_SHORT_DE[i]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <span className={`block h-full rounded-full ${d.date === ov.date ? "bg-brand-fill" : "bg-primary/50"}`} style={{ width: `${(d.count / weekMax) * 100}%` }} />
                  </span>
                  <span className="tnum w-6 text-right text-text-muted">{d.count}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <Eyebrow>Nächster freier Termin</Eyebrow>
            <ul className="mt-3 divide-y divide-line">
              {firstTypes.map((t, i) => {
                const s = nextFree[i];
                return (
                  <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]">
                    <span className="text-text">{t.label}</span>
                    <span className="tnum text-right font-medium text-text-muted">{s ? `${fmtShortDate(s.startsAt)} · ${s.time}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12px] text-text-faint">Aus Sprechzeiten, Ausnahmen und Belegung berechnet – dieselbe Logik, die die Website-Buchung nutzt.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
