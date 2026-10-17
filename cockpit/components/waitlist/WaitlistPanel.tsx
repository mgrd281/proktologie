"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { nextFreeTimesAction } from "@/app/actions/appointments";
import { createWaitlistAction, offerWaitlistAction, setWaitlistStatusAction } from "@/app/actions/waitlist";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, WAITLIST_STATUS_LABEL, type TypeView, type WaitlistStatus, type WaitlistView } from "@/lib/booking/model";
import { addDays, addMonths, dateKey, fmtLongDate, fmtShortDate, timeKey } from "@/lib/time";
import { FreeTimes, type FreeTimesState } from "@/components/calendar/FreeTimes";
import { DemoBadge, EmptyState, Notice, PageTitle, TypeDot } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Dialog, Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

/**
 * Die Warteliste ersetzt den Zettelstapel am Empfang: Wird ein Platz frei,
 * bekommt die erste passende Person automatisch ein Angebot (reserviert für
 * N Stunden), danach die nächste. Hier sieht das Team den Stand und kann
 * gezielt anbieten, zurückziehen oder telefonische Wünsche eintragen.
 */
const tone: Record<WaitlistStatus, string> = {
  open: "bg-brand-soft text-brand",
  offered: "bg-info/12 text-info",
  booked: "bg-ok/12 text-ok",
  expired: "bg-warn/12 text-warn",
  withdrawn: "bg-surface-sunken text-text-muted",
};

function WaitlistPill({ status }: { status: WaitlistStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase", tone[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {WAITLIST_STATUS_LABEL[status]}
    </span>
  );
}

function windowLabel(w: WaitlistView): string {
  if (w.windowFrom && w.windowTo) return `${fmtShortDate(new Date(w.windowFrom))} – ${fmtShortDate(new Date(w.windowTo))}`;
  if (w.windowFrom) return `ab ${fmtShortDate(new Date(w.windowFrom))}`;
  if (w.windowTo) return `bis ${fmtShortDate(new Date(w.windowTo))}`;
  return "beliebig";
}

