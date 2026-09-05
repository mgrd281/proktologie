"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { availabilityAction, createAppointmentAction, setStatusAction, updateAppointmentAction } from "@/app/actions/appointments";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, STATUS_LABEL, type AppointmentStatus, type AppointmentView, type TypeView } from "@/lib/booking/model";
import { dateKey, fmtLongDate, timeKey } from "@/lib/time";
import { DemoBadge, Notice, StatusPill } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

export type DrawerState = { mode: "new"; date: string; time?: string } | { mode: "edit"; appointment: AppointmentView } | null;

export function AppointmentDrawer({ state, types, onClose }: { state: DrawerState; types: TypeView[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outsideHours, setOutsideHours] = useState(false);

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
      toast({ title: editing ? "Termin gespeichert" : `Termin angelegt · ${r.data.ref}`, tone: "ok" });
      router.refresh();
      onClose();
    });
  };

  const setStatus = (status: AppointmentStatus) => {
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
        tone: status === "cancelled" ? "warn" : "ok",
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
            <Button variant="danger" size="sm" onClick={() => setStatus("cancelled")} disabled={pending}>
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
          <Field label="Telefon" hint="Für Rückfragen und spätere Erinnerungen">
            {(id) => <Input id={id} type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Field label="E-Mail">{(id) => <Input id={id} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
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
    </Drawer>
  );
}
