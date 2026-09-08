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
  | "datenschutz"
  | "akut"
  | "absagen"
  | "wochenende";

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
    // Vorsicht bei kurzen Wörtern: „auf“ und „zu“ als bloße Zeichenfolge
    // stecken in fast jedem deutschen Satz („zu Ihnen“, „verkaufen“) und
    // hätten die Sprechzeiten an jede zweite Antwort gehängt. Deshalb nur
    // Wendungen, die wirklich nach der Öffnung fragen.
    keywords: {
      de: [
        "öffnungszeit", "oeffnungszeit", "sprechzeit", "sprechstunde", "geöffnet", "geoeffnet",
        "haben sie auf", "habt ihr auf", "wann haben sie", "wann sind sie", "wann seid ihr", "wann ist die praxis", "wann kann ich kommen",
        "seid ihr da", "sind sie da", "montags", "dienstags", "mittwochs", "donnerstags", "freitags", "über mittag", "ueber mittag", "mittagspause",
        "wann offen", "wann auf", "haben sie zu", "habt ihr zu", "bis wann", "ab wann",
        "wann macht", "wann schließt", "wann schliesst", "wann öffnet", "wann oeffnet",
      ],
      en: [
        "opening hour", "opening time", "office hours", "surgery hours", "when are you open", "when do you open", "when are you there", "hours", "open?",
        "are you open", "you open", "open on", "opening", "closed", "afternoons", "mornings", "what time do you", "lunch break",
      ],
    },
  },
  adresse: {
    de: "Die Praxis liegt in der Schäferkampsallee 56, 20357 Hamburg (Eimsbüttel).",
    en: "The practice is at Schäferkampsallee 56, 20357 Hamburg (Eimsbüttel).",
    keywords: {
      de: ["adresse", "anschrift", "wo ist", "wo finde", "wo sind sie", "wo seid ihr", "wo genau", "straße", "strasse", "eimsbüttel", "eimsbuettel", "hausnummer", "postleitzahl"],
      en: ["address", "where are you", "where is", "where can i find", "street", "located", "eimsbüttel", "eimsbuettel", "postcode", "zip code"],
    },
  },
  anfahrt: {
    de: "Direkt an der U-Bahn-Haltestelle Christuskirche (U2), Schäferkampsallee 56, 20357 Hamburg.",
    en: "Right at the Christuskirche underground station (line U2), Schäferkampsallee 56, 20357 Hamburg.",
    keywords: {
      de: ["anfahrt", "hinkommen", "hinfinden", "hinfahren", "wie komme", "wie komm", "wie finde", "zu ihnen", "u-bahn", "ubahn", "bus", "bahn", "haltestelle", "öffentlich", "öffis", "oeffis", "öpnv", "oepnv", "weg"],
      en: ["directions", "get there", "get to", "getting here", "how do i get", "find you", "reach you", "way to", "underground", "metro", "subway", "bus", "train", "station"],
    },
  },
  parken: {
    // [OFFEN] Die Praxis hat zu Parkplätzen nichts hinterlegt.
    de: null,
    en: null,
    keywords: { de: ["parken", "parkpl", "parkhaus", "auto"], en: ["parking", "park", "car"] },
  },
  barrierefreiheit: {
    // [OFFEN] Aufzug, Stufen, Rollstuhl – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["barrierefrei", "rollstuhl", "aufzug", "fahrstuhl", "stufe", "treppe", "gehbehindert"], en: ["accessible", "wheelchair", "lift", "elevator", "stairs", "step-free"] },
  },
  kassen: {
    // [OFFEN] Gesetzlich/privat/Selbstzahler – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["kasse", "krankenkasse", "gesetzlich", "privat", "selbstzahler", "versichert", "kosten", "kostet", "preis", "bezahl", "übernimmt", "uebernimmt"], en: ["insurance", "insured", "private", "public", "statutory", "self-pay", "cost", "pay", "price", "krankenkasse", "covered", "cover"] },
  },
  urlaubsvertretung: {
    // [OFFEN] Wer vertritt im Urlaub? Ohne Angabe verweist der Assistent aufs Telefon.
    de: null,
    en: null,
    keywords: { de: ["vertretung", "urlaub", "ferien", "vertritt", "betriebsferien"], en: ["holiday", "vacation", "cover", "substitute"] },
  },
  mitbringen: {
    // [OFFEN] Versichertenkarte, Überweisung, Medikamentenliste – von der Praxis zu bestätigen.
    de: null,
    en: null,
    keywords: { de: ["mitbring", "mitnehm", "dabei haben", "unterlagen", "versichertenkarte"], en: ["bring", "take with", "documents", "card"] },
  },
  kontakt: {
    de: "Telefonisch erreichen Sie uns unter 040 490 80 21, per E-Mail unter info@proktologie-eimsbuettel.de, Fax 040 40 93 83.",
    en: "You can reach us by phone on +49 40 490 80 21, by e-mail at info@proktologie-eimsbuettel.de, fax +49 40 40 93 83.",
    keywords: {
      de: ["telefon", "telefonnummer", "telefonnr", "rufnummer", "anrufen", "nummer", "e-mail", "email", "mail", "fax", "faxnummer", "kontakt", "erreichen"],
      en: ["phone", "call", "number", "e-mail", "email", "fax", "contact", "reach"],
    },
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
  akut: {
    // Wörtlich von der Website (content/faq.ts, „Was tun bei akuten Beschwerden?“)
    de: "Für akute Fälle halten wir ein Kontingent an kurzfristigen Notfallterminen bereit – rufen Sie uns dazu bitte immer zuerst an: 040 490 80 21. Bitte haben Sie Verständnis, dass bei Notfallterminen etwas mehr Wartezeit in der Praxis entstehen kann.",
    en: "For acute cases we keep a number of short-notice appointments available – please always call us first: +49 40 490 80 21. Please understand that short-notice appointments can mean a somewhat longer wait at the practice.",
    keywords: {
      de: ["notfalltermin", "notfallsprechstunde", "akut", "dringend", "kurzfristig", "heute noch", "noch heute", "sofort"],
      en: ["emergency appointment", "urgent", "short notice", "acute", "as soon as", "today"],
    },
  },
  absagen: {
    de: "Absagen oder verschieben können Sie über den persönlichen Link in Ihrer Bestätigungs-E-Mail oder telefonisch unter 040 490 80 21.",
    en: "You can cancel or reschedule via the personal link in your confirmation e-mail or by phone on +49 40 490 80 21.",
    keywords: {
      de: ["absag", "stornier", "verschieb", "umbuch", "termin ändern", "termin aendern"],
      en: ["cancel", "reschedul", "move my appointment", "change my appointment"],
    },
  },
  wochenende: {
    de: "Am Wochenende ist die Praxis geschlossen. Sprechzeiten sind Montag bis Freitag.",
    en: "The practice is closed at weekends. Consultation hours are Monday to Friday.",
    keywords: {
      de: ["wochenende", "samstag", "sonntag", "geschlossen", "geschlossen?"],
      en: ["weekend", "saturday", "sunday", "closed"],
    },
  },
};

/** Themen, zu denen die Praxis (noch) nichts hinterlegt hat. */
export function unknownTopics(): Topic[] {
  return (Object.keys(PRAXIS_WISSEN) as Topic[]).filter((k) => k !== "oeffnungszeiten" && PRAXIS_WISSEN[k].de === null);
}
