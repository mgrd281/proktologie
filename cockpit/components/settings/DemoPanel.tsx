"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { purgeDemoAction, seedDemoAction, updateSettingsAction } from "@/app/actions/settings";
import type { MessageLogRow } from "@/lib/booking/repo";
import { Card, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

interface S {
  slotStepMin: number;
  bookingLive: boolean;
  bookingPaused: boolean;
  bannerText: string | null;
  waitlistHoldHours: number;
  maxFuturePerEmail: number;
  reminderOffsetsH: number[];
}

const KIND_LABEL: Record<string, string> = {
  confirmation: "Bestätigung",
  cancellation: "Absage",
  waitlist_offer: "Wartelisten-Angebot",
  waitlist_joined: "Warteliste: Eintrag",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? (k.startsWith("reminder:") ? `Erinnerung ${k.slice(9)}` : k.startsWith("rescheduled") ? "Verschiebung" : k);

export function DemoPanel({
  canEdit,
  demoCount,
  settings,
  channel,
  messages,
  pendingJobs,
  cronConfigured,
}: {
  canEdit: boolean;
  demoCount: number;
  settings: S;
  channel: { label: string; live: boolean };
  messages: MessageLogRow[];
  pendingJobs: number;
  cronConfigured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [s, setS] = useState(settings);
  const [offsets, setOffsets] = useState(settings.reminderOffsetsH.join(", "));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings) || offsets !== settings.reminderOffsetsH.join(", ");

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
      const parsedOffsets = offsets
        .split(/[,\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 24 * 14);
      const r = await updateSettingsAction({
        slotStepMin: s.slotStepMin as 5 | 10 | 15 | 20 | 30,
        bookingPaused: s.bookingPaused,
        bannerText: s.bannerText,
        bookingLive: s.bookingLive !== settings.bookingLive ? s.bookingLive : undefined,
        waitlistHoldHours: s.waitlistHoldHours,
        maxFuturePerEmail: s.maxFuturePerEmail,
        reminderOffsetsH: parsedOffsets,
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
        <Eyebrow>Online-Buchung</Eyebrow>
        <div className="mt-3 space-y-4">
          <div className="border-b border-line pb-4">
            <Switch
              checked={s.bookingLive}
              onChange={(v) => setS({ ...s, bookingLive: v })}
              label="Website-Buchung live"
              description={
                demoCount > 0
                  ? `Gesperrt: ${demoCount} Demo-Datensätze vorhanden.`
                  : "Die Website zeigt echte freie Zeiten, bucht verbindlich und verschickt Bestätigung, Erinnerungen und Wartelisten-Angebote."
              }
              disabled={!canEdit || demoCount > 0}
            />
          </div>
          <Switch checked={s.bookingPaused} onChange={(v) => setS({ ...s, bookingPaused: v })} label="Online-Buchung pausieren" description="Für Urlaub oder Ausnahmesituationen. Die Website zeigt den Hinweistext, Erinnerungen laufen weiter." disabled={!canEdit} />
          <Field label="Hinweistext für die Website">{(id) => <Textarea id={id} value={s.bannerText ?? ""} disabled={!canEdit} onChange={(e) => setS({ ...s, bannerText: e.target.value || null })} placeholder="z. B. Vom 12. bis 23. August ist die Praxis geschlossen." />}</Field>
          <Field label="Raster der Terminvergabe" hint="Abstand der wählbaren Startzeiten.">
            {(id) => (
              <Select id={id} value={s.slotStepMin} disabled={!canEdit} onChange={(e) => setS({ ...s, slotStepMin: Number(e.target.value) })}>
                {[5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>{m} Minuten</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Erinnerungen (Stunden vorher)" hint="z. B. 48, 24">
              {(id) => <Input id={id} value={offsets} disabled={!canEdit} onChange={(e) => setOffsets(e.target.value)} className="tnum" />}
            </Field>
            <Field label="Wartelisten-Reservierung" hint="Stunden bis das Angebot verfällt">
              {(id) => <Input id={id} type="number" min={1} max={72} value={s.waitlistHoldHours} disabled={!canEdit} onChange={(e) => setS({ ...s, waitlistHoldHours: Number(e.target.value) })} className="tnum" />}
            </Field>
          </div>
          <Field label="Offene Termine je E-Mail-Adresse" hint="Obergrenze für Website-Buchungen (Missbrauchsschutz)">
            {(id) => <Input id={id} type="number" min={1} max={10} value={s.maxFuturePerEmail} disabled={!canEdit} onChange={(e) => setS({ ...s, maxFuturePerEmail: Number(e.target.value) })} className="tnum" />}
          </Field>
          {!settings.bookingLive && <Notice tone="info">Solange die Buchung nicht live ist, zeigt die Website Wunschtermine zur Anfrage. Die Website muss zusätzlich mit NEXT_PUBLIC_BOOKING_PROVIDER=cockpit gebaut sein (siehe README).</Notice>}
          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setS(settings); setOffsets(settings.reminderOffsetsH.join(", ")); }} disabled={!dirty}>Zurücksetzen</Button>
              <Button variant="primary" onClick={save} loading={pending} disabled={!dirty} icon="check">Speichern</Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>Versand &amp; Automatik</Eyebrow>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              Bestätigungen, Absagen, Erinnerungen und Wartelisten-Angebote gehen über die Job-Warteschlange. Der Herzschlag kommt alle 15 Minuten von außen (GitHub Actions → Tick) und zusätzlich aus jedem Seitenaufruf im Cockpit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${channel.live ? "bg-ok/12 text-ok" : "bg-warn/12 text-warn"}`}>E-Mail: {channel.label}</span>
            <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${cronConfigured ? "bg-ok/12 text-ok" : "bg-surface-sunken text-text-muted"}`}>Tick von außen: {cronConfigured ? "eingerichtet" : "nicht eingerichtet"}</span>
            <span className="tnum rounded-full bg-surface-sunken px-3 py-1 text-[12px] font-medium text-text-muted">{pendingJobs} in der Warteschlange</span>
          </div>
        </div>
        {!channel.live && (
          <div className="mt-4">
            <Notice tone="warn">
              Protokoll-Modus: Es verlässt keine E-Mail das System – jede Nachricht wird nur protokolliert. Für echten Versand in Vercel EMAIL_API_KEY (Brevo, EU-Anbieter mit AVV) sowie EMAIL_FROM setzen; SPF/DKIM/DMARC für die Absenderdomain nicht vergessen.
            </Notice>
          </div>
        )}
        <div className="mt-5 overflow-x-auto rounded-2xl ring-1 ring-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Letzte Nachrichten</caption>
            <thead className="bg-surface-sunken/80">
              <tr>
                {["Zeit", "Art", "Kanal", "Status", "Fehler"].map((h) => (
                  <th key={h} scope="col" className="h-9 px-4 text-left text-[11px] font-semibold tracking-[0.14em] text-text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface-raised">
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-muted">Noch keine Nachrichten verschickt.</td>
                </tr>
              )}
              {messages.map((m) => (
                <tr key={m.id} className="h-10">
                  <td className="tnum px-4 text-text-muted">{new Date(m.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 text-text">{kindLabel(m.kind)}</td>
                  <td className="px-4 text-text-muted">{m.channel === "email" ? "E-Mail" : "SMS"}</td>
                  <td className="px-4">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${m.status === "sent" ? "bg-ok/12 text-ok" : m.status === "failed" || m.status === "bounced" ? "bg-danger/10 text-danger" : "bg-surface-sunken text-text-muted"}`}>
                      {m.status === "sent" ? "gesendet" : m.status === "failed" ? "fehlgeschlagen" : m.status === "bounced" ? "unzustellbar" : "wartet"}
                    </span>
                  </td>
                  <td className="max-w-[320px] truncate px-4 text-text-faint" title={m.error ?? undefined}>{m.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={confirmPurge} onClose={() => setConfirmPurge(false)} title="Alle Demo-Daten löschen?" confirmLabel="Endgültig löschen" danger busy={pending} onConfirm={purge}>
        {demoCount} Datensätze werden entfernt. Echte Termine, Einstellungen und das Audit-Log bleiben unberührt. Diese Aktion verlangt eine frische Anmeldung.
      </Dialog>
    </div>
  );
}
