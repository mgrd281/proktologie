import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import type { AppointmentType } from "@/lib/booking/types";

interface StepTypesProps {
  types: AppointmentType[];
  selected: string | null;
  onSelect: (id: string) => void;
}

/**
 * Schritt 1: Terminart – eine ruhige, rahmenlose Liste wie in den
 * Einstellungen eines Telefons. Rechts ein Kreis: leer (Rand 3:1) oder, wenn
 * gewählt, grün mit Häkchen – nicht nur Farbe. Weiter geht es mit „Weiter“ im
 * Fuß des Dialogs. Schlichte Buttons (aria-pressed) – jede Zeile ist ein
 * eigener Tab-Halt, ohne Pfeiltasten-Widget.
 */
export function StepTypes({ types, selected, onSelect }: StepTypesProps) {
  return (
    <div role="group" aria-label="Terminart" className="-mx-3 grid gap-0.5 md:grid-cols-2 md:gap-x-2">
      {types.map((type) => {
        const isSelected = selected === type.id;
        return (
          <button
            key={type.id}
            type="button"
            data-type={type.id}
            aria-pressed={isSelected}
            onClick={() => onSelect(type.id)}
            className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-mist/70 active:bg-mist focus-visible:rounded-2xl!"
          >
            <span className="min-w-0 flex-1">
              <span className={cn("block text-base text-ink", isSelected ? "font-semibold" : "font-medium")}>
                {type.label}
              </span>
              {type.note && <span className="mt-0.5 block text-sm text-ink/70">{type.note}</span>}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                isSelected ? "bg-accent text-deep" : "border-[1.5px] border-ink/50 text-transparent",
              )}
            >
              <Icon name="check" size={15} strokeWidth={2.4} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
