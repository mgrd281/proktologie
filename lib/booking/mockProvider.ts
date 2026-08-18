import { RequestBookingProvider } from "@/lib/booking/requestProvider";
import type { BookingSlot, ISODate } from "@/lib/booking/types";

/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ NUR FÜR ENTWICKLUNG UND SCREENSHOTS.                            │
 * │                                                                 │
 * │ Simuliert belegte Slots, um Kalender-/Slot-Zustände visuell zu  │
 * │ prüfen. Wird AUSSCHLIESSLICH aktiv, wenn der Build explizit mit │
 * │ NEXT_PUBLIC_BOOKING_PROVIDER=mock erzeugt wurde – niemals im    │
 * │ Standard-Build. Simulierte Verfügbarkeit darf Patientinnen und  │
 * │ Patienten nie als echt präsentiert werden.                      │
 * └─────────────────────────────────────────────────────────────────┘
 */
export class MockBookingProvider extends RequestBookingProvider {
  async getAvailableSlots(date: ISODate): Promise<BookingSlot[]> {
    const slots = await super.getAvailableSlots(date);
    // Deterministisch „belegte" Slots (kein Zufall – stabil für Screenshots)
    const seed = date
      .split("-")
      .reduce((sum, part) => sum + Number(part), 0);
    return slots.map((slot, index) => ({
      ...slot,
      available: (index + seed) % 3 !== 1,
    }));
  }
}
