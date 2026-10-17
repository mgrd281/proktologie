import Link from "next/link";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listTypes, nextFreeSlots, todayOverview } from "@/lib/booking/repo";
import { addDays, fmtLongDate, fmtShortDate, timeKey, WEEKDAYS_SHORT_DE } from "@/lib/time";
import { cn } from "@/lib/cn";
import { firstNameOf } from "@/lib/names";
import { Card, Eyebrow, PageTitle } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { KpiTile } from "@/components/ui/Kpi";
import { TodayList } from "@/components/calendar/TodayList";
import { PrintOnLoad } from "./PrintOnLoad";

export const metadata = { title: "Heute" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * „Heute“ beginnt mit EINEM Satz: Ist alles in Ordnung? Darunter, was jetzt
 * zu tun ist – jeder Hinweis führt direkt hin. Dann der Tagesplan, erst
 * danach die Zahlen. Progressive Disclosure.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ drucken?: string }> }) {
  const print = (await searchParams).drucken === "1";
  const actor = await requireActorOrRedirect();
  const now = new Date();
  const [ov, types] = await Promise.all([todayOverview(now), listTypes()]);
  const firstTypes = types.slice(0, 3);
  const nextFree = await nextFreeSlots(
    firstTypes.map((t) => t.id),
    now,
  );

  const hour = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 11 ? "Guten Morgen" : hour < 17 ? "Guten Tag" : "Guten Abend";
  const firstName = firstNameOf(actor.name);

  const allGood = ov.counts.open === 0 && ov.openRequests === 0;
  const summary =
    ov.counts.total === 0
      ? "Heute stehen keine Termine im Kalender."
      : `Heute ${ov.counts.total} ${ov.counts.total === 1 ? "Termin" : "Termine"} · ${ov.counts.open} ${ov.counts.open === 1 ? "unbestätigter" : "unbestätigte"} · ${ov.openRequests} offene ${ov.openRequests === 1 ? "Anfrage" : "Anfragen"}${allGood ? " · alles im grünen Bereich." : "."}`;

  // Was jetzt zu tun ist – das Dringende zuerst
  const today = `/termine?v=tag&d=${ov.date}`;
  const overdue = ov.overdueRequests;
  const openNotOverdue = ov.openRequests - overdue.total;
  const hints: Array<{ label: string; href: string; urgent?: boolean }> = [
    ...(overdue.total > 0
      ? [
          {
            label: `${overdue.callbacks === overdue.total ? plural(overdue.total, "Rückruf", "Rückrufe") : plural(overdue.total, "Anfrage", "Anfragen")} überfällig`,
            href: "/anfragen",
            urgent: true,
          },
        ]
      : []),
    ...(openNotOverdue > 0 ? [{ label: `${openNotOverdue} offene ${openNotOverdue === 1 ? "Anfrage" : "Anfragen"}`, href: "/anfragen" }] : []),
    ...(ov.counts.open > 0 ? [{ label: `${plural(ov.counts.open, "Termin", "Termine")} heute unbestätigt`, href: today }] : []),
    ...(ov.waitlistOpen > 0 ? [{ label: `${ov.waitlistOpen} auf der Warteliste`, href: "/warteliste" }] : []),
    ...(ov.demoCount > 0 ? [{ label: "Demo-Daten aktiv", href: "/einstellungen/demo" }] : []),
  ];
  const live = ov.bookingLive && !ov.bookingPaused;

  const weekMax = Math.max(1, ...ov.weekLoad.map((d) => d.count));
  const nextDayLabel = ov.nextDay.date === addDays(ov.date, 1) ? "Morgen" : fmtLongDate(new Date(`${ov.nextDay.date}T12:00:00Z`));

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

      {print && <PrintOnLoad />}
      <section aria-label="Lage heute" className={cn("no-print mb-6 rounded-2xl px-5 py-4", allGood ? "bg-brand-soft text-text" : "bg-surface-raised text-text ring-1 ring-line")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", allGood ? "bg-brand-fill" : "bg-warn")} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[15px] max-md:basis-[calc(100%-1.5rem)]">{summary}</p>
          <Link
            href="/einstellungen/demo"
            className={cn(
              "inline-flex min-h-8 items-center rounded-md px-2 text-[12px] font-semibold tracking-[0.08em] uppercase max-md:min-h-11",
              live ? "bg-brand-soft text-text" : ov.bookingPaused ? "bg-warn/12 text-text" : "bg-surface-sunken text-text-muted",
            )}
          >
            {live ? "Website-Buchung: live" : ov.bookingPaused ? "Website-Buchung: pausiert" : "Website-Buchung: noch nicht live"}
          </Link>
        </div>
        {hints.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Zu tun">
            {hints.map((h) => (
              <li key={h.label}>
                <Link
                  href={h.href}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 rounded-full border px-3.5 text-[13px] font-medium transition-colors max-md:min-h-11",
                    h.urgent ? "border-danger/40 bg-danger/8 text-text hover:border-danger" : "border-line-strong bg-surface-raised text-text hover:border-brand",
                  )}
                >
                  {h.urgent && <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />}
                  {h.label}
                  <Icon name="chevron-right" size={14} className="text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <Eyebrow>Tagesplan</Eyebrow>
              <h2 className="font-display mt-1 text-xl font-medium text-text">{fmtShortDate(now)}</h2>
            </div>
            <Link href={today} className="flex min-h-11 items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              Im Kalender <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <TodayList appointments={ov.appointments} now={now.toISOString()} />
        </Card>

        <div className="no-print space-y-6">
          <Card>
            <Eyebrow>Nächster freier Termin</Eyebrow>
            <ul className="mt-3 divide-y divide-line">
              {firstTypes.map((t, i) => {
                const s = nextFree[i];
                return (
                  <li key={t.id}>
                    {s ? (
                      // Ein Klick öffnet den Termin, vorausgefüllt mit Art, Tag und Uhrzeit
                      <Link
                        href={`/termine?neu=1&d=${s.date}&t=${s.time}&art=${encodeURIComponent(t.id)}`}
                        className="group flex min-h-11 items-center justify-between gap-3 py-2 text-[13px]"
                      >
                        <span className="text-text">{t.label}</span>
                        <span className="tnum flex items-center gap-1 text-right font-medium text-text-muted group-hover:text-brand">
                          {fmtShortDate(new Date(`${s.date}T12:00:00Z`))} · {s.time}
                          <Icon name="chevron-right" size={14} />
                        </span>
                      </Link>
                    ) : (
                      <span className="flex min-h-11 items-center justify-between gap-3 py-2 text-[13px]">
                        <span className="text-text">{t.label}</span>
                        <span className="text-text-muted">in 3 Wochen nichts frei</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12px] text-text-muted">Aus Sprechzeiten, Ausnahmen und Belegung – fürs Team ohne den Vorlauf der Online-Buchung.</p>
          </Card>

          {/* Der nächste Praxistag: freitags der Montag, vor Feiertagen der Tag danach */}
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <Eyebrow>Nächster Praxistag</Eyebrow>
                <p className="mt-1 text-[13px] font-medium text-text">{nextDayLabel}</p>
              </div>
              <Link href={`/termine?v=tag&d=${ov.nextDay.date}`} className="flex min-h-11 items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                Im Kalender <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {ov.nextDay.appointments.length === 0 ? (
              <p className="mt-3 text-[13px] text-text-muted">Keine Termine.</p>
            ) : (
              <ol className="mt-3 divide-y divide-line">
                {ov.nextDay.appointments.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-[13px]">
                    <span className="tnum shrink-0 font-medium text-text">{timeKey(new Date(a.startsAt))}</span>
                    <span className="flex-1 truncate text-text-muted">{a.typeLabel}</span>
                  </li>
                ))}
              </ol>
            )}
            {ov.nextDay.appointments.length > 6 && <p className="mt-2 text-[12px] text-text-muted">und {ov.nextDay.appointments.length - 6} weitere</p>}
          </Card>

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
        </div>
      </div>

      {/* Die Zahlen zuletzt – jede führt zur Liste dahinter */}
      <div className="no-print mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiTile label="Termine heute" value={ov.counts.total} spark={ov.weekLoad.map((d) => d.count)} sub="Verlauf dieser Woche" href={today} />
        <KpiTile label="Unbestätigt" value={ov.counts.open} tone={ov.counts.open > 0 ? "warn" : "ok"} sub={ov.counts.open > 0 ? "Erinnerung ausstehend" : "Alle bestätigt"} href={today} />
        <KpiTile label="Wahrgenommen" value={ov.counts.completed} tone="ok" sub={`${ov.counts.noShow} nicht erschienen`} href={today} />
        <KpiTile label="Über Website & Chat" value={ov.webBookingsWeek} tone="neutral" sub="Buchungen in 7 Tagen" href="/termine?v=agenda" />
        <KpiTile
          label="Warteliste"
          value={ov.waitlistOpen}
          tone={ov.waitlistOpen > 0 ? "warn" : "neutral"}
          // Angebote verschickt die Automatik nur, solange die Online-Buchung live ist (lifecycle.offerNext)
          sub={ov.bookingLive ? "Angebote laufen automatisch" : undefined}
          href="/warteliste"
        />
      </div>
    </>
  );
}
