/**
 * Was Patienten tippen, und was gemeint ist.
 *
 * „Öffnugszeiten", „Termn", „Donerstag", „apointment" – im Chatfenster
 * wird schnell und oft am Telefon getippt. Ein Assistent, der daran
 * scheitert, wirkt begriffsstutzig, obwohl ihm nur ein Buchstabe fehlt.
 *
 * Drei Stufen, in dieser Reihenfolge:
 *
 *  1. **Falten.** Kleinschreibung, Umlaute und ß in ihre Umschrift,
 *     mehrfach getippte Buchstaben stauchen.
 *  2. **Wendungen ersetzen.** Eine kurze, gepflegte Tabelle: „habt ihr
 *     offen" meint Öffnungszeiten, „wo seid ihr" die Adresse. Das trifft
 *     mehr als jede Rechtschreibkorrektur, weil es um ganze Sätze geht.
 *  3. **Tippfehler.** Nur gegen eine kleine Liste von Wörtern, die im
 *     Terminwesen vorkommen, nur mit Abstand eins, und nur ab fünf
 *     Buchstaben. Wer weiter korrigiert, erfindet Absichten.
 *
 * Die Schutzliste ist der wichtigste Teil dieser Datei. „morgens" ist von
 * „morgen" genau einen Buchstaben entfernt – eine unbedachte Korrektur
 * würde aus „acht Uhr morgens" den morgigen Tag machen und den Termin auf
 * den falschen Tag legen. Solche Wörter werden nie angefasst.
 *
 * Reine Funktionen.
 *
 * Ausführen:  node --test lib/chat/normalize.test.mjs
 */

/** Umlaute, ß und Mehrfachbuchstaben – der gemeinsame Nenner beider Seiten. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[àáâã]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõ]/g, "o")
    .replace(/[ùúû]/g, "u")
    // „Jaaa" und „hallooo" – drei gleiche Buchstaben werden zu einem.
    .replace(/(\p{L})\1{2,}/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ganze Wendungen, die häufiger vorkommen als das Fachwort. Links steht,
 * was Menschen schreiben, rechts das Wort, auf das die Wissensdatenbank
 * hört. Bewusst kurz gehalten und von Hand gepflegt – eine lange Liste
 * wäre eine zweite, schlechtere Wissensdatenbank.
 */
const PHRASES: Array<[RegExp, string]> = [
  [/\b(?:habt ihr|haben sie) (?:heute |morgen |gerade )?(?:offen|auf|geoeffnet)\b/gu, "oeffnungszeiten"],
  [/\b(?:seid ihr|sind sie) (?:heute |morgen )?(?:da|offen|geoeffnet)\b/gu, "oeffnungszeiten"],
  [/\bwann (?:habt ihr|haben sie|seid ihr|sind sie|macht ihr|machen sie) (?:auf|offen|geoeffnet)\b/gu, "oeffnungszeiten"],
  [/\bwann offen\b/gu, "oeffnungszeiten"],
  [/\bwo (?:seid ihr|sind sie|finde ich euch|finde ich sie|ist die praxis)\b/gu, "adresse"],
  [/\bwie (?:komme|komm) ich (?:zu euch|zu ihnen|hin)\b/gu, "anfahrt"],
  [/\bwas kostet\b/gu, "kosten"],
  [/\bwer (?:zahlt|bezahlt|uebernimmt)\b/gu, "kosten kasse"],
  [/\b(?:sprechen sie|sprecht ihr|reden sie)\b/gu, "sprachen"],
  [/\bohne termin\b/gu, "ohnetermin"],
  [/\bwie lange dauert\b/gu, "dauer"],
];

/**
 * Wörter, die im Terminwesen vorkommen und deren Tippfehler sich lohnt zu
 * beheben. Alles hier steht schon gefaltet.
 */
export const CORE_TERMS = [
  "termin", "termine", "terminen", "buchen", "vereinbaren", "absagen", "stornieren", "verschieben", "umbuchen",
  "bestaetigen", "oeffnungszeiten", "sprechzeiten", "sprechstunde", "adresse", "anfahrt", "parkplatz",
  "ueberweisung", "rezept", "krankschreibung", "befund", "kontrolle", "kontrolltermin", "erstuntersuchung",
  "nachsorge", "haemorrhoiden", "analfissur", "analfistel", "vorsorge", "beschwerden", "notfall", "notfalltermin",
  "rueckruf", "kosten", "krankenkasse", "versichert", "schnellstmoeglich", "moeglich", "vormittag", "nachmittag",
  "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag",
  "januar", "februar", "maerz", "april", "juni", "juli", "august", "september", "oktober", "november", "dezember",
  "appointment", "appointments", "booking", "cancel", "reschedule", "confirm", "opening", "directions", "address",
  "referral", "prescription", "insurance", "monday", "tuesday", "wednesday", "thursday", "friday", "morning",
  "afternoon", "evening", "possible", "earliest",
];

