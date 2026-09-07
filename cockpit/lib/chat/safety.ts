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
 * Reine Funktionen, kein DOM, keine Datenbank – mit `node --test` prüfbar.
 */

/** Buchstabenbewusste Wortgrenzen: „Blutdruck“ trifft, „Blutdruckmessgerät“ auch. */
function re(words: string[]): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${words.join("|")})`, "iu");
}

/**
 * Lebensbedrohliche Lagen. Bewusst großzügig: Ein Fehlalarm kostet eine
 * Zeile Text, ein übersehener Notfall kostet mehr.
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
  "notfall",
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
  "stroke",
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
  "emergency",
];

const EMERGENCY_RE = re([...EMERGENCY_DE, ...EMERGENCY_EN]);

export interface EmergencyHit {
  matched: string;
}

/** Notfall? Dann sofort und ohne weitere Verarbeitung. */
export function detectEmergency(text: string): EmergencyHit | null {
  const m = EMERGENCY_RE.exec(text);
  return m ? { matched: m[0] } : null;
}

/**
 * Gesundheitsbezug. Enthält bewusst auch die Namen der Terminarten
 * („Hämorrhoiden“): Wer sie im Freitext nennt, bekommt den Hinweis und die
 * Schaltflächen – die Terminart wählt man mit einem Klick, nicht mit einer
 * Schilderung.
 */
const HEALTH_TERMS = [
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
  "after",
  "anal",
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
  // Englisch
  "pain",
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
  "lump",
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

const HEALTH_RE = new RegExp(`(?<!\\p{L})(?:${HEALTH_TERMS.join("|")})`, "giu");

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
  /(was ist|ist das|ist es|sind das|normal|schlimm|gefährlich|gefaehrlich|bedenklich|was soll ich|was kann ich|was hilft|hilft mir|muss ich mir sorgen|what is|is (?:it|this|that)|should i|do i need|dangerous|serious|what helps|how do i treat)/iu;

export interface HealthHit {
  /** Gefundene Begriffe – nur zur Diagnose im Test, nie zur Anzeige. */
  terms: string[];
  /** Nach Bedeutung oder Behandlung gefragt → Ablehnung statt bloßem Hinweis */
  medicalQuestion: boolean;
}

export function detectHealthData(text: string): HealthHit | null {
  const terms = [...new Set(Array.from(text.matchAll(HEALTH_RE), (m) => m[0].toLowerCase()))];
  const pattern = HEALTH_PATTERNS.some((p) => p.test(text));
  const insurance = INSURANCE_RE.test(text);
  INSURANCE_RE.lastIndex = 0;
  if (!terms.length && !pattern && !insurance) return null;
  return { terms, medicalQuestion: (terms.length > 0 || pattern) && MEDICAL_QUESTION_RE.test(text) };
}

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
