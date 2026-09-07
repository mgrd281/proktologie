/**
 * Gepflegtes Praxiswissen für den Chat-Assistenten und die Patienten-Mails.
 *
 * DIE REGEL DIESER DATEI: Was hier `null` ist, hat die Praxis noch nicht
 * geliefert – dann sagt der Assistent „das weiß ich leider nicht“ und nennt
 * die Telefonnummer. Er erfindet nichts, und er formuliert auch nichts aus
 * dem Sprachmodell heraus, was hier nicht steht.
 *
 * Was hier steht, stammt aus der Website (content/site.ts, content/faq.ts)
 * und ist von der Praxis bestätigt. Öffnungszeiten stehen bewusst NICHT
 * hier: Sie kommen live aus der Datenbank (opening_hours), damit Chat und
 * Buchung nie auseinanderlaufen.
 *
 * Nichts in dieser Datei ist medizinisch. Fragen nach Beschwerden,
 * Diagnosen oder Medikamenten beantwortet der Assistent grundsätzlich nicht.
 */
export type Topic =
  | "oeffnungszeiten"
  | "adresse"
  | "anfahrt"
  | "parken"
  | "barrierefreiheit"
  | "kassen"
  | "urlaubsvertretung"
  | "mitbringen"
  | "kontakt"
  | "ueberweisung"
  | "vorbereitung"
  | "datenschutz";

export interface Fact {
  /** Text der Antwort – `null` heißt: nicht gepflegt, also unbekannt. */
  de: string | null;
  en: string | null;
  /** Wörter, an denen die Frage erkannt wird (klein geschrieben). */
  keywords: { de: string[]; en: string[] };
}

export const PRAXIS_WISSEN: Record<Topic, Fact> = {
  oeffnungszeiten: {
    // Kommt live aus der Datenbank – hier stehen nur die Erkennungswörter.
    de: null,
    en: null,
    keywords: {
      de: ["öffnungszeit", "oeffnungszeit", "sprechzeit", "sprechstunde", "geöffnet", "geoeffnet", "auf", "zu", "wann", "uhrzeit"],
      en: ["opening", "hours", "open", "closed", "when"],
    },
  },
  adresse: {
    de: "Die Praxis liegt in der Schäferkampsallee 56, 20357 Hamburg (Eimsbüttel).",
    en: "The practice is at Schäferkampsallee 56, 20357 Hamburg (Eimsbüttel).",
    keywords: { de: ["adresse", "anschrift", "wo ist", "wo finde", "straße", "strasse"], en: ["address", "where are you", "where is", "street"] },
  },
  anfahrt: {
    de: "Direkt an der U-Bahn-Haltestelle Christuskirche (U2), Schäferkampsallee 56, 20357 Hamburg.",
    en: "Right at the Christuskirche underground station (line U2), Schäferkampsallee 56, 20357 Hamburg.",
    keywords: { de: ["anfahrt", "hinkommen", "u-bahn", "ubahn", "bus", "bahn", "haltestelle", "öffentlich", "weg"], en: ["directions", "get there", "getting here", "underground", "metro", "subway", "bus", "train", "station"] },
  },
  parken: {
    // [OFFEN] Die Praxis hat zu Parkplätzen nichts hinterlegt.
    de: null,
    en: null,
    keywords: { de: ["parken", "parkplatz", "parkhaus", "auto"], en: ["parking", "park", "car"] },
  },
  barrierefreiheit: {
    // [OFFEN] Aufzug, Stufen, Rollstuhl – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["barrierefrei", "rollstuhl", "aufzug", "fahrstuhl", "stufen", "treppe", "gehbehindert"], en: ["accessible", "wheelchair", "lift", "elevator", "stairs", "step-free"] },
  },
  kassen: {
    // [OFFEN] Gesetzlich/privat/Selbstzahler – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["kasse", "krankenkasse", "gesetzlich", "privat", "selbstzahler", "versichert", "kosten", "bezahlen"], en: ["insurance", "insured", "private", "public", "statutory", "self-pay", "cost", "pay"] },
  },
  urlaubsvertretung: {
    // [OFFEN] Wer vertritt im Urlaub? Ohne Angabe verweist der Assistent aufs Telefon.
    de: null,
    en: null,
    keywords: { de: ["vertretung", "urlaub", "geschlossen", "ferien", "wer vertritt"], en: ["holiday", "vacation", "closed", "cover", "substitute"] },
  },
  mitbringen: {
    // [OFFEN] Versichertenkarte, Überweisung, Medikamentenliste – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["mitbringen", "mitnehmen", "dabei haben", "unterlagen", "karte"], en: ["bring", "take with", "documents", "card"] },
  },
  kontakt: {
    de: "Telefonisch erreichen Sie uns unter 040 490 80 21, per E-Mail unter info@proktologie-eimsbuettel.de, Fax 040 40 93 83.",
    en: "You can reach us by phone on +49 40 490 80 21, by e-mail at info@proktologie-eimsbuettel.de, fax +49 40 40 93 83.",
    keywords: { de: ["telefon", "telefonnummer", "anrufen", "nummer", "e-mail", "email", "mail", "fax", "kontakt", "erreichen"], en: ["phone", "call", "number", "e-mail", "email", "fax", "contact", "reach"] },
  },
  ueberweisung: {
    de: "Eine Überweisung ist hilfreich, aber keine Voraussetzung – Sie können auch ohne Überweisung einen Termin vereinbaren.",
    en: "A referral is helpful but not required – you can book an appointment without one.",
    keywords: { de: ["überweisung", "ueberweisung", "hausarzt", "hausärztin"], en: ["referral", "refer", "gp", "family doctor"] },
  },
  vorbereitung: {
    de: "Für die Untersuchung ist keine besondere Darmvorbereitung nötig – normale Körperhygiene genügt. Falls im Einzelfall doch etwas vorzubereiten ist, sagen wir Ihnen das rechtzeitig.",
    en: "No special bowel preparation is needed for the examination – normal personal hygiene is enough. If anything is needed in your case, we will tell you in good time.",
    keywords: { de: ["vorbereiten", "vorbereitung", "nüchtern", "nuechtern", "abführ", "abfuehr", "essen vorher"], en: ["prepare", "preparation", "fasting", "empty", "before the appointment"] },
  },
  datenschutz: {
    de: "Wie wir mit Ihren Daten umgehen, steht in unserer Datenschutzerklärung auf der Website.",
    en: "How we handle your data is described in the privacy policy on our website.",
    keywords: { de: ["datenschutz", "daten", "dsgvo", "gespeichert", "löschen", "loeschen"], en: ["privacy", "data", "gdpr", "stored", "delete"] },
  },
};

/** Themen, zu denen die Praxis (noch) nichts hinterlegt hat. */
export function unknownTopics(): Topic[] {
  return (Object.keys(PRAXIS_WISSEN) as Topic[]).filter((k) => k !== "oeffnungszeiten" && PRAXIS_WISSEN[k].de === null);
}
