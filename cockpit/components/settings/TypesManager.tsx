"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveTypeAction } from "@/app/actions/settings";
import type { TypeColor, TypeView } from "@/lib/booking/model";
import { Card, Notice, TypeDot } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select, Switch } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

const COLORS: Array<{ value: TypeColor; label: string }> = [
  { value: "green", label: "Klinikgrün" },
  { value: "moss", label: "Moos" },
  { value: "blue", label: "Blau" },
  { value: "amber", label: "Bernstein" },
  { value: "slate", label: "Grau" },
];

const blank = (): Omit<TypeView, "id"> & { id?: string } => ({
  label: "",
  note: null,
  durationMin: 20,
  bufferMin: 0,
  visibility: "public",
  leadTimeHours: 24,
  maxAheadDays: 56,
  color: "green",
  sortOrder: 100,
  active: true,
});

export function TypesManager({ types, canEdit }: { types: TypeView[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<(Omit<TypeView, "id"> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [edit]);

  const save = () => {
    if (!edit) return;
    start(async () => {
      const r = await saveTypeAction(edit);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast({ title: `„${r.data.label}“ gespeichert`, tone: "ok" });
      setEdit(null);
      router.refresh();
    });
  };

  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-xl text-[13px] leading-relaxed text-text-muted">
          Dauer, Puffer, Vorlauf und Horizont je Terminart bestimmen die Verfügbarkeit – im Cockpit und später auf der Website. Die Werte sind Praxisentscheidungen; die Startwerte sind bewusst neutral gewählt.
        </p>
        {canEdit && (
          <Button variant="primary" size="sm" icon="plus" onClick={() => setEdit(blank())}>
            Neue Terminart
          </Button>
        )}
      </div>
      <DataTable<TypeView>
        caption="Terminarten"
        rows={types}
        rowKey={(t) => t.id}
        onOpen={canEdit ? (t) => setEdit({ ...t }) : undefined}
        columns={[
          {
            key: "label",
            header: "Terminart",
            cell: (t) => (
              <span className="flex items-center gap-2 font-medium text-text">
                <TypeDot color={t.color} />
                {t.label}
                {!t.active && <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-text-faint uppercase">inaktiv</span>}
              </span>
            ),
          },
          { key: "dauer", header: "Dauer", numeric: true, align: "right", cell: (t) => `${t.durationMin} min` },
          { key: "puffer", header: "Puffer", numeric: true, align: "right", hideBelow: "md", cell: (t) => `${t.bufferMin} min` },
          { key: "vorlauf", header: "Vorlauf", numeric: true, align: "right", hideBelow: "md", cell: (t) => `${t.leadTimeHours} h` },
          { key: "horizont", header: "Horizont", numeric: true, align: "right", hideBelow: "lg", cell: (t) => `${t.maxAheadDays} Tage` },
          { key: "sicht", header: "Sichtbar", hideBelow: "md", cell: (t) => <span className="text-text-muted">{t.visibility === "public" ? "Website + Cockpit" : "nur Cockpit"}</span> },
        ]}
      />

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        eyebrow={edit?.id ? `Terminart · ${edit.id}` : "Neue Terminart"}
        title={edit?.label || "Terminart"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button variant="primary" onClick={save} loading={pending} icon="check">Speichern</Button>
          </>
        }
      >
        {edit && (
          <div className="space-y-5">
            <Field label="Bezeichnung">{(id) => <Input id={id} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} data-autofocus />}</Field>
            <Field label="Hinweis (optional)" hint="Erscheint als Untertitel in der Auswahl">
              {(id) => <Input id={id} value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value || null })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dauer (Minuten)">{(id) => <Input id={id} type="number" min={5} max={240} step={5} value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: num(e.target.value, 20) })} className="tnum" />}</Field>
              <Field label="Puffer danach (Minuten)">{(id) => <Input id={id} type="number" min={0} max={120} step={5} value={edit.bufferMin} onChange={(e) => setEdit({ ...edit, bufferMin: num(e.target.value, 0) })} className="tnum" />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorlauf (Stunden)" hint="So früh vor Beginn ist spätestens buchbar">{(id) => <Input id={id} type="number" min={0} max={720} value={edit.leadTimeHours} onChange={(e) => setEdit({ ...edit, leadTimeHours: num(e.target.value, 24) })} className="tnum" />}</Field>
              <Field label="Horizont (Tage)" hint="So weit im Voraus ist buchbar">{(id) => <Input id={id} type="number" min={1} max={365} value={edit.maxAheadDays} onChange={(e) => setEdit({ ...edit, maxAheadDays: num(e.target.value, 56) })} className="tnum" />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Farbe">
                {(id) => (
                  <Select id={id} value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value as TypeColor })}>
                    {COLORS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Reihenfolge">{(id) => <Input id={id} type="number" min={0} value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: num(e.target.value, 100) })} className="tnum" />}</Field>
            </div>
            <Switch checked={edit.visibility === "public"} onChange={(v) => setEdit({ ...edit, visibility: v ? "public" : "intern" })} label="Auf der Website buchbar" description="Interne Terminarten sieht nur das Team." />
            <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Aktiv" description="Inaktive Terminarten bleiben in alten Terminen sichtbar, sind aber nicht mehr wählbar." />
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        )}
      </Drawer>
    </>
  );
}

export { Card as _Card };
