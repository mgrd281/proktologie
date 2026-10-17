import { Icon } from "@/components/ui/Icon";
import { bookingDialog } from "@/content/booking";
import { STEP_COUNT } from "@/lib/booking/useBookingFlow";

interface BookingDialogHeaderProps {
  titleId: string;
  title: string;
  /** 0-basiert; nach dem Abschluss gilt der Fortschritt als voll */
  step: number;
  done: boolean;
  onClose: () => void;
}

/**
 * Kopf des Termin-Dialogs: Kalender-Symbol, Name des Dialogs, „Schritt 2 von 5“,
 * Schließen und darunter ein schmaler Fortschrittsbalken.
 *
 * Die Schrittzahl ist hier nur fürs Auge (aria-hidden) – Screenreader hören
 * sie mit der Überschrift des Schritts, auf der beim Wechsel der Fokus landet.
 * Der Balken wächst über `transform` (scaleX); bei reduzierter Bewegung sofort.
 */
export function BookingDialogHeader({ titleId, title, step, done, onClose }: BookingDialogHeaderProps) {
  const progress = done ? 1 : (step + 1) / STEP_COUNT;
  return (
    <div className="shrink-0 border-b border-ink/8">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3.5 md:px-8 md:pt-6 md:pb-4">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-primary-deep"
        >
          <Icon name="calendar" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-lg leading-tight font-medium text-ink md:text-xl">
            {title}
          </h2>
          <p aria-hidden="true" className="mt-0.5 text-xs font-medium tracking-wide text-ink/70 tabular-nums">
            {done ? "\u00a0" : bookingDialog.stepOf(step + 1, STEP_COUNT)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={bookingDialog.close}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors duration-200 hover:border-primary/50 hover:text-ink active:bg-mist"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div aria-hidden="true" className="h-1 bg-ink/6">
        <div
          className="h-full origin-left bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
