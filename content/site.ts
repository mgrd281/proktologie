/**
 * Zentrale Praxis-Stammdaten – Single Source of Truth.
 *
 * WICHTIG: Alle mit [PLATZHALTER] markierten Werte sind Musterangaben und
 * müssen vor Veröffentlichung durch die echten Praxisdaten ersetzt werden.
 * Diese Datei speist Header, Footer, Praxis-Sektion, Kontakt und JSON-LD.
 */

export const site = {
  name: "Proktologie Eimsbüttel",
  doctor: "Dr. Kai Kunstreich",
  wordmark: "Dr. Kai Kunstreich",
  wordmarkSub: "Proktologie",
  claim: "Moderne Proktologie, diskret, vertrauensvoll und patientenorientiert.",
  city: "Hamburg",
  district: "Eimsbüttel",

  // [PLATZHALTER] Domain – vor Launch durch die echte Domain ersetzen.
  url: "https://www.proktologie-eimsbuettel.de",

  address: {
    // [PLATZHALTER] Straße und Hausnummer der Praxis
    street: "Musterstraße 12",
    zip: "20255",
    city: "Hamburg",
    district: "Eimsbüttel",
  },

  // [PLATZHALTER] Telefonnummer der Praxis
  phone: "+49 40 000 000 00",
  phoneHref: "tel:+4940000000",

  // [PLATZHALTER] E-Mail-Adresse der Praxis
  email: "praxis@proktologie-eimsbuettel.de",

  /**
   * [PLATZHALTER] Sprechzeiten – vor Launch mit den echten Zeiten füllen.
   */
  hours: [
    { days: "Montag – Donnerstag", time: "08:00 – 17:00 Uhr" },
    { days: "Freitag", time: "08:00 – 13:00 Uhr" },
    { days: "Samstag / Sonntag", time: "geschlossen" },
  ],

  /**
   * Externer Routen-Link (bewusst kein eingebettetes Karten-Widget:
   * ohne Embed werden keine Nutzerdaten an Kartendienste übertragen,
   * solange die Seite nur betrachtet wird).
   */
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Proktologie+Eimsb%C3%BCttel+Hamburg",

  /**
   * Formular-Endpoint für das Kontaktformular.
   *
   * null  -> das Formular öffnet das E-Mail-Programm mit vorbefüllter
   *          Nachricht (mailto), es wird kein Server benötigt.
   * URL   -> das Formular sendet per POST an diesen Endpoint
   *          (z. B. Formspree, Web3Forms oder ein eigenes Backend).
   */
  formEndpoint: null as string | null,
} as const;

export type Site = typeof site;
