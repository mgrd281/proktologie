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
  | "wochenende"
  | "diskretion"
  | "erstbesuch"
  | "arzt"
  | "leistungen"
  | "dauer"
  | "doctolib"
  | "qualitaet"
  | "wartezeit"
  | "ohneTermin"
  | "sprachen";

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
    // Wörtlich von der Website (content/faq.ts, „Übernimmt die Krankenkasse die Kosten?").
    // Gesetzlich, privat und Selbstzahler unterscheidet die Website NICHT. Deshalb steht
    // hier nur die allgemeine Aussage – und „privat", „selbstzahler", „preis" sind
    // bewusst KEINE Stichwörter: Solche Fragen sollen ehrlich unbeantwortet bleiben,
    // statt eine Antwort zu bekommen, die sie gar nicht beantwortet.
    de: "Medizinisch notwendige Untersuchungen und Behandlungen werden in der Regel von den Krankenkassen übernommen. Ob und in welchem Umfang das in Ihrem Fall gilt, hängt von Ihrer Versicherung und der jeweiligen Leistung ab – wir informieren Sie vorab transparent.",
    en: "Medically necessary examinations and treatments are usually covered by the health insurers. Whether and to what extent that applies in your case depends on your insurance and on the particular service – we will tell you transparently in advance.",
    keywords: {
      de: ["kasse", "krankenkasse", "gesetzlich", "versichert", "versicherung", "kosten", "kostet", "bezahl", "übernimmt", "uebernimmt", "zahlt die"],
      en: ["insurance", "insured", "statutory", "cost", "costs", "pay", "payment", "cover", "covered", "krankenkasse"],
    },
  },
  urlaubsvertretung: {
    // [OFFEN] Wer vertritt im Urlaub? Ohne Angabe verweist der Assistent aufs Telefon.
    de: null,
    en: null,
    // „cover" ist bewusst nicht mehr dabei: Es traf „Is this covered by my
    // Krankenkasse?" und hängte an die richtige Antwort ein überflüssiges
    // „weiß ich nicht".
    keywords: { de: ["vertretung", "urlaub", "ferien", "vertritt", "betriebsferien"], en: ["holiday", "vacation", "substitute", "locum", "away"] },
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
    keywords: {
      de: ["vorbereiten", "vorbereitung", "bereite", "nüchtern", "nuechtern", "abführ", "abfuehr", "essen vorher", "frühstück", "fruehstueck", "einlauf"],
      // „fast“ allein wäre riskant: Im Deutschen heißt es „beinahe“. Deshalb
      // nur die Wendung mit „to“.
      en: ["prepare", "preparation", "fasting", "to fast", "laxative", "empty", "eat before", "eat beforehand", "before the appointment"],
    },
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
      // „heute noch“ und „today“ standen hier und haben aus „Geht heute noch
      // was?“ eine Akut-Auskunft gemacht. Ein Tag ist keine Dringlichkeit –
      // solche Sätze sind Terminwünsche und werden auch so behandelt.
      de: ["notfalltermin", "notfallsprechstunde", "akut", "dringend", "kurzfristig", "sofort"],
      en: ["emergency appointment", "urgent", "short notice", "acute", "as soon as"],
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
  diskretion: {
    // Wörtlich von der Website (content/faq.ts, „Wie diskret läuft der Praxisbesuch ab?").
    de: "Diskretion gehört bei uns zum Konzept: vertrauliche Terminvergabe, ruhige Räume, Gespräche hinter verschlossener Tür und ein Team, das sensibel mit Ihrem Anliegen umgeht. Ihre Daten behandeln wir streng vertraulich.",
    en: "Discretion is part of how we work: confidential appointment scheduling, quiet rooms, conversations behind a closed door and a team that handles your concern sensitively. We treat your data as strictly confidential.",
    keywords: {
      de: ["diskret", "vertraulich", "anonym", "scham", "schäm", "schaem", "peinlich", "wartezimmer", "sieht mich"],
      en: ["discreet", "discretion", "confidential", "embarrass", "ashamed", "waiting room", "anonymous"],
    },
  },
  erstbesuch: {
    // Wörtlich von der Website (content/faq.ts, „Was passiert beim ersten Termin?").
    // Nur der Ablauf – keine Aussage darüber, was untersucht wird.
    de: "Am Anfang steht ein vertrauliches Gespräch über Ihre Beschwerden. Danach folgt – falls sinnvoll und nur mit Ihrem Einverständnis – eine kurze, schonende Untersuchung. Sie erhalten noch im selben Termin eine verständliche Einschätzung und wir besprechen gemeinsam das weitere Vorgehen.",
    en: "It starts with a confidential conversation about your symptoms. After that – if it makes sense and only with your consent – a short, gentle examination follows. You receive an understandable assessment in the same appointment and we discuss the next steps together.",
    keywords: {
      de: ["erstbesuch", "erster termin", "ersten termin", "erstes mal", "ersten mal", "beim ersten", "was passiert", "was erwartet", "wie läuft", "wie laeuft", "ablauf", "ausziehen", "entkleiden"],
      en: ["first visit", "first appointment", "what happens", "what should i expect", "what to expect", "first time", "undress"],
    },
  },
  arzt: {
    // Name und Facharztbezeichnungen wörtlich aus content/arzt.ts. Keine Vita,
    // keine Klinik, keine Jahreszahlen – die stehen auf der Website, gehören
    // aber nicht in eine gesprochene Auskunft.
    de: "Ihr Arzt ist Dr. med. Kai Kunstreich, Facharzt für Chirurgie, Facharzt für Viszeralchirurgie und Europäischer Facharzt für Koloproktologie (EBSQ/FEBS).",
    en: "Your doctor is Dr. med. Kai Kunstreich – specialist in surgery, specialist in visceral surgery and European specialist in coloproctology (EBSQ/FEBS).",
    keywords: {
      de: ["arzt", "ärztin", "aerztin", "doktor", "kunstreich", "facharzt", "proktologe", "proktologin", "wer ist", "wer behandelt", "qualifikation"],
      en: ["doctor", "physician", "surgeon", "specialist", "kunstreich", "who is", "who will", "qualification"],
    },
  },
  leistungen: {
    // Liste aus den acht Leistungstiteln (content/leistungen.ts); der zweite Satz ist
    // die wörtliche Grenze aus dem Krebsvorsorge-Teaser. Das Wort „Darmspiegelung"
    // muss im Text bleiben – es ist die ehrliche Grenze dieser Praxis.
    de: "Wir behandeln Hämorrhoiden, Analfissuren, Analfisteln, Marisken und Analabszesse; dazu kommen proktologische Diagnostik, ambulante Behandlungen und die Enddarm-Krebsvorsorge. Für die komplette Darmspiegelung kooperieren wir mit erfahrenen Praxen und Kliniken und helfen Ihnen, den richtigen Untersucher zu finden.",
    en: "We treat haemorrhoids, anal fissures, anal fistulas, skin tags (Marisken) and anal abscesses, and we offer proctological diagnostics, outpatient treatments and rectal cancer screening. For a complete colonoscopy we cooperate with experienced practices and clinics and help you find the right examiner.",
    // Die Krankheits- und Verfahrensnamen stehen NICHT hier, sondern in SERVICE_TERMS
    // (knowledge.ts) – sonst würde „Behandeln Sie auch Kinder?" mit der Leistungsliste
    // beantwortet statt ehrlich mit „weiß ich nicht".
    keywords: {
      de: ["leistung", "spektrum", "angebot"],
      en: ["services"],
    },
  },
  dauer: {
    // Kommt live aus der Datenbank (appointment_types.duration_min) – hier stehen nur
    // die Erkennungswörter, genau wie bei „oeffnungszeiten". Ein fester Text wäre
    // entweder falsch oder ein unaufgelöster Platzhalter.
    de: null,
    en: null,
    keywords: {
      // „dauer" steht hier, weil normalize.ts die Wendung „wie lange dauert" zu
      // genau diesem Wort zusammenzieht. Preis dafür: „dauerhaft" und „dauernd"
      // treffen es auch – beides kommt praktisch nur in gesundheitlichen Sätzen
      // vor, die der Filter lange vor dem Wissen abfängt.
      de: ["dauer", "dauert", "wie lang", "termindauer", "wie viel zeit", "wieviel zeit", "zeit einplanen", "zeit muss ich"],
      en: ["how long", "duration", "how much time", "how many minutes", "time should i plan"],
    },
  },
  doctolib: {
    // content/booking.ts und content/site.ts. Der zweite Satz ist Projektregel:
    // Doctolib darf nie als synchronisiert dargestellt werden.
    de: "Verbindlich online buchen können Sie über unsere offizielle Doctolib-Seite. Doctolib und die Terminbuchung auf dieser Website sind getrennte Systeme und werden nicht synchronisiert.",
    en: "You can book online with immediate confirmation via our official Doctolib page. Doctolib and the appointment booking on this website are separate systems and are not synchronised.",
    keywords: { de: ["doctolib"], en: ["doctolib"] },
  },
  qualitaet: {
    // Wörtlich von der Website (content/benefits.ts, „Zertifizierte Qualität").
    de: "Hygiene, Technik und Abläufe sind bei uns auf hohem Niveau – bestätigt durch ein DEKRA-zertifiziertes Qualitätsmanagement.",
    en: "Hygiene, equipment and processes are at a high standard – confirmed by a DEKRA-certified quality management system.",
    keywords: {
      de: ["qualität", "qualitaet", "zertifi", "dekra", "hygiene"],
      en: ["quality", "certifi", "dekra", "hygiene"],
    },
  },
  wartezeit: {
    // Satz 1 aus content/benefits.ts, Satz 2 wörtlich aus content/faq.ts. Die Website
    // sagt nichts darüber, wie lange man auf einen Termin wartet – nur, wie lange
    // man in der Praxis wartet.
    de: "Wir achten auf kurze Wartezeiten. Bitte haben Sie Verständnis, dass bei Notfallterminen etwas mehr Wartezeit in der Praxis entstehen kann.",
    en: "We keep waiting times short. Please understand that short-notice appointments can mean a somewhat longer wait at the practice.",
    keywords: {
      de: ["wartezeit", "warten"],
      en: ["waiting time", "wait"],
    },
  },
  ohneTermin: {
    // Satz 1 wörtlich aus content/sections.ts, Satz 2 aus content/booking.ts. Es wird
    // NICHT behauptet, ohne Termin sei nichts möglich – gesagt wird nur, was dasteht.
    de: "Termine nach Vereinbarung – auch kurzfristig bei akuten Beschwerden. Bei akuten Beschwerden rufen Sie bitte zuerst an: 040 490 80 21.",
    en: "Appointments are by arrangement – also at short notice for acute problems. For acute problems please call us first: +49 40 490 80 21.",
    keywords: {
      // „ohnetermin" ohne Leerzeichen: normalize.ts zieht „ohne termin" zusammen.
      de: ["ohne termin", "ohnetermin", "spontan", "einfach vorbei", "offene sprechstunde", "vorher einen termin", "terminpflicht"],
      en: ["without an appointment", "without appointment", "walk in", "walk-in", "drop in", "drop-in", "open surgery", "open consultation", "just come"],
    },
  },
  sprachen: {
    // [OFFEN] Welche Sprachen das Praxisteam spricht, ist nirgends hinterlegt:
    // content/team.ts führt `languages` bei allen Einträgen leer und sagt im Kopf
    // ausdrücklich, dass Sprachen derzeit nicht bestätigt sind. Deshalb null.
    // Dass der CHAT Deutsch und Englisch kann, muss er nicht behaupten – er zeigt
    // es, indem er die Sprache wechselt. Die Stichwörter fragen nach den MENSCHEN.
    de: null,
    en: null,
    keywords: {
      // „sprachen" als Wort: normalize.ts ersetzt „sprechen sie / sprecht ihr /
      // reden sie" durch genau dieses Wort.
      de: ["sprachen", "sprechen sie", "sprecht ihr", "spricht jemand", "spricht der arzt", "welche sprache", "dolmetscher", "türkisch", "tuerkisch", "russisch", "arabisch", "polnisch", "französisch", "franzoesisch", "spanisch"],
      en: ["speak english", "speak german", "do you speak", "which language", "what language", "interpreter", "translator", "turkish", "russian", "arabic", "polish", "french", "spanish"],
    },
  },
};

