/**
 * DoctolibBookingProvider – bewusst NICHT implementiert.
 *
 * Doctolib stellt keine öffentliche Verfügbarkeits-/Buchungs-API bereit.
 * Offizielle Wege zu einer echten Synchronisation („ein Kalender überall"):
 *
 * 1. Offizielle Buchungsseite (bereits nutzbar, kein API-Zugang nötig):
 *    Die Praxis stellt die URL ihres Doctolib-Profils bereit
 *    (https://www.doctolib.de/...); sie wird über
 *    NEXT_PUBLIC_DOCTOLIB_BOOKING_URL konfiguriert. Die Website übergibt
 *    Patientinnen und Patienten dorthin – Doctolib bleibt Source of Truth.
 *
 * 2. Echte Slot-Synchronisation (Voraussetzung für diese Klasse):
 *    – Zugang über das offizielle Doctolib-Partner-/Integrationsprogramm
 *      ODER eine vom Praxisverwaltungssystem (PVS) der Praxis unterstützte
 *      Doctolib-Anbindung. Beides beantragt die Praxis bei Doctolib
 *      (Doctolib Pro Account-Betreuung).
 *    – Erst wenn Zugangsdaten und eine dokumentierte offizielle
 *      Schnittstelle vorliegen, wird diese Klasse implementiert
 *      (mode: "confirmed") und in lib/booking/provider.ts registriert.
 *      Die UI schaltet dann automatisch auf verbindliche Buchung um –
 *      ohne Umbau der Oberfläche.
 *
 * Ausdrücklich AUSGESCHLOSSEN: Scraping der Doctolib-Seite, Nutzung
 * privater/undokumentierter Endpunkte, iframe-Hacks gegen Embedding-
 * Sperren oder eine zweite, angeblich „synchronisierte" Kalenderhaltung.
 */

import type { BookingProvider } from "@/lib/booking/provider";

export class DoctolibBookingProvider implements Partial<BookingProvider> {
  constructor() {
    throw new Error(
      "DoctolibBookingProvider ist nicht konfiguriert: Es liegt kein offizieller API-/Integrationszugang vor (siehe Kommentar in dieser Datei).",
    );
  }
}
