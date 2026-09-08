/**
 * Die erste Schicht des Chat-Assistenten – sie läuft vor allem anderen.
 *
 * Drei Aufgaben, in dieser Reihenfolge:
 *  1. NOTFALL erkennen. Steht sie an erster Stelle, weil ein Mensch mit
 *     Brustschmerz keine Terminfrage beantwortet bekommen darf. Der Fund
 *     beendet das Gespräch und zeigt 112 und 116 117 – auch bei Andeutungen.
 *  2. GESUNDHEITSANGABEN erkennen. Der Assistent fragt nie danach; schreibt
 *     jemand von sich aus davon, wird die Nachricht NICHT an das Sprachmodell
 *     weitergegeben und nicht gespeichert.
 *  3. PERSONENBEZUG MASKIEREN. E-Mail, Telefon, Versicherten- und
 *     Kontonummern werden ersetzt, bevor irgendein Text ein Modell erreicht.
 *
 * Ehrlich zur Grenze: Das sind Regeln, kein Verständnis. Umschreibungen
 * werden übersehen, harmlose Wörter gelegentlich getroffen. Deshalb ist der
 * Hinweis „keine Gesundheitsdaten in den Chat“ in der ersten Nachricht die
 * eigentliche Schutzmaßnahme, und deshalb ist der Filter im Zweifel streng.
 *
 * Zwei Lehren aus der Praxis, die diese Datei geformt haben:
 *  - „Ist ein Notfalltermin möglich?“ ist kein Notfall, sondern eine Frage
 *    nach kurzfristigen Terminen. „Kein Notfall, aber dringend“ auch nicht.
 *    Beides sperrte früher den Chat. Solche Wendungen werden jetzt vor der
 *    Prüfung ausgeschnitten.
 *  - „Hämorrhoiden“ ist eine buchbare Terminart der Praxis. Wer sie nennt,
 *    um den Termin zu wählen, gibt keine Gesundheitsangabe preis, sondern
 *    drückt einen Knopf mit Worten. Der Aufrufer kann solche Begriffe
 *    ausnehmen (`ignore`).
 *
 * Reine Funktionen, kein DOM, keine Datenbank – mit `node --test` prüfbar.
 */