/**
 * Klarnamen der Themen – für das Cockpit, nicht für den Chat. Der
 * Assistent antwortet mit Fakten, die Praxis liest hier, wonach gefragt
 * wurde.
 */
export const TOPIC_LABELS: Record<Topic | "frage", string> = {
  oeffnungszeiten: "Sprechzeiten",
  adresse: "Adresse",
  anfahrt: "Anfahrt",
  parken: "Parken",
  barrierefreiheit: "Barrierefreiheit",
  kassen: "Krankenkasse und Kosten",
  urlaubsvertretung: "Urlaub und Vertretung",
  mitbringen: "Was mitbringen?",
  kontakt: "Kontakt",
  ueberweisung: "Überweisung",
  vorbereitung: "Vorbereitung",
  datenschutz: "Datenschutz",
  akut: "Akute Beschwerden",
  absagen: "Absagen und Verschieben",
  wochenende: "Wochenende",
  diskretion: "Diskretion",
  erstbesuch: "Erster Termin",
  arzt: "Arzt und Qualifikation",
  leistungen: "Leistungen",
  dauer: "Termindauer",
  doctolib: "Doctolib",
  qualitaet: "Qualität",
  wartezeit: "Wartezeit",
  ohneTermin: "Ohne Termin kommen",
  sprachen: "Sprachen im Team",
  frage: "Frage ohne passendes Thema",
};

/**
 * Themen, zu denen die Praxis (noch) nichts hinterlegt hat. „oeffnungszeiten"
 * und „dauer" sind ausgenommen: Beide sind nicht ungepflegt, sondern kommen
 * live aus der Datenbank.
 */
const LIVE_TOPICS: Topic[] = ["oeffnungszeiten", "dauer"];

export function unknownTopics(): Topic[] {
  return (Object.keys(PRAXIS_WISSEN) as Topic[]).filter((k) => !LIVE_TOPICS.includes(k) && PRAXIS_WISSEN[k].de === null);
}
