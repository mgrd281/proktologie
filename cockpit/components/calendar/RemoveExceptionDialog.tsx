"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteExceptionAction } from "@/app/actions/appointments";
import { KIND_LABEL, type ExceptionView } from "@/lib/booking/model";
import { fmtShortDate, timeKey } from "@/lib/time";
import { Dialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

/**
 * Ausnahme entfernen – mit der Folge im Klartext. Ein Fehlklick auf den
 * Papierkorb neben „Urlaub“ öffnete sonst still diese Tage wieder für die
 * Online-Buchung.
 */
export function RemoveExceptionDialog({ exception, onClose }: { exception: ExceptionView | null; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const e = exception;

  const remove = () => {
    if (!e) return;
    start(async () => {
      const r = await deleteExceptionAction(e.id);
      onClose();
      if (!r.ok) {
        toast({ title: "Nicht gelöscht", description: r.error, tone: "danger" });
        return;
      }
      toast({ title: `${KIND_LABEL[e.kind]} entfernt`, tone: "ok" });
      router.refresh();
    });
  };

  const days = e && (e.allDay || e.kind === "urlaub" || e.kind === "closed");
  return (
    <Dialog
      open={Boolean(e)}
      onClose={onClose}
      title={e ? `${KIND_LABEL[e.kind]}${e.label ? ` · ${e.label}` : ""} entfernen?` : ""}
      confirmLabel="Entfernen"
      danger
      busy={pending}
      onConfirm={remove}
    >
      {e && (
        <>
          <span className="tnum">
            {e.allDay
              ? `${fmtShortDate(new Date(e.startsAt))} – ${fmtShortDate(new Date(new Date(e.endsAt).getTime() - 1))}`
              : `${fmtShortDate(new Date(e.startsAt))} ${timeKey(new Date(e.startsAt))} – ${timeKey(new Date(e.endsAt))}`}
          </span>
          . {days ? "Die Tage werden wieder online buchbar." : "Die Zeit wird wieder online buchbar."}
        </>
      )}
    </Dialog>
  );
}
