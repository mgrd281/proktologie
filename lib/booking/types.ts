/**
 * Typen der Terminbuchung – von UI und Providern gemeinsam genutzt.
 * Die UI kennt KEINE Provider-Interna; Verfügbarkeit kommt ausschließlich
 * über das BookingProvider-Interface (lib/booking/provider.ts).
 */

/** Terminart – Labels liegen in content/booking.ts (eine Copy-Quelle). */
export interface AppointmentType {
  id: string;
  label: string;
  /** Kurzer, neutraler Zusatz (keine medizinischen Annahmen). */
  note?: string;
}

/**
 * Semantik der angebotenen Zeiten:
 * - "request":   Wunschtermin – Zeiten basieren auf den Sprechzeiten der
 *                Praxis, die Praxis bestätigt den Termin. Es wird KEINE
 *                Live-Verfügbarkeit behauptet.
 * - "confirmed": Echte, verbindlich buchbare Verfügbarkeit – aus dem
 *                Praxis-Cockpit (lib/booking/cockpitProvider.ts).
 * - "handoff":   Keine eigene Zeitwahl – Übergabe an die offizielle
 *                externe Buchungsstrecke (z. B. Doctolib-Seite).
 */
export type BookingProviderMode = "request" | "confirmed" | "handoff";

/** ISO-Datum (YYYY-MM-DD) – bewusst ohne Zeitzone/Uhrzeit. */
export type ISODate = string;

export interface BookingDay {
  date: ISODate;
  selectable: boolean;
}

export interface BookingSlot {
  id: string;
  /** Anzeigezeit, z. B. "08:30" */
  time: string;
  available: boolean;
}

/** Vom Nutzer im Flow gesammelte Daten (bleibt vollständig clientseitig). */
export interface BookingDraft {
  typeId: string | null;
  date: ISODate | null;
  slotId: string | null;
  time: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  /** Honigtopf – für Menschen unsichtbar, bleibt leer. */
  website?: string;
}

export type BookingResult =
  | { ok: true; method: "mailto" | "endpoint" }
  /** Verbindlich gebucht – Referenz für Rückfragen, Zeitpunkt in UTC (ISO). */
  | { ok: true; method: "confirmed"; ref: string; startsAt: string; endsAt: string }
  | { ok: false; error: string; code?: string };
