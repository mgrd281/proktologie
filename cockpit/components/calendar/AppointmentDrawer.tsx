"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { availabilityAction, createAppointmentAction, resendConfirmationAction, setStatusAction, updateAppointmentAction } from "@/app/actions/appointments";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, STATUS_LABEL, type AppointmentStatus, type AppointmentView, type TypeView } from "@/lib/booking/model";
import { dateKey, fmtLongDate, timeKey } from "@/lib/time";
import { DemoBadge, Notice, StatusPill } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Dialog, Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

export type DrawerState = { mode: "new"; date: string; time?: string } | { mode: "edit"; appointment: AppointmentView } | null;

export function AppointmentDrawer({ state, types, onClose }: { state: DrawerState; types: TypeView[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outsideHours, setOutsideHours] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const editing = state?.mode === "edit" ? state.appointment : null;
  const [typeId, setTypeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"cockpit" | "telefon">("telefon");
  const [free, setFree] = useState<string[] | null>(null);

  useEffect(() => {
    if (!state) return;
    setError(null);
    setOutsideHours(false);
    setConfirmCancel(false);
    if (state.mode === "new") {
      setTypeId(types[0]?.id ?? "");
      setDate(state.date);
      setTime(state.time ?? "");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setNote("");
      setSource("telefon");
    } else {
      const a = state.appointment;
      setTypeId(a.typeId);
      setDate(dateKey(new Date(a.startsAt)));
      setTime(timeKey(new Date(a.startsAt)));
      setFirstName(a.pii.firstName);
      setLastName(a.pii.lastName);
      setEmail(a.pii.email ?? "");
      setPhone(a.pii.phone ?? "");
      setNote(a.note ?? "");
    }
  }, [state, types]);

  // Freie Zeiten für die gewählte Terminart am Tag – als Vorschlagschips
  useEffect(() => {
    if (!state || !typeId || !date) return;
    let alive = true;
    setFree(null);
    availabilityAction(typeId, date).then((r) => alive && setFree(r.ok ? r.data : []));
    return () => {
      alive = false;
    };
  }, [state, typeId, date]);

  if (!state) return null;
  const type = types.find((t) => t.id === typeId);

  const save = () => {
    setError(null);
    start(async () => {
      const pii = { firstName, lastName, email, phone };
      const r = editing
        ? await updateAppointmentAction({ id: editing.id, typeId, date, time, pii, note })
        : await createAppointmentAction({ typeId, date, time, pii, note, source, ignoreOpeningHours: outsideHours });
      if (!r.ok) {
        if (/außerhalb der Sprechzeiten/.test(r.error) && !outsideHours) {
          setOutsideHours(true);
          setError("Der Termin liegt außerhalb der Sprechzeiten. Noch einmal speichern, um ihn trotzdem anzulegen.");
          return;
        }
        setError(r.error);
        return;
      }
      const moved = editing && new Date(editing.startsAt).getTime() !== new Date(r.data.startsAt).getTime();
      toast({
        title: editing ? "Termin gespeichert" : `Termin angelegt · ${r.data.ref}`,
        description: !editing && email ? "Bestätigung mit Kalenderdatei geht per E-Mail raus." : moved && email ? "Neue Kalenderdatei geht per E-Mail raus." : undefined,
        tone: "ok",
      });
      router.refresh();
      onClose();
    });
  };

  /** Reversible Zustände (wahrgenommen, nicht erschienen, bestätigt) – mit Rückgängig statt Nachfrage. */
  const setStatus = (status: Exclude<AppointmentStatus, "cancelled">) => {
    if (!editing) return;
    const previous = editing.status;
    start(async () => {
      const r = await setStatusAction({ id: editing.id, status });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
      toast({
        title: `${editing.pii.firstName} ${editing.pii.lastName}: ${STATUS_LABEL[status]}`,
        tone: "ok",
        action: {
          label: "Rückgängig",
          onClick: async () => {
            await setStatusAction({ id: editing.id, status: previous });
            router.refresh();
          },
        },
      });
    });
  };

  /** Absage löst Post an die Person und ein Wartelisten-Angebot aus – deshalb einmal nachfragen, kein Rückgängig. */
  const cancelNow = () => {
    if (!editing) return;
    start(async () => {
      const r = await setStatusAction({ id: editing.id, status: "cancelled" });
      setConfirmCancel(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
      toast({
        title: `${editing.pii.firstName} ${editing.pii.lastName}: abgesagt`,
        description: editing.pii.email ? "Absage per E-Mail unterwegs; der Platz wird der Warteliste angeboten." : "Der Platz wird der Warteliste angeboten.",
        tone: "warn",
      });
    });
  };

  const resend = () => {
    if (!editing) return;
    start(async () => {
      const r = await resendConfirmationAction(editing.id);
      if (!r.ok) return toast({ title: "Nicht verschickt", description: r.error, tone: "danger" });
      toast({ title: r.data.sent ? "Bestätigung verschickt" : "Nicht verschickt", description: r.data.detail, tone: r.data.sent ? "ok" : "warn" });
      router.refresh();
    });
  };

  const isOpen = editing ? ["booked", "confirmed", "reminded"].includes(editing.status) : false;

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={editing ? `${editing.ref} · ${SOURCE_LABEL[editing.source]} · angelegt ${new Date(editing.createdAt).toLocaleDateString("de-DE")}` : "Neuer Termin"}
      title={
        editing ? (
          <span className="flex items-center gap-2">
            {editing.pii.lastName}, {editing.pii.firstName}
            {editing.isDemo && <DemoBadge />}
          </span>
        ) : (
          "Termin anlegen"
        )
      }
      footer={
        <>
          {editing && isOpen && (
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)} disabled={pending}>
              Absagen
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={save} loading={pending} icon={editing ? "check" : "plus"}>
            {editing ? "Speichern" : "Anlegen"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {editing && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={editing.status} />
            {isOpen && (
              <>
                {editing.status !== "confirmed" && (
                  <Button size="sm" variant="secondary" icon="check" onClick={() => setStatus("confirmed")} disabled={pending}>
                    Bestätigt
                  </Button>
                )}
                <Button size="sm" variant="secondary" icon="check" onClick={() => setStatus("completed")} disabled={pending}>
                  Wahrgenommen
                </Button>
                <Button size="sm" variant="secondary" icon="close" onClick={() => setStatus("no_show")} disabled={pending}>
                  Nicht erschienen
                </Button>
              </>
            )}
            {!isOpen && editing.status !== "cancelled" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus("confirmed")} disabled={pending}>
                Wieder öffnen
              </Button>
            )}
          </div>
        )}

        {editing?.holdUntil && isOpen && (
          <Notice tone="info">
            Wartelisten-Angebot – reserviert bis {fmtLongDate(new Date(editing.holdUntil))}, {timeKey(new Date(editing.holdUntil))} Uhr. Nimmt die Person nicht an, wird der Platz automatisch frei und der nächsten Person angeboten.
          </Notice>
        )}

        {editing && (editing.confirmedByPatientAt || editing.remindedAt || (isOpen && editing.pii.email)) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-muted">
            {editing.confirmedByPatientAt && (
              <span className="flex items-center gap-1">
                <Icon name="check" size={12} className="text-ok" /> Von Patient:in bestätigt am {new Date(editing.confirmedByPatientAt).toLocaleDateString("de-DE")}
              </span>
            )}
            {editing.remindedAt && (
              <span className="flex items-center gap-1">
                <Icon name="bell" size={12} /> Erinnert am {new Date(editing.remindedAt).toLocaleDateString("de-DE")}
              </span>
            )}
            {isOpen && editing.pii.email && (
              <button type="button" onClick={resend} disabled={pending} className="flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50">
                <Icon name="mail" size={12} /> Bestätigung {editing.hasManageLink ? "erneut " : ""}senden
              </button>
            )}
          </div>
        )}

        <Field label="Terminart">
          {(id) => (
            <Select id={id} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.durationMin} min{t.bufferMin ? ` + ${t.bufferMin} Puffer` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tnum" />}</Field>
          <Field label="Uhrzeit">{(id) => <Input id={id} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="tnum" />}</Field>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] text-text-muted">
            {free === null ? "Freie Zeiten werden geladen …" : free.length ? `Frei am ${fmtLongDate(new Date(`${date}T12:00:00Z`))} für ${type?.label ?? "diese Terminart"}:` : "An diesem Tag ist für diese Terminart nichts frei – Sprechzeit, Blocker oder Vorlauf."}
          </p>
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
              {free.length > 24 && <span className="self-center text-[12px] text-text-faint">+{free.length - 24}</span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vorname">{(id) => <Input id={id} autoComplete="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} data-autofocus={!editing} />}</Field>
          <Field label="Nachname">{(id) => <Input id={id} autoComplete="off" value={lastName} onChange={(e) => setLastName(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" hint="Für Rückfragen">
            {(id) => <Input id={id} type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Field label="E-Mail" hint="Bestätigung, Erinnerungen und Verwaltungslink">
            {(id) => <Input id={id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        </div>
        {!editing && (
          <Field label="Quelle">
            {(id) => (
              <Select id={id} value={source} onChange={(e) => setSource(e.target.value as "cockpit" | "telefon")}>
                <option value="telefon">Telefon</option>
                <option value="cockpit">Vor Ort / Cockpit</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Interne Notiz" hint="Verschlüsselt gespeichert, nur für das Team sichtbar">
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>

        {error && <Notice tone={outsideHours && !error.startsWith("Der Zeitraum") ? "warn" : "danger"}>{error}</Notice>}
        {editing && (
          <p className="flex items-center gap-1.5 text-[12px] text-text-faint">
            <Icon name="lock" size={12} /> Persönliche Daten liegen verschlüsselt in der Datenbank; jede Änderung steht im Audit-Log.
          </p>
        )}
      </div>

      {editing && (
        <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Termin absagen?" confirmLabel="Absagen" danger busy={pending} onConfirm={cancelNow}>
          {editing.pii.lastName}, {editing.pii.firstName} · {fmtLongDate(new Date(editing.startsAt))}, {timeKey(new Date(editing.startsAt))} Uhr.{" "}
          {editing.pii.email ? "Die Person erhält eine Absage per E-Mail; " : "Es ist keine E-Mail-Adresse hinterlegt – bitte telefonisch informieren; "}
          der Platz wird der Warteliste angeboten.
        </Dialog>
      )}
    </Drawer>
  );
}
