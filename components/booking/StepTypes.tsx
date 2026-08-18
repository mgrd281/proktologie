import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import type { AppointmentType } from "@/lib/booking/types";

interface StepTypesProps {
  types: AppointmentType[];
  selected: string | null;
  onSelect: (id: string) => void;
}

/**
 * Schritt 1: Terminart – ruhige, klar wählbare Karten.
 * Bewusst schlichte Buttons (aria-pressed) statt radiogroup/radio:
 * die Auswahl springt sofort zum nächsten Schritt, ein Composite-Widget
 * mit Pfeiltasten-Navigation wäre hier ein falsches Versprechen an AT.
 */
export function StepTypes({ types, selected, onSelect }: StepTypesProps) {
  return (
    <div role="group" aria-label="Terminart" className="grid gap-2.5 sm:grid-cols-2">
      {types.map((type) => {
        const isSelected = selected === type.id;
        return (
          <button
            key={type.id}
            type="button"
            data-type={type.id}
            aria-pressed={isSelected}
            onClick={() => onSelect(type.id)}
            className={cn(
              "flex min-h-13 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-ink/10 bg-white hover:border-ink/25",
            )}
          >
            <span>
              <span className="block text-sm font-medium text-ink">
                {type.label}
              </span>
              {type.note && (
                <span className="mt-0.5 block text-xs text-ink/55">
                  {type.note}
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-ink/20 text-transparent",
              )}
            >
              <Icon name="check" size={11} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
