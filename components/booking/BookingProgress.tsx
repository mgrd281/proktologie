import { cn } from "@/lib/cn";
import { bookingSteps } from "@/content/booking";

/**
 * Minimaler Buchungs-Fortschritt:
 * Desktop horizontal „01 Terminart … 05 Bestätigung",
 * Mobil kompakt „2 / 5 · Datum".
 * Für Screenreader liefert ein stets vorhandener sr-only-Text den Stand;
 * beide visuellen Varianten sind rein dekorativ (aria-hidden).
 */
export function BookingProgress({ step }: { step: number }) {
  return (
    <div>
      <p className="sr-only">
        Schritt {step + 1} von {bookingSteps.length}: {bookingSteps[step].short}
      </p>

      {/* Mobil */}
      <p
        aria-hidden="true"
        className="text-xs font-medium tracking-wide text-ink/60 sm:hidden"
      >
        <span className="text-primary-deep tabular-nums">
          {step + 1} / {bookingSteps.length}
        </span>
        <span> · </span>
        {bookingSteps[step].short}
      </p>

      {/* Desktop */}
      <ol className="hidden items-center gap-4 sm:flex" aria-hidden="true">
        {bookingSteps.map((s, index) => (
          <li key={s.id} className="flex items-center gap-4">
            <span
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium tracking-wide transition-colors duration-300",
                index === step
                  ? "text-ink"
                  : index < step
                    ? "text-primary-deep"
                    : "text-ink/40",
              )}
            >
              <span className="tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              {s.short}
            </span>
            {index < bookingSteps.length - 1 && (
              <span
                className={cn(
                  "h-px w-5 transition-colors duration-300",
                  index < step ? "bg-primary/60" : "bg-ink/15",
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