/** Linke Wortgrenze: Stämme treffen Zusammensetzungen („Blutung“ ⊂ „Blutungen“). */
function stemRe(words: string[], flags = "iu"): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${words.join("|")})`, flags);
}

// ---------------------------------------------------------------- Notfall

/**
 * Lebensbedrohliche Lagen. Bewusst großzügig: Ein Fehlalarm kostet eine
 * Zeile Text, ein übersehener Notfall kostet mehr. Vollwörter, die auch in
 * harmlosen Zusammensetzungen stecken (Notfalltermin, emergencies), tragen
 * eine rechte Grenze.
 */
const EMERGENCY_DE = [
  "brustschmerz(?:en)?",
  "schmerzen in der brust",
  "brustenge",
  "brustdruck",
  "brust drückt",
  "druck (?:auf|in) der brust",
  // Freie Wortstellung: „Mir drückt es auf der Brust“, „es drückt in der Brust“
  "drückt[^.!?]{0,20}(?:auf|in) der brust",
  "drueckt[^.!?]{0,20}(?:auf|in) der brust",
  "eng in der brust",
  "herzinfarkt",
  "herzstillstand",
  "atemnot",
  "(?:kriege?|krieg|bekomme|bekomm) kaum luft",
  "(?:kriege?|krieg|bekomme|bekomm) keine luft",
  "keine luft (?:mehr )?(?:bekommen|kriegen)",
  "kann nicht (?:mehr )?atmen",
  "erstick",
  "bewusstlos",
  "ohnmächtig",
  "ohnmacht",
  "nicht ansprechbar",
  "zusammengebrochen",
  "blutet stark",
  "starke blutung(?:en)?",
  "blutung lässt sich nicht stillen",
  "blutsturz",
  "schlaganfall",
  "gesichtslähmung",
  "halbseitig gelähmt",
  "sprachstörung",
  "lähmung",
  "krampfanfall",
  "suizid",
  "selbstmord",
  "mich umbringen",
  "will nicht mehr leben",
  "leben nehmen",
  "selbst verletz",
  "mich verletzen",
  "überdosis",
  "vergiftung",
  "notfall(?!\\p{L})",
];

const EMERGENCY_EN = [
  "chest pain",
  "pain in (?:my )?chest",
  "tightness in (?:my )?chest",
  "heart attack",
  "cardiac arrest",
  "can'?t breathe",
  "cannot breathe",
  "can'?t get (?:any )?air",
  "short(?:ness)? of breath",
  "struggling to breathe",
  "unconscious",
  "passed out",
  "fainted",
  "not responsive",
  "unresponsive",
  "collapsed",
  "heavy bleeding",
  "bleeding heavily",
  "won'?t stop bleeding",
  "stroke(?!\\p{L})",
  "face droop",
  "slurred speech",
  "numb (?:arm|face|side)",
  "seizure",
  "suicid",
  "kill myself",
  "end my life",
  "hurt myself",
  "self[- ]harm",
  "overdose",
  "emergency(?!\\p{L})",
];

const EMERGENCY_RE = stemRe([...EMERGENCY_DE, ...EMERGENCY_EN]);

/**
 * Wendungen, die das Wort „Notfall“ enthalten, aber eine Frage nach
 * kurzfristigen Terminen oder Nummern sind. Sie werden vor der Prüfung
 * aus dem Text geschnitten – ebenso ausdrückliche Verneinungen.
 */
const EMERGENCY_CARVEOUT_RE =
  /(?<!\p{L})(?:notfall(?:termin|sprechstunde|nummer|praxis|dienst|ambulanz|kontingent)\p{L}*|emergency\s+(?:number|appointment|contact|line|slot|hours|room)|kein(?:e[nrs]?)?\s+(?:akuter\s+)?notfall\p{L}*|nicht\s+(?:lebensbedrohlich|dringend)|no\s+emergency|not\s+an\s+emergency)/giu;

export interface EmergencyHit {
  matched: string;
}

/** Notfall? Dann sofort und ohne weitere Verarbeitung. */
const BARE_EMERGENCY_WORD_RE = /(?<!\p{L})(?:notfall|emergency)(?!\p{L})/giu;
const APPOINTMENT_WISH_RE = /(termin|appointment)/iu;

export function detectEmergency(text: string): EmergencyHit | null {
  const cleaned = text.replace(EMERGENCY_CARVEOUT_RE, " ");
  const m = EMERGENCY_RE.exec(cleaned);
  if (!m) return null;
  // „Notfall: brauche schnell einen Termin“ – das nackte Wort neben einem
  // Terminwunsch ist eine Bitte um einen kurzfristigen Termin. Steht
  // daneben ein echtes Notfallzeichen (Atemnot, bewusstlos …), bleibt es
  // ein Notfall.
  if (APPOINTMENT_WISH_RE.test(text)) {
    const rest = cleaned.replace(BARE_EMERGENCY_WORD_RE, " ");
    if (!EMERGENCY_RE.test(rest)) return null;
  }
  return { matched: m[0] };
}

/**
 * Akut, aber kein Notfall: Die Praxis hält kurzfristige Termine bereit und
 * will dafür angerufen werden. Diese Sätze bekommen den Akut-Hinweis statt
 * der Datenschutz-Ermahnung – und statt der 112.
 */
const ACUTE_RE =
  /(?<!\p{L})(?:notfall|notfalltermin|notfallsprechstunde|kurzfristig|dringend|akut|sofort|schnell(?:stens|stmöglich|stmoeglich)?\s+(?:einen\s+|ein\s+)?termin|so schnell wie möglich|so schnell wie moeglich|heute noch|noch heute|urgent|as soon as|right away|quickly|emergency\s+(?:appointment|slot)|starke\s+\p{L}*schmerz|sehr\s+(?:starke|schlimme)|unerträglich|unertraeglich|severe pain|strong pain|a lot of pain|terrible pain|in pain)/iu;
/** Blutung ist immer akut – aber nur als Gesundheitsangabe gezählt, nicht als bloßes Wort. */
const ACUTE_DURATION_RE = /(?<!\p{L})(?:blut im stuhl|blood in (?:my |the )?stool|blutung|bleeding|blutet|blute)(?!\p{L})/iu;

export function isAcuteConcern(text: string, healthMentioned = false): boolean {
  return ACUTE_RE.test(text) || (healthMentioned && ACUTE_DURATION_RE.test(text));
}

// ------------------------------------------------------ Gesundheitsangaben

/**
 * Stämme mit linker Wortgrenze: „schmerz“ trifft „Schmerzen“, „blut“ trifft
 * „Blutung“. Vollwörter (mit rechter Grenze) stehen getrennt, damit
 * „Analyse“ oder „automatisch“ keinen Treffer erzeugen.
 */
const HEALTH_STEMS = [
  // Deutsch
  "schmerz",
  "wehtut",
  "tut weh",
  "blut",
  "juck",
  "brenn",
  "hämorrhoid",
  "haemorrhoid",
  "fissur",
  "fistel",
  "abszess",
  "entzünd",
  "entzuend",
  "durchfall",
  "verstopfung",
  "stuhl",
  "darm",
  "analbereich",
  "rektum",
  "knoten",
  "schwellung",
  "ausfluss",
  "fieber",
  "übelkeit",
  "uebelkeit",
  "diagnose",
  "befund",
  "krebs",
  "tumor",
  "polyp",
  "medikament",
  "tablette",
  "salbe",
  "zäpfchen",
  "zaepfchen",
  "ibuprofen",
  "paracetamol",
  "antibiotik",
  "cortison",
  "blutverdünner",
  "blutverduenner",
  "schwanger",
  "symptom",
  "beschwerden",
  "operation",
  "operiert",
  "eingriff",
  // Englisch
  "surger",
  "pain(?!t)",
  "hurts",
  "bleed",
  "itch",
  "burning",
  "fissure",
  "fistula",
  "abscess",
  "inflam",
  "diarrh",
  "constipat",
  "stool",
  "bowel",
  "anus",
  "rectum",
  "swelling",
  "discharge",
  "fever",
  "nausea",
  "diagnos",
  "cancer",
  "tumou?r",
  "medication",
  "tablet",
  "ointment",
  "suppositor",
  "antibiotic",
  "pregnan",
];

/** Vollwörter: nur als ganzes Wort ein Treffer. */
const HEALTH_WORDS = ["anal", "lump"];

const HEALTH_RE = new RegExp(
  `(?<!\\p{L})(?:${HEALTH_STEMS.join("|")}|(?:${HEALTH_WORDS.join("|")})(?!\\p{L}))`,
  "giu",
);

/** „Ich habe seit drei Tagen …“ – auch ohne Fachwort ein Gesundheitsbericht. */
const HEALTH_PATTERNS = [
  /ich (?:habe|hab|leide|spüre|spuere|bekomme|kriege)\b[^.!?]{0,60}\b(?:seit|schmerz|beschwerden|symptom|blut)/iu,
  /i (?:have|got|suffer|feel)\b[^.!?]{0,60}\b(?:pain|bleeding|symptom|since)/iu,
  /seit (?:\d+|ein(?:er|em)?|zwei|drei|vier) (?:tag|tagen|woche|wochen|monat|monaten)/iu,
];

/** Versichertennummer der eGK: ein Buchstabe, neun Ziffern. */
const INSURANCE_RE = /(?<![A-Z0-9])[A-Z]\d{9}(?![0-9])/g;

/** Fragen nach Bedeutung oder Behandlung – die lehnt der Assistent ab. */
const MEDICAL_QUESTION_RE =
  /(was ist|ist das|ist es|sind das|normal|schlimm|gefährlich|gefaehrlich|bedenklich|was soll ich|was kann ich|was hilft|hilft (?:mir|das|es|gegen)|was tun|was mache ich|muss ich mir sorgen|(?:kann|darf|soll|sollte) ich (?:\p{L}+\s+){0,5}(?:nehmen|einnehmen|benutzen|anwenden|auftragen)|empfehl|welche[srn]? (?:salbe|creme|medikament|tablette|mittel|schmerzmittel|zäpfchen|zaepfchen)|what is|is (?:it|this|that)|should i|do i need|dangerous|serious|what helps|how (?:do|can) i treat|what (?:can|should) i (?:do|take|use)|can i take|recommend|which (?:ointment|cream|medication|painkiller|tablet))/iu;

export interface HealthHit {
  /** Gefundene Begriffe – nur zur Diagnose im Test, nie zur Anzeige. */
  terms: string[];
  /** Nach Bedeutung oder Behandlung gefragt → Ablehnung statt bloßem Hinweis */
  medicalQuestion: boolean;
}

export interface HealthOptions {
  /**
   * Begriffe, die keine Gesundheitsangabe sind, weil sie eine buchbare
   * Terminart oder eine angebotene Leistung benennen („Hämorrhoiden“,
   * „Analfissur“). Sie werden vor der Prüfung aus dem Text entfernt.
   */
  ignore?: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectHealthData(text: string, options: HealthOptions = {}): HealthHit | null {
  let subject = text;
  let ignored = false;
  if (options.ignore?.length) {
    const ignoreRe = new RegExp(`(?<!\\p{L})(?:${options.ignore.map((w) => escapeRe(w.toLowerCase())).join("|")})\\p{L}*`, "giu");
    subject = subject.replace(ignoreRe, " ");
    ignored = subject !== text;
  }
  const terms = [...new Set(Array.from(subject.matchAll(HEALTH_RE), (m) => m[0].toLowerCase()))];
  const pattern = HEALTH_PATTERNS.some((p) => p.test(subject));
  const insurance = INSURANCE_RE.test(subject);
  INSURANCE_RE.lastIndex = 0;
  if (!terms.length && !pattern && !insurance) {
    // „Was hilft gegen Hämorrhoiden?“: Die Terminart darf genannt werden,
    // eine Frage nach Behandlung oder Bedeutung bleibt aber medizinisch.
    if (ignored && MEDICAL_QUESTION_RE.test(text)) return { terms: [], medicalQuestion: true };
    return null;
  }
  return { terms, medicalQuestion: (terms.length > 0 || pattern) && MEDICAL_QUESTION_RE.test(subject) };
}

// ------------------------------------------------------------ Maskierung

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Mindestens acht Ziffern, damit „14:30“ oder „ab 15 Uhr“ nicht getroffen werden
const PHONE_RE = /(?<![\w:])\+?\d(?:[\d\s/().-]{6,}\d)(?![\w:])/g;
/** Datumsangaben sehen wie kurze Nummern aus – 12.03.2026, 12/03/2026, 2026-03-12 */
const DATE_LIKE_RE = /^(?:\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})$/;
const IBAN_RE = /(?<![A-Z0-9])[A-Z]{2}\d{2}[A-Z0-9]{10,28}(?![A-Z0-9])/g;

export type MaskedKind = "email" | "phone" | "insurance" | "iban";

export interface MaskResult {
  text: string;
  masked: MaskedKind[];
}

/**
 * Personenbezug entfernen, bevor Text ein Sprachmodell erreicht. Die
 * kostenlosen Anbieter haben keinen Auftragsverarbeitungsvertrag – also
 * bekommen sie weder Adressen noch Nummern zu sehen. Name und E-Mail
 * werden ohnehin nur über Formularfelder erfasst und nie in den Modellpfad
 * gegeben; diese Funktion fängt ab, was jemand freiwillig hineinschreibt.
 */
export function maskPii(text: string): MaskResult {
  const masked: MaskedKind[] = [];
  let out = text;
  const swap = (rx: RegExp, kind: MaskedKind, replacement: string, keep?: (m: string) => boolean) => {
    let hit = false;
    out = out.replace(rx, (m) => {
      if (keep?.(m)) return m;
      hit = true;
      return replacement;
    });
    if (hit) masked.push(kind);
  };
  // Reihenfolge zählt: E-Mail vor Telefon, sonst frisst die Ziffernregel Teile davon
  swap(EMAIL_RE, "email", "[E-Mail]");
  swap(IBAN_RE, "iban", "[IBAN]");
  swap(INSURANCE_RE, "insurance", "[Nummer]");
  // Ein Datum ist keine Telefonnummer – es darf im Text bleiben, damit der
  // Assistent den Terminwunsch noch versteht.
  swap(PHONE_RE, "phone", "[Telefon]", (m) => DATE_LIKE_RE.test(m.trim()));
  return { text: out, masked };
}
