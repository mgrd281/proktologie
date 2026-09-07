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
import { bookingCopy } from "@/content/booking";
import { chooseProvider, fetchCockpitStatus } from "@/lib/booking/status";

/**
 * Abstraktion der Terminquelle. Die UI (components/booking/*) spricht
 * ausschließlich mit diesem Interface – Provider sind austauschbar,
 * ohne dass die Oberfläche umgebaut werden muss.
 */
export interface BookingProvider {
  /** Semantik der Zeiten – steuert Labels/CTAs der UI. */
  readonly mode: BookingProviderMode;
  /**
   * Hinweis der Praxis für die Terminkarte (pausierte Online-Buchung).
   * Kommt aus dem Cockpit-Status; ohne Anlass bleibt er leer.
   */
  readonly notice?: string;
  getAppointmentTypes(): Promise<AppointmentType[]>;
  /**
   * Alle Tage des angefragten Monats (YYYY-MM) mit Wählbarkeit. Echte
   * Verfügbarkeit gilt je Terminart – Provider ohne Live-Daten ignorieren typeId.
   */
  getAvailableDates(month: string, typeId?: string | null): Promise<BookingDay[]>;
  getAvailableSlots(date: ISODate, typeId?: string | null): Promise<BookingSlot[]>;
  createBooking(draft: BookingDraft): Promise<BookingResult>;
  cancelBooking(bookingId: string): Promise<BookingResult>;
}

/**
 * Provider-Auswahl über Konfiguration (Buildzeit, statischer Export):
 * - Default:   RequestBookingProvider (Wunschtermin auf Sprechzeiten-Basis)
 * - "cockpit": CockpitBookingProvider – echte freie Zeiten und verbindliche
 *              Buchung über die öffentliche API des Praxis-Cockpits
 *              (NEXT_PUBLIC_BOOKING_PROVIDER=cockpit + NEXT_PUBLIC_COCKPIT_API).
 *              Gilt nur, solange das Cockpit „Website-Buchung live“ meldet:
 *              Die Karte fragt den Zustand beim Laden einmal ab. Nicht live,
 *              pausiert oder keine Antwort → Wunschtermin wie ohne Cockpit
 *              (lib/booking/status.ts).
 * - "mock":    MockBookingProvider – NUR für Entwicklung/Screenshots,
 *              niemals Standard (simulierte Verfügbarkeit!)
 */
export async function createBookingProvider(): Promise<BookingProvider> {
  if (site.bookingProvider === "mock") {
    const { MockBookingProvider } = await import("@/lib/booking/mockProvider");
    return new MockBookingProvider();
  }
  if (site.bookingProvider === "cockpit") {
    // Erst der Zustand der Praxis – das Cockpit entscheidet, ob die Website
    // verbindlich bucht. Fällt die Antwort aus, verspricht die Karte nichts.
    const status = await fetchCockpitStatus(site.cockpitApiUrl);
    const choice = chooseProvider(status, bookingCopy.pausedNotice);
    if (choice.kind === "cockpit") {
      const { CockpitBookingProvider } = await import("@/lib/booking/cockpitProvider");
      return new CockpitBookingProvider();
    }
    const { RequestBookingProvider } = await import("@/lib/booking/requestProvider");
    return new RequestBookingProvider(choice.notice);
  }
  const { RequestBookingProvider } = await import(
    "@/lib/booking/requestProvider"
  );
  return new RequestBookingProvider();
}
