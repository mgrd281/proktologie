"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { purgeDemoAction, seedDemoAction, updateSettingsAction } from "@/app/actions/settings";
import { Card, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Field, Select, Switch, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

interface S {
  slotStepMin: number;
  bookingLive: boolean;
  bookingPaused: boolean;
  bannerText: string | null;
}

export function DemoPanel({ canEdit, demoCount, settings }: { canEdit: boolean; demoCount: number; settings: S }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [s, setS] = useState(settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const seed = () =>
    start(async () => {
      const r = await seedDemoAction();
      toast(r.ok ? { title: `Demo-Daten angelegt: ${r.data.appointments} Termine`, tone: "ok" } : { title: "Nicht angelegt", description: r.error, tone: "danger" });
      router.refresh();
    });

  const purge = () =>
    start(async () => {
      const r = await purgeDemoAction();
      setConfirmPurge(false);
      if (!r.ok) {
        toast({ title: "Nicht gelöscht", description: r.error, tone: "danger" });
        if (/erneut anmelden/i.test(r.error)) router.push("/login?grund=frisch&weiter=/einstellungen/demo");
        return;
      }
      toast({ title: `${r.data.removed} Demo-Datensätze gelöscht`, tone: "ok" });
      router.refresh();
    });

  const save = () =>
    start(async () => {
      const r = await updateSettingsAction({
        slotStepMin: s.slotStepMin as 5 | 10 | 15 | 20 | 30,
        bookingPaused: s.bookingPaused,
        bannerText: s.bannerText,
        bookingLive: s.bookingLive !== settings.bookingLive ? s.bookingLive : undefined,
      });
      if (!r.ok) {
        toast({ title: "Nicht gespeichert", description: r.error, tone: "danger" });
        if (/erneut anmelden/i.test(r.error)) router.push("/login?grund=frisch&weiter=/einstellungen/demo");
        return;
      }
      toast({ title: "Einstellungen gespeichert", tone: "ok" });
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <Eyebrow>Vorführdaten</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          Fiktive Mustertermine, -anfragen und -ausnahmen zum Kennenlernen des Cockpits. Sie sind durchgehend als Demo markiert und lassen sich hier jederzeit vollständig entfernen. Solange sie existieren, bleibt die Website-Buchung gesperrt.
        </p>
        <p className="font-display tnum mt-5 text-[36px] leading-none font-medium text-text">
          {demoCount}
          <span className="ml-2 font-sans text-[14px] font-medium text-text-muted">Demo-Datensätze</span>
        </p>
        {canEdit && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" icon="sparkle" onClick={seed} loading={pending} disabled={settings.bookingLive}>Demo-Daten anlegen</Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirmPurge(true)} disabled={demoCount === 0 || pending}>Alle Demo-Daten löschen</Button>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Betrieb</Eyebrow>
        <div className="mt-3 space-y-4">
          <Field label="Raster der Terminvergabe" hint="Abstand der wählbaren Startzeiten.">
            {(id) => (
              <Select id={id} value={s.slotStepMin} disabled={!canEdit} onChange={(e) => setS({ ...s, slotStepMin: Number(e.target.value) })}>
                {[5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>{m} Minuten</option>
                ))}
              </Select>
            )}
          </Field>
          <Switch checked={s.bookingPaused} onChange={(v) => setS({ ...s, bookingPaused: v })} label="Online-Buchung pausieren" description="Für Urlaub oder Ausnahmesituationen. Die Website zeigt den Hinweistext (ab Phase 3)." disabled={!canEdit} />
          <Field label="Hinweistext für die Website">{(id) => <Textarea id={id} value={s.bannerText ?? ""} disabled={!canEdit} onChange={(e) => setS({ ...s, bannerText: e.target.value || null })} placeholder="z. B. Vom 12. bis 23. August ist die Praxis geschlossen." />}</Field>
          <div className="border-t border-line pt-4">
            <Switch
              checked={s.bookingLive}
              onChange={(v) => setS({ ...s, bookingLive: v })}
              label="Website-Buchung live (Phase 1)"
              description={demoCount > 0 ? `Gesperrt: ${demoCount} Demo-Datensätze vorhanden.` : "Schaltet die verbindliche Online-Buchung frei, sobald Phase 1 ausgeliefert ist."}
              disabled={!canEdit || demoCount > 0}
            />
          </div>
          {!settings.bookingLive && <Notice tone="info">Die öffentliche Buchungs-API kommt in Phase 1. Dieser Schalter ist vorbereitet, hat aber noch keine Wirkung nach außen.</Notice>}
          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setS(settings)} disabled={!dirty}>Zurücksetzen</Button>
              <Button variant="primary" onClick={save} loading={pending} disabled={!dirty} icon="check">Speichern</Button>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={confirmPurge} onClose={() => setConfirmPurge(false)} title="Alle Demo-Daten löschen?" confirmLabel="Endgültig löschen" danger busy={pending} onConfirm={purge}>
        {demoCount} Datensätze werden entfernt. Echte Termine, Einstellungen und das Audit-Log bleiben unberührt. Diese Aktion verlangt eine frische Anmeldung.
      </Dialog>
    </div>
  );
}