/**
 * Wörter, die niemals korrigiert werden dürfen, weil sie genau einen
 * Buchstaben von einem Kernbegriff entfernt sind und etwas anderes
 * bedeuten. Jeder Eintrag hier hat einen Grund, der im Test steht.
 */
export const PROTECTED = new Set([
  // „morgens" ist ein Tagesteil, „morgen" ein Tag – der Unterschied ist ein Termin.
  "morgens", "morgen", "abends", "mittags", "vormittags", "nachmittags", "nachts",
  // Kurze Alltagswörter, die zufällig nah an Wochentagen liegen.
  "so", "do", "mo", "di", "mi", "fr", "sa", "am", "an", "in", "auf", "kein", "keine", "keinen",
  // Englische Alltagswörter nahe an Kernbegriffen.
  "morning", "mornings", "evening", "evenings", "afternoon", "afternoons", "possible",
  // Zahlwörter: „vier" und „hier" trennt ein Buchstabe.
  "hier", "vier", "wier", "mir", "dir", "wir", "ihr",
  // „cancer" ist von „cancel" einen Buchstaben entfernt. Ohne diesen
  // Eintrag wird aus „I need a colonoscopy for cancer screening" eine
  // Terminabsage – aus einer Vorsorgefrage ein verlorener Termin.
  "cancer", "cancers",
]);

/**
 * Abstand nach Damerau-Levenshtein, mit Abbruch. Vertauschte Nachbarn
 * zählen als ein Fehler – genau der Tippfehler, den eine Hand macht.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push(new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = value;
      best = Math.min(best, value);
    }
    // Ganze Zeile schon über der Grenze: Es wird nicht mehr besser.
    if (best > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
}

const KNOWN = new Set(CORE_TERMS);
/** Kürzere Wörter zu korrigieren rät mehr, als es hilft. */
const MIN_LENGTH = 5;

/**
 * Ein einzelnes Wort korrigieren – oder es in Ruhe lassen, was der
 * häufigere und wichtigere Fall ist.
 */
export function correctWord(word: string): string {
  if (word.length < MIN_LENGTH) return word;
  if (KNOWN.has(word) || PROTECTED.has(word)) return word;
  let best: string | null = null;
  for (const term of CORE_TERMS) {
    if (Math.abs(term.length - word.length) > 1) continue;
    if (editDistance(word, term, 1) <= 1) {
      // Zwei gleich nahe Kandidaten heißen: Es ist nicht klar, was gemeint
      // war. Dann lieber nichts ändern.
      if (best !== null && best !== term) return word;
      best = term;
    }
  }
  return best ?? word;
}

/**
 * Der ganze Weg. Das Ergebnis dient dem Erkennen von Absicht und Thema –
 * niemals der Anzeige und niemals dem Speichern. Angezeigt wird immer,
 * was der Patient geschrieben hat.
 */
export function normalize(text: string): string {
  let out = fold(text);
  for (const [re, replacement] of PHRASES) out = out.replace(re, replacement);
  // Nur der Wortkern wird korrigiert; alles davor und danach bleibt, wie
  // es war. Sonst wird aus „16.7." schnell „167.7." und aus „14:30?" eine
  // Zahl, die kein Datum und keine Uhrzeit mehr ist.
  return out
    .split(/(\s+)/u)
    .map((part) => {
      if (/\s/.test(part) || !part) return part;
      const m = /^([^\p{L}\p{N}]*)([\p{L}\p{N}]*)([\s\S]*)$/u.exec(part);
      if (!m) return part;
      const [, before, core, after] = m;
      // Ein Kern mit Ziffern ist ein Datum, eine Uhrzeit oder eine
      // Referenz – nie ein Tippfehler.
      const fixed = core && !/\d/.test(core) ? correctWord(core) : (core ?? "");
      return `${before ?? ""}${fixed}${after ?? ""}`;
    })
    .join("")
    .replace(/[ \t]+/gu, " ")
    .trim();
}
