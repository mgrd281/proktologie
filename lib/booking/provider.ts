import type {
  AppointmentType,
  BookingDay,
  BookingDraft,
  BookingProviderMode,
  BookingResult,
  BookingSlot,
  ISODate,
} from "@/lib/booking/types";
import { site } from "@/content/site";

/**
 * Abstraktion der Terminquelle. Die UI (components/booking/*) spricht
 * ausschließlich mit diesem Interface – Provider sind austauschbar,
 * ohne dass die Oberfläche umgebaut werden muss.
 */
export interface BookingProvider {
  /** Semantik der Zeiten – steuert Labels/CTAs der UI. */
  readonly mode: BookingProviderMode;
  getAppointmentTypes(): Promise<AppointmentType[]>;
  /** Alle Tage des angefragten Monats (YYYY-MM) mit Wählbarkeit. */
  getAvailableDates(month: string): Promise<BookingDay[]>;
  getAvailableSlots(date: ISODate): Promise<BookingSlot[]>;
  createBooking(draft: BookingDraft): Promise<BookingResult>;
  cancelBooking(bookingId: string): Promise<BookingResult>;
}

/**
 * Provider-Auswahl über Konfiguration (Buildzeit, statischer Export):
 * - Default:  RequestBookingProvider (Wunschtermin auf Sprechzeiten-Basis)
 * - "mock":   MockBookingProvider – NUR für Entwicklung/Screenshots,
 *             niemals Standard (simulierte Verfügbarkeit!)
 * - Eine echte Doctolib-/PVS-Integration registriert sich hier als
 *   weiterer Zweig, sobald offizielle Zugänge existieren
 *   (siehe lib/booking/doctolibProvider.ts).
 */
export async function createBookingProvider(): Promise<BookingProvider> {
  if (site.bookingProvider === "mock") {
    const { MockBookingProvider } = await import("@/lib/booking/mockProvider");
    return new MockBookingProvider();
  }
  const { RequestBookingProvider } = await import(
    "@/lib/booking/requestProvider"
  );
  return new RequestBookingProvider();
}
