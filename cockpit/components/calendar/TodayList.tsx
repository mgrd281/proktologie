"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStatusAction } from "@/app/actions/appointments";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, type AppointmentStatus, type AppointmentView } from "@/lib/booking/model";
import { timeKey } from "@/lib/time";
import { DemoBadge, EmptyState, StatusPill, TypeDot } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useNow } from "@/components/ui/useNow";

/** „Wahrgenommen“ und „Nicht erschienen“ erst kurz vor Beginn – vorher wäre es ein Versehen. */
const MARK_FROM_MS = 15 * 60_000;
/** Zehn Minuten nach Beginn noch nicht als da markiert: überfällig. */
const OVERDUE_MS = 10 * 60_000;

/**
 * Der Tagesplan am Empfang: Uhrzeit, Name, Terminart, Status – und die
 * zwei Tasten, die am Tag zählen: „Wahrgenommen“ und „Nicht erschienen“,
 * mit Rückgängig statt Nachfrage. Die Uhr tickt mit („läuft“,
 * „überfällig“), ein Klick auf die Zeile öffnet den Termin.
 */
export function TodayList({ appointments, now }: { appointments: AppointmentView[]; now: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const nowMs = useNow(now);

  const setStatus = (a: AppointmentView, status: AppointmentStatus, label: string) => {
    const previous = a.status;
    setBusyId(a.id);
    start(async () => {
      const r = await setStatusAction({ id: a.id, status });
      setBusyId(null);
      if (!r.ok) {
        toast({ title: "Nicht gespeichert", description: r.error, tone: "danger" });
        return;
      }
      router.refresh();
      toast({
        title: `${a.pii.firstName} ${a.pii.lastName}: ${label}`,
        tone: status === "no_show" ? "warn" : "ok",
        action: {
          label: "Rückgängig",
          onClick: async () => {
            const undone = await setStatusAction({ id: a.id, status: previous });
            // Scheitert es, sagt die Meldung es – statt still den alten Stand zu zeigen
            if (!undone.ok) throw new Error(undone.error);
            router.refresh();
          },
        },
      });
    });
  };

  const active = appointments.filter((a) => a.status !== "cancelled");
  if (active.length === 0) {
    return <EmptyState icon="calendar" title="Heute ist der Kalender leer" text="Kein Termin steht an. Neue Termine entstehen über „Neuer Termin“ oder später über die Website." compact />;
  }

  return (
    <ol className="divide-y divide-line">
      {active.map((a) => {
        const startMs = new Date(a.startsAt).getTime();
        const endMs = new Date(a.endsAt).getTime();
        const open = a.status === "booked" || a.status === "confirmed" || a.status === "reminded";
        const running = open && startMs <= nowMs && nowMs < endMs;
        const overdue = open && nowMs > startMs + OVERDUE_MS;
        const canMark = open && nowMs >= startMs - MARK_FROM_MS;
        // Statuswort, nicht nur Farbe – am Handy unter dem Namen, sonst rechts
        const state = overdue ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/12 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-text uppercase">
            <Icon name="clock" size={12} className="text-warn" />
            überfällig
          </span>
        ) : running ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-text uppercase">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-fill" />
            läuft
          </span>
        ) : (
          <StatusPill status={a.status} />
        );
        return (
          <li key={a.id} className={cn("flex items-center gap-3 px-5 py-3 transition-colors md:gap-4", running && "bg-brand-soft/60")}>
            <Link href={`/termine?id=${encodeURIComponent(a.id)}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
              <div className="w-12 shrink-0">
                <p className="tnum text-[15px] font-medium text-text">{timeKey(new Date(startMs))}</p>
                <p className="tnum text-[11px] text-text-muted">{timeKey(new Date(endMs))}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[14px] font-medium text-text">
                  {a.pii.lastName}, {a.pii.firstName}
                  {a.isDemo && <DemoBadge />}
                </p>
                <p className="flex items-center gap-1.5 truncate text-[12px] text-text-muted">
                  <TypeDot color={a.color} />
                  {a.typeLabel}
                  <span>· {SOURCE_LABEL[a.source]}</span>
                  {a.note && <Icon name="file-text" size={12} className="text-text-muted" />}
                </p>
                <div className="mt-1 sm:hidden">{state}</div>
              </div>
            </Link>
            <div className="hidden shrink-0 sm:block">{state}</div>
            {canMark ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={pending && busyId === a.id}
                  onClick={() => setStatus(a, "completed", "wahrgenommen")}
                  title="Wahrgenommen"
                  aria-label={`${a.pii.firstName} ${a.pii.lastName} als wahrgenommen markieren`}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-ok transition-colors hover:border-ok hover:bg-ok/10 max-md:size-11"
                >
                  <Icon name="check" size={16} />
                </button>
                <button
                  type="button"
                  disabled={pending && busyId === a.id}
                  onClick={() => setStatus(a, "no_show", "nicht erschienen")}
                  title="Nicht erschienen"
                  aria-label={`${a.pii.firstName} ${a.pii.lastName} als nicht erschienen markieren`}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-text-muted transition-colors hover:border-warn hover:text-warn max-md:size-11"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : (
              <div className="w-[76px] shrink-0 max-md:hidden" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
