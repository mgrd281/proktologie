"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRequestStatusAction } from "@/app/actions/requests";
import { cn } from "@/lib/cn";
// Aus model.ts, nicht aus requests.ts: Diese Datei läuft im Browser, und
// requests.ts zieht über getDb den Postgres-Treiber mit.
import {
  REQUEST_KIND_LABEL,
  REQUEST_STATUS_LABEL,
  type RequestStatus,
  type RequestView,
} from "@/lib/booking/model";
import { fmtShortDate, timeKey } from "@/lib/time";
import { Card, DemoBadge, EmptyState, Eyebrow, PageTitle } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

/**
 * Posteingang für alles, was kein Termin ist: Rückrufbitten aus dem Chat,
 * Folgerezepte, Überweisungen, Befundkopien. Die Frist zeigt, was drängt –
 * überschrittene Fristen stehen oben und rot. Gesundheitsangaben werden
 * nicht erfragt; was jemand von sich aus geschrieben hat, steht im Drawer.
 */
const tone: Record<RequestStatus, string> = {
  neu: "bg-brand-soft text-brand",
  in_arbeit: "bg-info/12 text-info",
  wartet: "bg-warn/12 text-warn",
  erledigt: "bg-surface-sunken text-text-muted",
};

function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase", tone[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

const SOURCE_LABEL: Record<string, string> = { chat: "Chat", web: "Website" };
const TIME_LABEL: Record<string, string> = { egal: "egal", vormittags: "vormittags", nachmittags: "nachmittags" };

function name(r: RequestView): string {
  return `${r.pii.firstName} ${r.pii.lastName}`.trim();
}

/** Frist: überschritten, heute fällig, oder Datum. */
function DueCell({ r, now }: { r: RequestView; now: number }) {
  if (r.status === "erledigt") return <span className="text-text-muted">—</span>;
  if (!r.slaDueAt) return <span className="text-text-muted">—</span>;
  const due = new Date(r.slaDueAt);
  const over = due.getTime() < now;
  return (
    <span className={cn("tnum", over ? "font-semibold text-danger" : "text-text-muted")}>
      {over ? "überfällig · " : ""}
      {fmtShortDate(due)}, {timeKey(due)}
    </span>
  );
}

export function RequestsPanel({ open, closed, now }: { open: RequestView[]; closed: RequestView[]; now: string }) {
  const [current, setCurrent] = useState<RequestView | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const nowMs = new Date(now).getTime();

  const setStatus = (id: string, status: RequestStatus) =>
    start(async () => {
      const r = await setRequestStatusAction({ id, status });
      if (!r.ok) {
        toast({ title: "Nicht gespeichert", description: r.error, tone: "danger" });
        return;
      }
      setCurrent(r.data.status === "erledigt" ? null : r.data);
      toast({ title: `Anfrage ${REQUEST_STATUS_LABEL[status].toLowerCase()}`, tone: "ok" });
      router.refresh();
    });

  const columns: Column<RequestView>[] = [
    { key: "eingang", header: "Eingang", cell: (r) => <span className="tnum text-text-muted">{fmtShortDate(new Date(r.createdAt))}</span> },
    {
      key: "art",
      header: "Art",
      cell: (r) => (
        <span className="font-medium">
          {REQUEST_KIND_LABEL[r.kind]}
          {r.isDemo && <DemoBadge />}
        </span>
      ),
    },
    { key: "name", header: "Name", cell: (r) => name(r) },
    { key: "telefon", header: "Telefon", cell: (r) => <span className="tnum">{r.pii.phone ?? "—"}</span> },
    { key: "frist", header: "Frist", cell: (r) => <DueCell r={r} now={nowMs} /> },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <PageTitle eyebrow="Posteingang" title="Anfragen" />
        <p className="-mt-3 max-w-2xl text-[13px] leading-relaxed text-text-muted">
          Rückrufe, Folgerezepte, Überweisungen und Befundkopien – mit Frist und Stand. Medizinische Fragen werden hier nicht beantwortet.
        </p>
      </div>

      <Card>
        <Eyebrow>Offen ({open.length})</Eyebrow>
        <div className="mt-3">
          <DataTable
            caption="Offene Anfragen"
            columns={columns}
            rows={open}
            rowKey={(r) => r.id}
            onOpen={setCurrent}
            empty={<EmptyState icon="inbox" title="Keine offenen Anfragen" text="Rückrufbitten aus dem Chat und der Website erscheinen hier." />}
          />
        </div>
      </Card>

      {closed.length > 0 && (
        <Card>
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="flex w-full items-center justify-between text-left">
            <Eyebrow>Erledigt ({closed.length})</Eyebrow>
            <Icon name={showClosed ? "arrow-down" : "arrow-right"} size={16} className="text-text-muted" />
          </button>
          {showClosed && (
            <div className="mt-3">
              <DataTable caption="Erledigte Anfragen" columns={columns} rows={closed} rowKey={(r) => r.id} onOpen={setCurrent} dense />
            </div>
          )}
        </Card>
      )}

      <Drawer
        open={Boolean(current)}
        onClose={() => setCurrent(null)}
        eyebrow={current ? `${current.ref} · ${SOURCE_LABEL[current.message?.source ?? ""] ?? "Cockpit"}` : undefined}
        title={current ? REQUEST_KIND_LABEL[current.kind] : ""}
        footer={
          current && (
            <div className="flex flex-wrap justify-end gap-2">
              {current.status !== "erledigt" ? (
                <>
                  {current.status !== "in_arbeit" && (
                    <Button variant="ghost" onClick={() => setStatus(current.id, "in_arbeit")} loading={pending}>
                      In Arbeit
                    </Button>
                  )}
                  {current.status !== "wartet" && (
                    <Button variant="ghost" onClick={() => setStatus(current.id, "wartet")} loading={pending}>
                      Wartet
                    </Button>
                  )}
                  <Button variant="primary" icon="check" onClick={() => setStatus(current.id, "erledigt")} loading={pending}>
                    Erledigt
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setStatus(current.id, "neu")} loading={pending}>
                  Wieder öffnen
                </Button>
              )}
            </div>
          )
        }
      >
        {current && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Name</dt>
              <dd className="mt-0.5">{name(current)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Telefon</dt>
              <dd className="mt-0.5 tnum">
                {current.pii.phone ? <a href={`tel:${current.pii.phone.replace(/\s/g, "")}`} className="text-brand underline-offset-4 hover:underline">{current.pii.phone}</a> : "—"}
              </dd>
            </div>
            {current.pii.email && (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">E-Mail</dt>
                <dd className="mt-0.5">{current.pii.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Erreichbar</dt>
              <dd className="mt-0.5">{TIME_LABEL[current.message?.preferredTime ?? "egal"] ?? "egal"}</dd>
            </div>
            {current.message?.locale === "en" && (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Sprache</dt>
                <dd className="mt-0.5">Englisch – bitte auf Englisch zurückrufen.</dd>
              </div>
            )}
            {current.message?.text && (
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Nachricht</dt>
                <dd className="mt-0.5 whitespace-pre-line">{current.message.text}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Frist</dt>
              <dd className="mt-0.5">
                <DueCell r={current} now={nowMs} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Stand</dt>
              <dd className="mt-0.5">
                <StatusPill status={current.status} />
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