export function WaitlistPanel({
  open,
  closed,
  types,
  today,
  holdHours,
  bookingLive,
}: {
  open: WaitlistView[];
  closed: WaitlistView[];
  types: TypeView[];
  today: string;
  holdHours: number;
  bookingLive: boolean;
}) {
  const [selected, setSelected] = useState<WaitlistView | null>(null);
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const columns = [
    { key: "seit", header: "Seit", width: "90px", numeric: true, cell: (w: WaitlistView) => <span className="text-text-muted">{fmtShortDate(new Date(w.createdAt))}</span> },
    {
      key: "name",
      header: "Patient",
      cell: (w: WaitlistView) => (
        <span className="flex items-center gap-2 font-medium text-text">
          {w.pii.lastName}, {w.pii.firstName}
          {w.isDemo && <DemoBadge />}
        </span>
      ),
    },
    {
      key: "art",
      header: "Terminart",
      cell: (w: WaitlistView) => (
        <span className="flex items-center gap-1.5 text-text-muted">
          <TypeDot color={w.color} />
          {w.typeLabel}
        </span>
      ),
    },
    { key: "fenster", header: "Wunschfenster", hideBelow: "md" as const, cell: (w: WaitlistView) => <span className="tnum text-text-muted">{windowLabel(w)}</span> },
    {
      key: "kontakt",
      header: "Kontakt",
      hideBelow: "lg" as const,
      cell: (w: WaitlistView) => (
        <span className="flex items-center gap-2 text-text-faint">
          {w.pii.email ? <Icon name="mail" size={14} className="text-text-muted" /> : <span className="text-[11px]">keine E-Mail</span>}
          {w.pii.phone && <Icon name="phone" size={14} className="text-text-muted" />}
        </span>
      ),
    },
    { key: "quelle", header: "Quelle", hideBelow: "lg" as const, cell: (w: WaitlistView) => <span className="text-text-muted">{SOURCE_LABEL[w.source]}</span> },
    {
      key: "status",
      header: "Status",
      align: "right" as const,
      cell: (w: WaitlistView) => (
        <span className="inline-flex items-center gap-2">
          {w.status === "offered" && w.offerExpiresAt && <span className="tnum text-[11px] text-text-muted">bis {fmtShortDate(new Date(w.offerExpiresAt))} {timeKey(new Date(w.offerExpiresAt))}</span>}
          <WaitlistPill status={w.status} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        eyebrow="Warteliste"
        title={
          <>
            {open.length} {open.length === 1 ? "Person wartet" : "Personen warten"}
            <span className="text-brand">.</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>
            Neuer Eintrag
          </Button>
        }
      />

      {/* Der Stand in einer Zeile, die Erklärung zum Aufklappen – wer täglich hier arbeitet, kennt sie */}
      <div className="mb-6 rounded-2xl bg-surface-raised px-5 py-4 ring-1 ring-line">
        <p className="flex items-center gap-2 text-[14px] text-text">
          <span aria-hidden="true" className={cn("size-2 rounded-full", bookingLive ? "bg-brand-fill" : "bg-text-faint")} />
          Automatische Angebote: {bookingLive ? "aktiv" : "aus – sie laufen nur im Live-Betrieb der Website-Buchung"}
        </p>
        <details className="group mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-brand md:min-h-8">
            <Icon name="chevron-right" size={14} className="transition-transform group-open:rotate-90" />
            So läuft die Warteliste
          </summary>
          <div className="mt-2 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <p className="text-[13px] leading-relaxed text-text-muted">
              Wird ein Termin abgesagt oder verschoben, bekommt die älteste passende Person (Terminart, Wunschfenster, E-Mail vorhanden) den Platz sofort per E-Mail angeboten – <span className="tnum font-medium text-text">{holdHours} Stunden</span> reserviert, ein Klick genügt zur Annahme. Läuft die Frist ab, wird der Platz frei und die nächste Person angeschrieben. Reservierte Plätze stehen als Termin im Kalender und sind mit „Angebot“ markiert.
            </p>
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-text-muted">
              <li>„Platz anbieten“ funktioniert immer, auch ohne Live-Betrieb.</li>
              <li>Ohne E-Mail-Adresse bleibt ein Eintrag sichtbar, wird aber nicht automatisch angeschrieben – dann am Telefon: „Termin direkt anlegen“.</li>
            </ul>
          </div>
        </details>
      </div>

      <DataTable<WaitlistView>
        caption="Offene Wartelisten-Einträge"
        rows={open}
        rowKey={(w) => w.id}
        onOpen={setSelected}
        columns={columns}
        empty={<EmptyState icon="hourglass" title="Niemand wartet" text="Neue Einträge entstehen über die Website oder mit „Neuer Eintrag“ am Empfang." compact />}
      />

      <div className="mt-8">
        <button type="button" onClick={() => setShowClosed((v) => !v)} className="flex items-center gap-2 text-[13px] font-medium text-text-muted hover:text-text">
          <Icon name={showClosed ? "chevron-down" : "chevron-right"} size={14} />
          Abgeschlossene Einträge ({closed.length})
        </button>
        {showClosed && (
          <div className="mt-3">
            <DataTable<WaitlistView> caption="Abgeschlossene Wartelisten-Einträge" rows={closed} rowKey={(w) => w.id} onOpen={setSelected} columns={columns} dense empty={<p className="py-4 text-center text-[13px] text-text-muted">Noch nichts abgeschlossen.</p>} />
          </div>
        )}
      </div>

      {/* Je Eintrag frisch: Ein Neuladen der Liste setzt ein angefangenes Angebot nicht zurück */}
      {selected && <EntryDrawer key={selected.id} entry={selected} today={today} onClose={() => setSelected(null)} />}
      {creating && <CreateDrawer types={types} today={today} onClose={() => setCreating(false)} />}
    </>
  );
}

// ---------- Detail & Angebot ----------

function EntryDrawer({ entry: e, today, onClose }: { entry: WaitlistView; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [offering, setOffering] = useState(false);
  // Angebote ab morgen – oder ab Beginn des Wunschfensters, wenn das später liegt
  const tomorrow = addDays(today, 1);
  const wishFrom = e.windowFrom ? dateKey(new Date(e.windowFrom)) : null;
  const firstDay = wishFrom && wishFrom > tomorrow ? wishFrom : tomorrow;
  const [from, setFrom] = useState(firstDay);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [freeReload, setFreeReload] = useState(0);
  const [free, setFree] = useState<{ key: string; state: FreeTimesState } | null>(null);
  const autoPick = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  // Dieselbe Leiste wie beim Telefontermin: die nächsten freien Zeiten ab `from`
  const freeKey = `${from}|${freeReload}`;
  useEffect(() => {
    if (!offering) return;
    let alive = true;
    void nextFreeTimesAction({ typeId: e.typeId, from }).then(
      (r) => {
        if (!alive) return;
        setFree({ key: freeKey, state: r.ok ? { status: "ok", days: r.data } : { status: "error" } });
        const first = r.ok ? r.data[0] : undefined;
        if (autoPick.current && first) {
          setDate(first.date);
          setTime(first.times[0]!);
        }
      },
      () => alive && setFree({ key: freeKey, state: { status: "error" } }),
    );
    return () => {
      alive = false;
    };
  }, [offering, e.typeId, from, freeKey]);
  const freeState: FreeTimesState = free?.key === freeKey ? free.state : { status: "loading" };

  const setStatus = (status: "open" | "withdrawn") =>
    start(async () => {
      const r = await setWaitlistStatusAction({ id: e.id, status });
      if (!r.ok) return setError(r.error);
      toast({ title: status === "withdrawn" ? "Eintrag zurückgezogen" : "Eintrag wieder geöffnet", tone: "ok" });
      router.refresh();
      onClose();
    });

  const offer = () =>
    start(async () => {
      setError(null);
      if (!date || !time) return setError("Bitte einen freien Platz wählen.");
      const r = await offerWaitlistAction({ id: e.id, date, time });
      if (!r.ok) return setError(r.error);
      toast({ title: `Angebot verschickt · ${r.data.ref}`, description: `${fmtLongDate(new Date(`${date}T12:00:00Z`))}, ${time} Uhr – reserviert.`, tone: "ok" });
      router.refresh();
      onClose();
    });

  const offeredDate = e.offerExpiresAt ? new Date(e.offerExpiresAt) : null;
  const book = () => router.push(`/termine?neu=1&warteliste=${encodeURIComponent(e.id)}`);

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${e.ref ?? "Warteliste"} · ${SOURCE_LABEL[e.source]} · seit ${fmtShortDate(new Date(e.createdAt))}`}
      title={
        <span className="flex items-center gap-2">
          {e.pii.lastName}, {e.pii.firstName}
          {e.isDemo && <DemoBadge />}
        </span>
      }
      footer={
        <>
          {e.status === "open" && (
            <Button variant="danger" size="sm" onClick={() => setConfirmWithdraw(true)} disabled={pending}>
              Zurückziehen
            </Button>
          )}
          {(e.status === "withdrawn" || e.status === "expired") && (
            <Button variant="ghost" size="sm" onClick={() => setStatus("open")} disabled={pending}>
              Wieder öffnen
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Schließen
          </Button>
          {/* Am Telefon gleich buchen – für Einträge ohne E-Mail der einzige Weg */}
          {e.status === "open" && !offering && (
            <Button variant={e.pii.email ? "secondary" : "primary"} icon="calendar" onClick={book}>
              Termin direkt anlegen
            </Button>
          )}
          {e.status === "open" && !offering && e.pii.email && (
            <Button variant="primary" icon="mail" onClick={() => setOffering(true)}>
              Platz anbieten
            </Button>
          )}
          {e.status === "open" && offering && (
            <Button variant="primary" icon="check" onClick={offer} loading={pending}>
              Angebot senden
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <WaitlistPill status={e.status} />
          <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <TypeDot color={e.color} />
            {e.typeLabel}
          </span>
        </div>

        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-text-muted">Wunschfenster</dt>
          <dd className="tnum text-text">{windowLabel(e)}</dd>
          <dt className="text-text-muted">E-Mail</dt>
          <dd className="text-text">{e.pii.email ?? <span className="text-text">keine – kein Angebot per E-Mail möglich</span>}</dd>
          <dt className="text-text-muted">Telefon</dt>
          <dd className="tnum text-text">
            {e.pii.phone ? (
              <a href={`tel:${e.pii.phone.replace(/[^\d+]/g, "")}`} className="text-brand underline-offset-4 hover:underline">
                {e.pii.phone}
              </a>
            ) : (
              "—"
            )}
          </dd>
          {e.note && (
            <>
              <dt className="text-text-muted">Notiz</dt>
              <dd className="text-text">{e.note}</dd>
            </>
          )}
        </dl>

        {e.status === "offered" && offeredDate && (
          <Notice tone="info">
            Angebot verschickt – reserviert bis {fmtShortDate(offeredDate)}, {timeKey(offeredDate)} Uhr. Ohne Antwort wird der Platz danach automatisch frei und die nächste Person angeschrieben.
            {e.offeredAppointmentId && (
              <>
                {" "}
                <Link href={`/termine?id=${e.offeredAppointmentId}`} className="font-medium text-brand underline underline-offset-2">
                  Reservierten Termin öffnen
                </Link>
              </>
            )}
          </Notice>
        )}
        {e.status === "booked" && e.offeredAppointmentId && (
          <Notice tone="ok">
            Gebucht.{" "}
            <Link href={`/termine?id=${e.offeredAppointmentId}`} className="font-medium text-brand underline underline-offset-2">
              Termin öffnen
            </Link>
          </Notice>
        )}

        {offering && (
          <div className="space-y-3 rounded-2xl bg-surface-sunken/60 p-4 ring-1 ring-line">
            <p className="text-[13px] font-medium text-text">Welchen Platz anbieten?</p>
            <FreeTimes
              state={freeState}
              today={today}
              from={from}
              onFrom={(d) => setFrom(d)}
              selected={{ date, time }}
              onPick={(d, t) => {
                autoPick.current = false;
                setDate(d);
                setTime(t);
              }}
              onRetry={() => setFreeReload((n) => n + 1)}
              typeLabel={e.typeLabel}
              starts={[
                ["ab morgen", tomorrow],
                ...(wishFrom && wishFrom > tomorrow ? ([["ab Wunschfenster", wishFrom]] as Array<[string, string]>) : []),
                ["in 3 Monaten", addMonths(today, 3)],
              ]}
            />
            {date && time && (
              <p className="text-[13px] text-text">
                Angebot: {fmtLongDate(new Date(`${date}T12:00:00Z`))}, {time} Uhr
              </p>
            )}
            <p className="text-[12px] text-text-muted">Die Person bekommt eine E-Mail mit Annahme-Link; der Platz ist so lange reserviert, wie in den Einstellungen festgelegt.</p>
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
      <Dialog
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title="Wartelisten-Eintrag zurückziehen?"
        confirmLabel="Zurückziehen"
        danger
        busy={pending}
        onConfirm={() => {
          setConfirmWithdraw(false);
          setStatus("withdrawn");
        }}
      >
        {e.pii.lastName}, {e.pii.firstName} bekommt danach keine Angebote mehr für frei werdende Termine.
      </Dialog>
    </Drawer>
  );
}

// ---------- Neuer Eintrag (Telefon / vor Ort) ----------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CreateDrawer({ types, today, onClose }: { types: TypeView[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [windowFrom, setWindowFrom] = useState("");
  const [windowTo, setWindowTo] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({});
  const refs = useRef<{ firstName?: HTMLInputElement | null; lastName?: HTMLInputElement | null; email?: HTMLInputElement | null }>({});

  const save = () => {
    // Pflichtfelder vorab: Fehler am Feld, Fokus aufs erste
    const errors: typeof fieldErrors = {};
    if (!firstName.trim()) errors.firstName = "Vorname fehlt";
    if (!lastName.trim()) errors.lastName = "Nachname fehlt";
    if (email.trim() && !EMAIL.test(email.trim())) errors.email = "E-Mail ungültig";
    setFieldErrors(errors);
    const first = (["firstName", "lastName", "email"] as const).find((f) => errors[f]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    start(async () => {
      setError(null);
      const r = await createWaitlistAction({ typeId, firstName, lastName, email, phone, windowFrom, windowTo, note, source: "telefon" });
      if (!r.ok) return setError(r.error);
      toast({ title: `Auf die Warteliste gesetzt${r.data.ref ? ` · ${r.data.ref}` : ""}`, description: email ? "Eine Bestätigung geht per E-Mail raus." : undefined, tone: "ok" });
      router.refresh();
      onClose();
    });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Warteliste"
      title="Neuer Eintrag"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon="plus" type="submit" form="waitlist-form" loading={pending}>
            Eintragen
          </Button>
        </>
      }
    >
      <form
        id="waitlist-form"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
        className="space-y-5"
      >
        <Field label="Terminart">
          {(id) => (
            <Select id={id} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vorname" required error={fieldErrors.firstName}>
            {(id, describedBy) => (
              <Input
                id={id}
                ref={(el) => {
                  refs.current.firstName = el;
                }}
                autoComplete="off"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-autofocus
                aria-required
                aria-describedby={describedBy}
                invalid={Boolean(fieldErrors.firstName)}
              />
            )}
          </Field>
          <Field label="Nachname" required error={fieldErrors.lastName}>
            {(id, describedBy) => (
              <Input
                id={id}
                ref={(el) => {
                  refs.current.lastName = el;
                }}
                autoComplete="off"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-required
                aria-describedby={describedBy}
                invalid={Boolean(fieldErrors.lastName)}
              />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-Mail" hint="Nötig für automatische Angebote" error={fieldErrors.email}>
            {(id, describedBy) => (
              <Input
                id={id}
                ref={(el) => {
                  refs.current.email = el;
                }}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={describedBy}
                invalid={Boolean(fieldErrors.email)}
              />
            )}
          </Field>
          <Field label="Telefon">{(id) => <Input id={id} type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frühestens" hint="leer = beliebig">
            {(id) => <Input id={id} type="date" min={today} value={windowFrom} onChange={(e) => setWindowFrom(e.target.value)} className="tnum" />}
          </Field>
          <Field label="Spätestens" hint="leer = beliebig">
            {(id) => <Input id={id} type="date" min={windowFrom || today} value={windowTo} onChange={(e) => setWindowTo(e.target.value)} className="tnum" />}
          </Field>
        </div>
        <Field label="Notiz (intern)" hint="Verschlüsselt gespeichert">
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Drawer>
  );
}
