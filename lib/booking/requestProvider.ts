import { appointmentTypes, bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingProvider } from "@/lib/booking/provider";
import type {
  BookingDay,
  BookingDraft,
  BookingResult,
  BookingSlot,
  ISODate,
} from "@/lib/booking/types";

/**
 * Standard-Provider „Wunschtermin" (mode: "request").
 *
 * Ehrlichkeits-Prinzip: Es existiert (noch) keine offizielle Schnittstelle
 * zur Live-Verfügbarkeit der Praxis. Dieser Provider bietet deshalb KEINE
 * angeblich freien Slots an, sondern Wunschzeiten innerhalb der ECHTEN
 * Sprechzeiten (content/site.ts, hoursJsonLd) – die Praxis bestätigt den
 * Termin anschließend. Verbindliche Online-Buchung läuft über die
 * offizielle Doctolib-Seite (site.doctolibUrl).
 */

/** Vorlauf: Wunschtermine ab morgen (kurzfristiges bitte telefonisch). */
const MIN_LEAD_DAYS = 1;
/** Horizont: 8 Wochen im Voraus. */
const MAX_AHEAD_DAYS = 56;
/** Raster der Wunschzeiten in Minuten. */
const SLOT_MINUTES = 30;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date): ISODate =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** JS getDay() → schema.org-Wochentag (aus site.hoursJsonLd). */
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function windowsForDate(date: Date): { opens: string; closes: string }[] {
  const weekday = WEEKDAYS[date.getDay()];
  return site.hoursJsonLd
    .filter((w) => w.dayOfWeek.includes(weekday))
    .map(({ opens, closes }) => ({ opens, closes }));
}

function isSelectable(date: Date, today: Date): boolean {
  const min = new Date(today);
  min.setDate(min.getDate() + MIN_LEAD_DAYS);
  min.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + MAX_AHEAD_DAYS);
  if (date < min || date > max) return false;
  return windowsForDate(date).length > 0;
}

export class RequestBookingProvider implements BookingProvider {
  readonly mode = "request" as const;

  async getAppointmentTypes() {
    return appointmentTypes;
  }

  async getAvailableDates(month: string): Promise<BookingDay[]> {
    const [year, monthIndex] = month.split("-").map(Number);
    const today = new Date();
    const days: BookingDay[] = [];
    const cursor = new Date(year, monthIndex - 1, 1);
    while (cursor.getMonth() === monthIndex - 1) {
      days.push({ date: toISO(cursor), selectable: isSelectable(cursor, today) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  async getAvailableSlots(date: ISODate): Promise<BookingSlot[]> {
    const [y, m, d] = date.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    const slots: BookingSlot[] = [];
    for (const { opens, closes } of windowsForDate(day)) {
      const [oh, om] = opens.split(":").map(Number);
      const [ch, cm] = closes.split(":").map(Number);
      // Letzter Wunschtermin beginnt eine Rasterlänge vor Schließung
      for (
        let t = oh * 60 + om;
        t <= ch * 60 + cm - SLOT_MINUTES;
        t += SLOT_MINUTES
      ) {
        const time = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
        slots.push({ id: `${date}T${time}`, time, available: true });
      }
    }
    return slots;
  }

  async createBooking(draft: BookingDraft): Promise<BookingResult> {
    const type = appointmentTypes.find((t) => t.id === draft.typeId);
    const lines = [
      `Terminart: ${type?.label ?? "-"}`,
      `Wunschtermin: ${draft.date ?? "-"}, ${draft.time ?? "-"} Uhr`,
      `Name: ${draft.firstName} ${draft.lastName}`,
      `Telefon: ${draft.phone}`,
      `E-Mail: ${draft.email}`,
    ];

    if (site.formEndpoint) {
      try {
        const response = await fetch(site.formEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            kind: "terminanfrage",
            type: type?.label ?? null,
            date: draft.date,
            time: draft.time,
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            phone: draft.phone,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { ok: true, method: "endpoint" };
      } catch {
        return { ok: false, error: bookingCopy.errors.send };
      }
    }

    // mailto-Variante: funktioniert ohne Server, Daten bleiben in der E-Mail
    const subject = encodeURIComponent(bookingCopy.mailSubject);
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
    return { ok: true, method: "mailto" };
  }

  async cancelBooking(): Promise<BookingResult> {
    // Wunschtermine werden telefonisch/per E-Mail storniert
    return { ok: false, error: bookingCopy.errors.cancelUnsupported };
  }
}
