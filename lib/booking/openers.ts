import { ctaHref } from "@/content/navigation";

/**
 * Termin-Knöpfe öffnen den Termin-Dialog, statt zur Termin-Sektion zu springen.
 *
 * Die Knöpfe bleiben echte Links auf `/#kontakt`: Ohne JavaScript (oder mit
 * Strg-/Mittelklick) führen sie wie bisher zur Termin-Sektion mit Telefon.
 * Mit JavaScript fängt `BookingDialogProvider` den Klick in der Capture-Phase
 * ab – vor dem Anker-Handler im LenisProvider – und öffnet den Dialog: kein
 * Scrollen, keine Adressänderung.
 *
 * Bewusst NICHT markiert: Nav-Punkt „Kontakt“, „Einführung überspringen“ und
 * der Skip-Link „Zur Terminbuchung“ – sie führen weiter zum Abschnitt.
 */
export const OPEN_BOOKING_ATTR = "data-open-booking";

const openerAttrs = { [OPEN_BOOKING_ATTR]: "", "aria-haspopup": "dialog" } as const;

/** Attribute für einen Termin-Knopf; bei anderen Zielen nichts. */
export function opensBooking(href: string = ctaHref): Partial<typeof openerAttrs> {
  return href === ctaHref ? openerAttrs : {};
}
