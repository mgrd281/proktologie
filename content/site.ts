/**
 * Zentrale Praxis-Stammdaten – Single Source of Truth.
 *
 * WICHTIG: Alle mit [PLATZHALTER] markierten Werte sind Musterangaben und
 * müssen vor Veröffentlichung durch die echten Praxisdaten ersetzt werden.
 * Diese Datei speist Header, Footer, Praxis-Sektion, Kontakt und JSON-LD.
 */

// Echte Praxis-Telefonnummer (von der Bestandsseite übernommen und geprüft).
const phone = "040 490 80 21";

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
   * Adresse und Telefon sind bereits echt. Solange dieses Flag true ist,
   * gelten E-Mail und Sprechzeiten noch als Musterdaten:
   * – das JSON-LD lässt genau diese Felder weg
   * – die UI zeigt dort sichtbare „Musterangabe"-Hinweise
   * Beim Eintragen der echten E-Mail + Sprechzeiten auf false setzen.
   */
  isPlaceholderData: true as boolean,

  // [PLATZHALTER] Domain – vor Launch durch die echte Domain ersetzen.
  url: "https://www.proktologie-eimsbuettel.de",

  address: {
    // Echte Praxisadresse (von der Bestandsseite übernommen und geprüft)
    street: "Schäferkampsallee 56",
    zip: "20357",
    city: "Hamburg",
    district: "Eimsbüttel",
  },

  phone,
  // E.164-Format für den klickbaren Link (entspricht der Anzeige-Nummer)
  phoneHref: "tel:+49404908021",

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
    "https://www.google.com/maps/search/?api=1&query=Sch%C3%A4ferkampsallee+56%2C+20357+Hamburg",

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
