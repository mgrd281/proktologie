"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { availabilityAction } from "@/app/actions/appointments";
import { createWaitlistAction, offerWaitlistAction, setWaitlistStatusAction } from "@/app/actions/waitlist";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, WAITLIST_STATUS_LABEL, type TypeView, type WaitlistStatus, type WaitlistView } from "@/lib/booking/model";
import { addDays, dateKey, fmtLongDate, fmtShortDate, timeKey } from "@/lib/time";
import { Card, DemoBadge, EmptyState, Eyebrow, Notice, PageTitle, TypeDot } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
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

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <Eyebrow>So läuft es automatisch</Eyebrow>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            Wird ein Termin abgesagt oder verschoben, bekommt die älteste passende Person (Terminart, Wunschfenster, E-Mail vorhanden) den Platz sofort per E-Mail angeboten – <span className="tnum font-medium text-text">{holdHours} Stunden</span> reserviert, ein Klick genügt zur Annahme. Läuft die Frist ab, wird der Platz frei und die nächste Person angeschrieben. Reservierte Plätze stehen als Termin im Kalender und sind mit „Angebot“ markiert.
          </p>
        </Card>
        <Card>
          <Eyebrow>Hinweise</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-text-muted">
            <li>Automatische Angebote laufen nur im Live-Betrieb der Website-Buchung{bookingLive ? " – aktiv." : " – derzeit aus."}</li>
            <li>„Platz anbieten“ funktioniert immer, auch ohne Live-Betrieb.</li>
            <li>Ohne E-Mail-Adresse bleibt ein Eintrag sichtbar, wird aber nicht automatisch angeschrieben.</li>
          </ul>
        </Card>
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

      <EntryDrawer entry={selected} today={today} onClose={() => setSelected(null)} />
      <CreateDrawer open={creating} types={types} today={today} onClose={() => setCreating(false)} />
    </>
  );
}

// ---------- Detail & Angebot ----------

function EntryDrawer({ entry, today, onClose }: { entry: WaitlistView | null; today: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [offering, setOffering] = useState(false);
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState("");
  const [free, setFree] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOffering(false);
    setError(null);
    setTime("");
    setDate(addDays(today, 1));
  }, [entry, today]);

  useEffect(() => {
    if (!entry || !offering) return;
    let alive = true;
    setFree(null);
    availabilityAction(entry.typeId, date).then((r) => alive && setFree(r.ok ? r.data : []));
    return () => {
      alive = false;
    };
  }, [entry, offering, date]);

  if (!entry) return null;
  const e = entry;

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
      if (!time) return setError("Bitte eine Uhrzeit wählen.");
      const r = await offerWaitlistAction({ id: e.id, date, time });
      if (!r.ok) return setError(r.error);
      toast({ title: `Angebot verschickt · ${r.data.ref}`, description: `${fmtLongDate(new Date(`${date}T12:00:00Z`))}, ${time} Uhr – reserviert.`, tone: "ok" });
      router.refresh();
      onClose();
    });

  const offeredDate = e.offerExpiresAt ? new Date(e.offerExpiresAt) : null;

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
            <Button variant="danger" size="sm" onClick={() => setStatus("withdrawn")} disabled={pending}>
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
          {e.status === "open" && !offering && (
            <Button variant="primary" icon="mail" onClick={() => setOffering(true)} disabled={!e.pii.email}>
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
          <dd className="text-text">{e.pii.email ?? <span className="text-warn">keine – kein automatisches Angebot möglich</span>}</dd>
          <dt className="text-text-muted">Telefon</dt>
          <dd className="tnum text-text">{e.pii.phone ?? "—"}</dd>
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
                <Link href={`/termine?v=tag&d=${e.offeredAt ? dateKey(new Date(e.offeredAt)) : today}&id=${e.offeredAppointmentId}`} className="font-medium text-brand underline underline-offset-2">
                  Reservierten Termin öffnen
                </Link>
              </>
            )}
          </Notice>
        )}

        {offering && (
          <div className="space-y-3 rounded-2xl bg-surface-sunken/60 p-4 ring-1 ring-line">
            <p className="text-[13px] font-medium text-text">Welchen Platz anbieten?</p>
            <Field label="Datum">{(id) => <Input id={id} type="date" min={today} value={date} onChange={(ev) => setDate(ev.target.value)} className="tnum" />}</Field>
            <div>
              <p className="mb-1.5 text-[12px] text-text-muted">{free === null ? "Freie Zeiten werden geladen …" : free.length ? `Frei am ${fmtLongDate(new Date(`${date}T12:00:00Z`))}:` : "An diesem Tag ist für diese Terminart nichts frei."}</p>
              {free && free.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {free.slice(0, 24).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={cn(
                        "tnum h-8 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                        time === t ? "border-brand-fill bg-brand-fill text-deep" : "border-line text-text-muted hover:border-line-strong hover:text-text",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[12px] text-text-faint">Die Person bekommt eine E-Mail mit Annahme-Link; der Platz ist so lange reserviert, wie in den Einstellungen festgelegt.</p>
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  );
}

// ---------- Neuer Eintrag (Telefon / vor Ort) ----------

function CreateDrawer({ open, types, today, onClose }: { open: boolean; types: TypeView[]; today: string; onClose: () => void }) {
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

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTypeId(types[0]?.id ?? "");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setWindowFrom("");
    setWindowTo("");
    setNote("");
  }, [open, types]);

  if (!open) return null;

  const save = () =>
    start(async () => {
      setError(null);
      const r = await createWaitlistAction({ typeId, firstName, lastName, email, phone, windowFrom, windowTo, note, source: "telefon" });
      if (!r.ok) return setError(r.error);
      toast({ title: `Auf die Warteliste gesetzt${r.data.ref ? ` · ${r.data.ref}` : ""}`, description: email ? "Eine Bestätigung geht per E-Mail raus." : undefined, tone: "ok" });
      router.refresh();
      onClose();
    });

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
          <Button variant="primary" icon="plus" onClick={save} loading={pending}>
            Eintragen
          </Button>
        </>
      }
    >
      <div className="space-y-5">
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
          <Field label="Vorname">{(id) => <Input id={id} autoComplete="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-autofocus />}</Field>
          <Field label="Nachname">{(id) => <Input id={id} autoComplete="off" value={lastName} onChange={(e) => setLastName(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-Mail" hint="Nötig für automatische Angebote">
            {(id) => <Input id={id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
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
      </div>
    </Drawer>
  );
}
