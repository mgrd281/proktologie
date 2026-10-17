import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
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
 * Schritt 3: Uhrzeit als ruhige Pillen ohne Rahmen. Gewählter Slot =
 * Klinikgrün mit Deep-Text (7:1) und Häkchen – nicht nur Farbe. Schlichte
 * Buttons (aria-pressed) statt listbox/option; weiter geht es mit „Weiter“ im
 * Fuß des Dialogs.
 * Nicht verfügbare Zeiten sind nicht interaktiv, bleiben aber für
 * Screenreader lesbar („nicht verfügbar").
 *
 * Gibt es vor- und nachmittags Zeiten, stehen sie unter „Vormittag“ und
 * „Nachmittag“ – wer nur nachmittags kann, muss nicht durch den Morgen lesen.
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
  const morning = slots.filter((slot) => slot.time < "12:00");
  const afternoon = slots.filter((slot) => slot.time >= "12:00");
  const groups =
    morning.length > 0 && afternoon.length > 0
      ? [
          { id: "morning", title: bookingCopy.slotGroups.morning, slots: morning },
          { id: "afternoon", title: bookingCopy.slotGroups.afternoon, slots: afternoon },
        ]
      : [{ id: "all", title: null, slots }];

  const renderSlot = (slot: BookingSlot) => {
    const isSelected = selected === slot.id;
    if (!slot.available) {
      return (
        <span
          key={slot.id}
          className="flex min-h-11 items-center justify-center rounded-full text-sm text-ink/35 tabular-nums line-through"
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
          "flex min-h-11 items-center justify-center gap-1 rounded-full text-sm tabular-nums transition-colors duration-200 focus-visible:rounded-full!",
          isSelected
            ? "bg-accent font-semibold text-deep"
            : "bg-mist font-medium text-ink hover:bg-primary/15 active:bg-primary/20",
        )}
      >
        {isSelected && <Icon name="check" size={14} strokeWidth={2.4} />}
        {slot.time}
      </button>
    );
  };

  return (
    <div>
      <p className="text-sm text-ink/70">
        {label} <span className="font-medium text-ink">{dateLabel}</span>
      </p>
      <div role="group" aria-label={`${label} ${dateLabel}`} className="mt-4 space-y-5">
        {groups.map((group) =>
          group.title ? (
            <div key={group.id} role="group" aria-labelledby={`slots-${group.id}`}>
              <p id={`slots-${group.id}`} className="mb-2.5 text-sm font-medium text-ink/70">
                {group.title}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{group.slots.map(renderSlot)}</div>
            </div>
          ) : (
            <div key={group.id} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.slots.map(renderSlot)}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
