"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createExceptionAction } from "@/app/actions/appointments";
import { KIND_LABEL, type ExceptionKind } from "@/lib/booking/model";
import { Notice } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

const HELP: Record<ExceptionKind, string> = {
  blocker: "Ein Zeitfenster ist belegt – Fortbildung, Besprechung, OP-Tag. Termine sind darin nicht buchbar.",
  urlaub: "Ganze Tage geschlossen. Später steuert das auch den Urlaubsmodus der Website.",
  closed: "Geschlossen (Feiertag, Praxisschließung).",
  extern: "Zeiten, die außerhalb des Cockpits vergeben wurden – z. B. über Doctolib. Damit vermeiden Sie Doppelbuchungen.",
};

export function ExceptionDrawer({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<ExceptionKind>("blocker");
  const [fromDate, setFromDate] = useState(date);
  const [toDate, setToDate] = useState(date);
  const [fromTime, setFromTime] = useState("12:00");
  const [toTime, setToTime] = useState("14:00");
  const [allDay, setAllDay] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFromDate(date);
      setToDate(date);
      setError(null);
    }
  }, [open, date]);
  useEffect(() => {
    if (kind === "urlaub" || kind === "closed") setAllDay(true);
  }, [kind]);

  const save = () =>
    start(async () => {
      const r = await createExceptionAction({ kind, fromDate, toDate, fromTime, toTime, allDay, label });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast({ title: `${KIND_LABEL[kind]} eingetragen`, tone: "ok" });
      router.refresh();
      onClose();
    });

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Kalender" title="Blocker oder Urlaub eintragen" footer={
      <>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" onClick={save} loading={pending} icon="check">Eintragen</Button>
      </>
    }>
      <div className="space-y-5">
        <Field label="Art" hint={HELP[kind]}>
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as ExceptionKind)} data-autofocus>
              {(Object.keys(KIND_LABEL) as ExceptionKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von">{(id) => <Input id={id} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="tnum" />}</Field>
          <Field label="Bis">{(id) => <Input id={id} type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="tnum" />}</Field>
        </div>
        <Switch checked={allDay} onChange={setAllDay} label="Ganztägig" description="Ohne Uhrzeiten – der ganze Tag ist gesperrt." />
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ab">{(id) => <Input id={id} type="time" step={300} value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="tnum" />}</Field>
            <Field label="Bis">{(id) => <Input id={id} type="time" step={300} value={toTime} onChange={(e) => setToTime(e.target.value)} className="tnum" />}</Field>
          </div>
        )}
        <Field label="Bezeichnung (optional)">{(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Fortbildung" />}</Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  );
}
