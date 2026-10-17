import { notfall } from "@/content/notfall";
import { cn } from "@/lib/cn";

/**
 * „Außerhalb der Sprechzeiten: Ärztlicher Bereitschaftsdienst 116 117 ·
 * Notruf 112“ – beide Nummern zum Antippen. Steht immer da (auch ohne
 * JavaScript): Wer abends sucht, findet den Weg, ohne die Uhr zu prüfen.
 */
export function EmergencyLine({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const link = cn(
    "font-medium whitespace-nowrap underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:items-center",
    onDark ? "text-cream hover:text-accent" : "text-primary-deep hover:text-primary",
  );
  return (
    <p className={cn("text-sm leading-relaxed", onDark ? "text-cream/75" : "text-ink/75", className)}>
      {notfall.lead} {notfall.duty.label}{" "}
      <a href={notfall.duty.href} className={link}>
        {notfall.duty.number}
      </a>{" "}
      · {notfall.emergency.label}{" "}
      <a href={notfall.emergency.href} className={link}>
        {notfall.emergency.number}
      </a>
    </p>
  );
}
