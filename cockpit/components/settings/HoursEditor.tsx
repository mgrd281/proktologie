"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteExceptionAction } from "@/app/actions/appointments";
import { replaceHoursAction } from "@/app/actions/settings";
import { KIND_LABEL, type ExceptionView, type HoursRow } from "@/lib/booking/model";
import { fmtShortDate, timeKey, WEEKDAYS_DE } from "@/lib/time";
import { Card, DemoBadge, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ExceptionDrawer } from "@/components/calendar/ExceptionDrawer";

export function HoursEditor({ hours, exceptions, canEdit, today }: { hours: HoursRow[]; exceptions: ExceptionView[]; canEdit: boolean; today: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<HoursRow[]>(hours);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(hours);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await replaceHoursAction(rows);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast({ title: "Sprechzeiten gespeichert", tone: "ok" });
      router.refresh();
    });

  const remove = (e: ExceptionView) =>
    start(async () => {
      const r = await deleteExceptionAction(e.id);
      if (!r.ok) {
        toast({ title: "Nicht gelöscht", description: r.error, tone: "danger" });
        return;
      }
      toast({ title: `${KIND_LABEL[e.kind]} entfernt`, tone: "ok" });
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Regelmäßige Sprechzeiten</Eyebrow>
            <p className="mt-1 text-[13px] text-text-muted">Mehrere Fenster pro Tag sind möglich (z. B. Vormittag und Nachmittag). Die Website übernimmt diese Zeiten in Phase 3.</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-line">
          {WEEKDAYS_DE.map((name, i) => {
            const wd = i + 1;
            const dayRows = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.weekday === wd);
            return (
              <li key={wd} className="grid grid-cols-[110px_1fr] items-start gap-3 py-3">
                <span className="pt-2 text-[14px] font-medium text-text">{name}</span>
                <div className="space-y-2">
                  {dayRows.length === 0 && <p className="pt-2 text-[13px] text-text-faint">geschlossen</p>}
                  {dayRows.map(({ r, idx }) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input type="time" step={900} value={r.opens} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, opens: e.target.value } : x)))} className="tnum !min-h-9 !w-28 !px-3" aria-label={`${name} öffnet`} />
                      <span className="text-text-faint">–</span>
                      <Input type="time" step={900} value={r.closes} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, closes: e.target.value } : x)))} className="tnum !min-h-9 !w-28 !px-3" aria-label={`${name} schließt`} />
                      {canEdit && <IconButton label="Fenster entfernen" icon="trash" size={32} onClick={() => setRows(rows.filter((_, j) => j !== idx))} />}
                    </div>
                  ))}
                  {canEdit && (
                    <button type="button" onClick={() => setRows([...rows, { weekday: wd, opens: dayRows.length ? "14:00" : "07:00", closes: dayRows.length ? "18:00" : "12:00" }])} className="text-[12px] font-medium text-brand hover:underline">
                      + Zeitfenster
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {error && <div className="mt-4"><Notice tone="danger">{error}</Notice></div>}
        {canEdit && (
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRows(hours)} disabled={!dirty}>Zurücksetzen</Button>
            <Button variant="primary" onClick={save} loading={pending} disabled={!dirty} icon="check">Speichern</Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Ausnahmen</Eyebrow>
            <p className="mt-1 text-[13px] text-text-muted">Urlaub, Blocker, Feiertage, extern belegte Zeiten – ab heute.</p>
          </div>
          <Button size="sm" variant="secondary" icon="plus" onClick={() => setDrawer(true)}>Eintragen</Button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {exceptions.length === 0 && <li className="py-6 text-center text-[13px] text-text-faint">Keine Ausnahmen eingetragen.</li>}
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-text">
                  {KIND_LABEL[e.kind]}
                  {e.label && <span className="font-normal text-text-muted">· {e.label}</span>}
                  {e.isDemo && <DemoBadge />}
                </p>
                <p className="tnum text-[12px] text-text-muted">
                  {e.allDay
                    ? `${fmtShortDate(new Date(e.startsAt))} – ${fmtShortDate(new Date(new Date(e.endsAt).getTime() - 1))}`
                    : `${fmtShortDate(new Date(e.startsAt))} ${timeKey(new Date(e.startsAt))} – ${timeKey(new Date(e.endsAt))}`}
                </p>
              </div>
              <IconButton label="Ausnahme löschen" icon="trash" size={32} onClick={() => remove(e)} disabled={pending} />
            </li>
          ))}
        </ul>
      </Card>
      <ExceptionDrawer open={drawer} date={today} onClose={() => setDrawer(false)} />
    </div>
  );
}
