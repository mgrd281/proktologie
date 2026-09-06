import { cn } from "@/lib/cn";
import { bookingCopy } from "@/content/booking";
import type { BookingProviderMode, BookingSlot } from "@/lib/booking/types";

interface StepSlotsProps {
  slots: BookingSlot[];
  selected: string | null;
  dateLabel: string;
  onSelect: (slot: BookingSlot) => void;
  /** „request“: Wunschzeiten, „confirmed“: echte freie Zeiten. */
  mode?: BookingProviderMode;
}

/**
 * Schritt 3: Uhrzeit. Gewählter Slot = Klinikgrün mit Deep-Text (7:1).
 * Schlichte Buttons (aria-pressed) statt listbox/option – die Auswahl
 * springt sofort weiter, ein Composite-Widget wäre für AT irreführend.
 * Nicht verfügbare Zeiten sind nicht interaktiv, bleiben aber für
 * Screenreader lesbar („nicht verfügbar").
 */
export function StepSlots({ slots, selected, dateLabel, onSelect, mode = "request" }: StepSlotsProps) {
  const confirmed = mode === "confirmed";
  if (slots.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink/70">
        {confirmed ? bookingCopy.noSlotsConfirmed : bookingCopy.noSlots}
      </p>
    );
  }
  const label = confirmed ? bookingCopy.slotsForConfirmed : bookingCopy.slotsFor;

  return (
    <div>
      <p className="text-sm text-ink/60">
        {label} <span className="font-medium text-ink">{dateLabel}</span>
      </p>
      <div
        role="group"
        aria-label={`${label} ${dateLabel}`}
        className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {slots.map((slot) => {
          const isSelected = selected === slot.id;
          if (!slot.available) {
            return (
              <span
                key={slot.id}
                className="flex min-h-11 items-center justify-center rounded-lg border border-ink/5 bg-mist/60 text-sm text-ink/30 tabular-nums line-through"
              >
                {slot.time}
                <span className="sr-only"> – {bookingCopy.slotUnavailable}</span>
              </span>
            );
          }
          return (
            <button
              key={slot.id}
              type="button"
              data-slot={slot.time}
              aria-pressed={isSelected}
              onClick={() => onSelect(slot)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors duration-200",
                isSelected
                  ? "border-accent bg-accent text-deep"
                  : "border-ink/10 bg-white text-ink hover:border-primary/50",
              )}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
