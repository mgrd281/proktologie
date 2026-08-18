/**
 * Zentrale Praxis-Stammdaten – Single Source of Truth.
 * Alle Angaben von der Bestandsseite proktologie-eimsbuettel.de
 * übernommen und geprüft. Diese Datei speist Header, Footer,
 * Praxis-Sektion, Kontakt und JSON-LD.
 */

// Echte Praxis-Telefonnummer (von der Bestandsseite übernommen und geprüft).
const phone = "040 490 80 21";

/** Anzeige-Zeilen der Sprechzeiten (UI). */
export interface OpeningHoursDisplay {
  days: string;
  time: string;
}

/** Maschinenlesbare Zeitfenster (schema.org openingHoursSpecification). */
export interface OpeningHoursSpec {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/**
 * Doctolib-Profil der Praxis. Buildzeit-Konstante (statischer Export):
 * per NEXT_PUBLIC_DOCTOLIB_BOOKING_URL überschreibbar.
 */
const DOCTOLIB_PROFILE_URL =
  process.env.NEXT_PUBLIC_DOCTOLIB_BOOKING_URL ||
  "https://www.doctolib.de/allgemeiner-chirurg/hamburg/kai-kunstreich-hamburg";

export const site = {
  name: "Proktologie Eimsbüttel",
  doctor: "Dr. med. Kai Kunstreich",
  claim: "Moderne Proktologie, diskret, vertrauensvoll und patientenorientiert.",
  city: "Hamburg",
  district: "Eimsbüttel",

  /**
   * Alle Kontakt-Stammdaten sind echt (Bestandsseite). Das Flag steuert
   * die früheren „Musterangabe"-Hinweise und die JSON-LD-Aussparungen –
   * bleibt auf false, solange die Daten aktuell sind.
   */
  isPlaceholderData: false as boolean,

  // [PLATZHALTER] Finale Domain der neuen Website – vor Launch bestätigen.
  url: "https://www.proktologie-eimsbuettel.de",

  address: {
    // Echte Praxisadresse (Bestandsseite /kontakt/)
    street: "Schäferkampsallee 56",
    zip: "20357",
    city: "Hamburg",
    district: "Eimsbüttel",
  },

  phone,
  // E.164-Format für den klickbaren Link (entspricht der Anzeige-Nummer)
  phoneHref: "tel:+49404908021",
  fax: "040 40 93 83",

  // Echte Praxis-E-Mail (Bestandsseite /kontakt/)
  email: "info@proktologie-eimsbuettel.de",

  /**
   * Offizielle Doctolib-Buchungsseite der Praxis (verifiziertes Profil:
   * Dr. med. Kai Kunstreich, Proktologie Eimsbüttel, Schäferkampsallee).
   * Online-Buchung ist dort aktiv – die CTAs dürfen daher verbindlich
   * formuliert sein. NEXT_PUBLIC_DOCTOLIB_BOOKING_URL überschreibt den
   * Wert; doctolibConfigured=false blendet sämtliche Doctolib-CTAs aus.
   *
   * ACHTUNG: Das ist ein Handoff-Link, KEINE Synchronisation. Verfügbar-
   * keiten der Website und Doctolibs sind getrennte Systeme (siehe README).
   */
  doctolibUrl: DOCTOLIB_PROFILE_URL,
  doctolibConfigured: DOCTOLIB_PROFILE_URL.length > 0,

  /**
   * Terminquelle der Booking-UI (Buildzeit-Konfiguration):
   * - "request" (Default): Wunschtermin auf Basis der echten Sprechzeiten,
   *   die Praxis bestätigt. Keine behauptete Live-Verfügbarkeit.
   * - "mock": NUR Entwicklung/Screenshots (simulierte Slots) – niemals
   *   für den produktiven Build verwenden.
   */
  bookingProvider:
    process.env.NEXT_PUBLIC_BOOKING_PROVIDER === "mock" ? "mock" : "request",

  /**
   * Echte Sprechzeiten – Stand laut Doctolib-Praxisprofil, von der Praxis
   * bestätigt. Einzige Quelle für Anzeige, JSON-LD UND die wählbaren
   * Wunschzeiten der Terminbuchung (lib/booking/requestProvider.ts).
   */
  hours: [
    { days: "Montag, Mittwoch, Freitag", time: "07:00 – 12:00 Uhr" },
    { days: "Dienstag, Donnerstag", time: "07:00 – 12:00 und 14:00 – 18:00 Uhr" },
    { days: "Samstag / Sonntag", time: "geschlossen" },
  ] as OpeningHoursDisplay[],

  hoursJsonLd: [
    {
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "07:00",
      closes: "12:00",
    },
    {
      dayOfWeek: ["Tuesday", "Thursday"],
      opens: "14:00",
      closes: "18:00",
    },
  ] as OpeningHoursSpec[],

  /** Lage: direkt an der U-Bahn-Haltestelle Christuskirche (U2). */
  transitNote: "Direkt an der U-Bahn-Haltestelle Christuskirche",

  /**
   * Externer Routen-Link (bewusst kein eingebettetes Karten-Widget:
   * ohne Embed werden keine Nutzerdaten an Kartendienste übertragen,
   * solange die Seite nur betrachtet wird).
   */
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Sch%C3%A4ferkampsallee+56%2C+20357+Hamburg",

  /**
   * Versand-Endpoint für Terminanfragen (und Rückrufbitten).
   *
   * null  -> die Buchung öffnet das E-Mail-Programm mit vorbefüllter
   *          Nachricht (mailto), es wird kein Server benötigt.
   * URL   -> die Buchung sendet per POST an diesen Endpoint
   *          (z. B. Formspree, Web3Forms oder ein eigenes Backend).
   *          WICHTIG: Bei Aktivierung die Datenschutzerklärung anpassen
   *          (Drittanbieter-Übermittlung, Abschnitt 2 und 4).
   */
  formEndpoint: null as string | null,
} as const;

export type Site = typeof site;
