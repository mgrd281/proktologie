/**
 * Zentrale Praxis-Stammdaten – Single Source of Truth.
 *
 * WICHTIG: Alle mit [PLATZHALTER] markierten Werte sind Musterangaben und
 * müssen vor Veröffentlichung durch die echten Praxisdaten ersetzt werden.
 * Diese Datei speist Header, Footer, Praxis-Sektion, Kontakt und JSON-LD.
 */

// [PLATZHALTER] Telefonnummer der Praxis (Anzeigeformat).
// Der klickbare tel:-Link wird unten automatisch daraus abgeleitet –
// nur diese eine Konstante pflegen.
const phone = "+49 40 000 000 00";

/** Sprechzeiten: `opens`/`closes` speisen das JSON-LD, `days`/`time` die UI. */
export interface OpeningHours {
  days: string;
  time: string;
  /** schema.org-Wochentage; leer = geschlossen */
  dayOfWeek: string[];
  opens?: string;
  closes?: string;
}

export const site = {
  name: "Proktologie Eimsbüttel",
  doctor: "Dr. Kai Kunstreich",
  claim: "Moderne Proktologie, diskret, vertrauensvoll und patientenorientiert.",
  city: "Hamburg",
  district: "Eimsbüttel",

  /**
   * Solange true, enthalten Adresse/Telefon/E-Mail/Sprechzeiten Musterdaten:
   * – das JSON-LD lässt die Kontaktfelder dann weg (Suchmaschinen dürfen
   *   keine erfundenen Praxisdaten indexieren)
   * – die UI zeigt sichtbare „Musterangaben"-Hinweise
   * Beim Eintragen der echten Daten auf false setzen.
   */
  isPlaceholderData: true as boolean,

  // [PLATZHALTER] Domain – vor Launch durch die echte Domain ersetzen.
  url: "https://www.proktologie-eimsbuettel.de",

  address: {
    // [PLATZHALTER] Straße und Hausnummer der Praxis
    street: "Musterstraße 12",
    zip: "20255",
    city: "Hamburg",
    district: "Eimsbüttel",
  },

  phone,
  // tel:-Link automatisch aus der Anzeige-Nummer abgeleitet – immer konsistent
  phoneHref: `tel:${phone.replace(/[^+\d]/g, "")}`,

  // [PLATZHALTER] E-Mail-Adresse der Praxis
  email: "praxis@proktologie-eimsbuettel.de",

  /** [PLATZHALTER] Sprechzeiten – vor Launch mit den echten Zeiten füllen. */
  hours: [
    {
      days: "Montag – Donnerstag",
      time: "08:00 – 17:00 Uhr",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "08:00",
      closes: "17:00",
    },
    {
      days: "Freitag",
      time: "08:00 – 13:00 Uhr",
      dayOfWeek: ["Friday"],
      opens: "08:00",
      closes: "13:00",
    },
    { days: "Samstag / Sonntag", time: "geschlossen", dayOfWeek: [] },
  ] as OpeningHours[],

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
   *          WICHTIG: Bei Aktivierung die Datenschutzerklärung anpassen
   *          (Drittanbieter-Übermittlung, Abschnitt 2 und 4).
   */
  formEndpoint: null as string | null,
} as const;

export type Site = typeof site;
