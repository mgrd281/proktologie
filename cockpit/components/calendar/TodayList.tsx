"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStatusAction } from "@/app/actions/appointments";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL, type AppointmentStatus, type AppointmentView } from "@/lib/booking/model";
import { timeKey } from "@/lib/time";
import { DemoBadge, EmptyState, StatusPill, TypeDot } from "@/components/ui/Bits";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/**
 * Der Tagesplan am Empfang: Uhrzeit, Name, Terminart, Status – und die
 * zwei Tasten, die am Tag zählen: „Da“ und „Nicht erschienen“. Mit
 * Rückgängig statt Nachfrage.
 */
export function TodayList({ appointments, now }: { appointments: AppointmentView[]; now: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const nowMs = new Date(now).getTime();

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
            await setStatusAction({ id: a.id, status: previous });
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
        const start = new Date(a.startsAt);
        const past = new Date(a.endsAt).getTime() < nowMs;
        const current = start.getTime() <= nowMs && !past;
        const open = a.status === "booked" || a.status === "confirmed" || a.status === "reminded";
        return (
          <li key={a.id} className={cn("flex items-center gap-4 px-5 py-3 transition-colors", current && "bg-brand-soft/60")}>
            <div className="w-12 shrink-0">
              <p className="tnum text-[15px] font-medium text-text">{timeKey(start)}</p>
              <p className="tnum text-[11px] text-text-faint">{timeKey(new Date(a.endsAt))}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[14px] font-medium text-text">
                {a.pii.lastName}, {a.pii.firstName}
                {a.isDemo && <DemoBadge />}
              </p>
              <p className="flex items-center gap-1.5 truncate text-[12px] text-text-muted">
                <TypeDot color={a.color} />
                {a.typeLabel}
                <span className="text-text-faint">· {SOURCE_LABEL[a.source]}</span>
                {a.note && <Icon name="file-text" size={12} className="text-text-faint" />}
              </p>
            </div>
            <StatusPill status={a.status} className="hidden sm:inline-flex" />
            {open ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={pending && busyId === a.id}
                  onClick={() => setStatus(a, "completed", "wahrgenommen")}
                  title="Wahrgenommen"
                  aria-label={`${a.pii.firstName} ${a.pii.lastName} als wahrgenommen markieren`}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-ok transition-colors hover:border-ok hover:bg-ok/10"
                >
                  <Icon name="check" size={16} />
                </button>
                <button
                  type="button"
                  disabled={pending && busyId === a.id}
                  onClick={() => setStatus(a, "no_show", "nicht erschienen")}
                  title="Nicht erschienen"
                  aria-label={`${a.pii.firstName} ${a.pii.lastName} als nicht erschienen markieren`}
                  className="flex size-9 items-center justify-center rounded-full border border-line text-text-faint transition-colors hover:border-warn hover:text-warn"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : (
              <div className="w-[76px] shrink-0" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
