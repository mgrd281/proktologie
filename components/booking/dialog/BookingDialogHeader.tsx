import { Icon } from "@/components/ui/Icon";
import { bookingDialog } from "@/content/booking";
import { STEP_COUNT } from "@/lib/booking/useBookingFlow";
import type { PointerEventHandler } from "react";

interface BookingDialogHeaderProps {
  titleId: string;
  title: string;
  /** 0-basiert; nach dem Abschluss gilt der Fortschritt als voll */
  step: number;
  done: boolean;
  onClose: () => void;
  /** Ziehen zum Schließen (nur Handy) – siehe useSheetDrag */
  dragHandlers?: {
    onPointerDown: PointerEventHandler<HTMLElement>;
    onPointerMove: PointerEventHandler<HTMLElement>;
    onPointerUp: PointerEventHandler<HTMLElement>;
    onPointerCancel: PointerEventHandler<HTMLElement>;
  };
}

/**
 * Kopf des Termin-Sheets: am Handy ein Griff zum Herunterziehen, darunter
 * „Termin buchen“ mit „Schritt 2 von 5“, ein runder Schließen-Knopf im
 * iOS-Stil (graue Scheibe, 44 px Tippfläche) und fünf Segmente für den
 * Fortschritt. Die große Überschrift ist die Frage des Schritts im Inhalt.
 *
 * Schrittzahl und Segmente sind nur fürs Auge (aria-hidden) – Screenreader
 * hören sie mit der Überschrift des Schritts, auf der beim Wechsel der Fokus
 * landet. Die Segmente füllen sich über `transform` (scaleX); bei reduzierter
 * Bewegung sofort. Eine Trennlinie erscheint erst, wenn der Inhalt darunter
 * gescrollt ist (`data-scrolled` am Sheet).
 */
export function BookingDialogHeader({ titleId, title, step, done, onClose, dragHandlers }: BookingDialogHeaderProps) {
  return (
    <div
      {...dragHandlers}
      className="shrink-0 touch-none border-b border-transparent transition-colors duration-200 select-none group-data-[scrolled]/sheet:border-ink/8 md:touch-auto md:select-auto"
    >
      <div aria-hidden="true" className="flex justify-center pt-2.5 pb-0.5 md:hidden">
        <span className="h-1.5 w-9 rounded-full bg-ink/20" />
      </div>
      <div className="flex items-center gap-3 px-5 pt-2 md:px-8 md:pt-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base leading-snug font-semibold text-ink">
            {title}
          </h2>
          <p aria-hidden="true" className="text-sm text-ink/70 tabular-nums">
            {done ? " " : bookingDialog.stepOf(step + 1, STEP_COUNT)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={bookingDialog.close}
          className="group/close -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-ink/75 focus-visible:rounded-full!"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-ink/6 transition-colors duration-200 group-hover/close:bg-ink/10 group-active/close:bg-ink/15">
            <Icon name="close" size={16} strokeWidth={2} />
          </span>
        </button>
      </div>
      <div aria-hidden="true" className="flex gap-1.5 px-5 pt-3 pb-4 md:px-8 md:pb-5">
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <span key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/8">
            <span
              className="block h-full origin-left bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${done || index <= step ? 1 : 0})` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
