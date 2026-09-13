/**
 * Gesprochene Angaben lesen.
 *
 * Wer tippt, schreibt „max.mustermann@gmx.de“. Wer spricht, sagt „max
 * punkt mustermann ät gmx punkt de“ – und die Erkennung schreibt das so
 * auf, mal mit „at“, mal mit „ät“, mal buchstabiert sie den Vornamen
 * einzeln. Eine Telefonnummer kommt als „null eins sieben sechs …“ oder
 * als „0176 123 45 67“. Ein Name kommt als „Ich heiße Max Mustermann“.
 *
 * Diese Funktionen machen daraus, was das Formular erwartet. Sie
 * entscheiden nichts und speichern nichts – sie lesen. Was sie nicht
 * sicher lesen können, geben sie als `null` zurück; dann fragt der
 * Automat nach oder bietet das Tippen an. Raten wäre teurer als
 * nachfragen: Eine falsch gehörte E-Mail-Adresse ist eine Bestätigung,
 * die nie ankommt.
 *
 * Reine Funktionen, ohne Netz und ohne Modell. Node-22-strip-only:
 * relative `.ts`-Importe, keine Parameter-Properties.
 *
 *   node --test lib/chat/spoken.test.mjs
 */

export type Lang = "de" | "en";

// -------------------------------------------------------------- Name

/** Einleitungen, die vor dem eigentlichen Namen stehen. */
const NAME_LEAD_RE =
  /^(?:(?:ja|nein|also|äh|ähm|hm|okay|ok|gut|danke)[,\s]+)*(?:(?:ich\s+(?:heiße|heisse|bin)|mein\s+name\s+ist|der\s+name\s+ist|name\s+ist|my\s+name\s+is|i\s+am|i'm|it's|this\s+is)\s+)?/iu;
/**
 * Wörter, die in keinem Namen vorkommen – ein Satz mit einem davon ist
 * eine Absicht, kein Name („Lieber am Mittwoch“, „Ich möchte abbrechen“)
 * oder ein Fetzen der Erkennung („Wochen.“). Lieber nachfragen als
 * „Danke, Lieber Am. Und Ihr Nachname?“.
 */
const NOT_A_NAME = new Set([
  "ich", "möchte", "moechte", "hätte", "haette", "will", "gern", "gerne", "bitte", "nicht", "kein", "keine", "termin", "doch", "lieber",
  "und", "oder", "das", "ist", "mir", "wir", "sie", "mein", "meine", "nein", "ja", "danke", "am", "um", "uhr", "morgen", "heute",
  "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag", "woche", "wochen", "vormittags", "nachmittags",
  "abbrechen", "zurück", "stopp", "stop", "mit", "einem", "einer", "menschen", "mensch", "sprechen", "hallo", "egal",
  "the", "a", "an", "i", "want", "would", "like", "please", "not", "no", "yes", "appointment", "cancel", "monday", "tuesday",
  "wednesday", "thursday", "friday", "week", "weeks", "morning", "afternoon", "hello",
]);
/** Namenszusätze, die zum Nachnamen gehören: „Anna von der Heide“. */
const PARTICLES = new Set(["von", "van", "de", "der", "den", "zu", "zur", "zum", "da", "di", "du", "le", "la", "del", "della", "of", "vom", "ten", "ter"]);
/** Anreden und Titel, die kein Namensteil sind. */
const TITLE_RE = /^(?:herr|frau|hr\.?|fr\.?|dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|miss)$/iu;
const NAME_WORD_RE = /^[\p{L}][\p{L}'’.-]*$/u;

export interface SpokenName {
  firstName: string;
  lastName: string | null;
}

/**
 * „Ich heiße Max Mustermann.“ → Max / Mustermann. Ein einzelnes Wort ist
 * ein Vorname ohne Nachname – der Automat fragt dann nach. Mehr als zwei
 * Wörter: das letzte ist der Nachname, alles davor der Vorname (Doppel-
 * vornamen sind häufiger als Doppelnachnamen ohne Bindestrich).
 */
export function parseSpokenName(text: string): SpokenName | null {
  const cleaned = text
    .trim()
    .replace(NAME_LEAD_RE, "")
    .replace(/[.!?,;:]+$/u, "")
    .trim();
  const words = cleaned
    .split(/\s+/u)
    .filter((w) => w && !TITLE_RE.test(w))
    .map((w) => w.replace(/[.,;:!?]+$/u, ""))
    .filter((w) => NAME_WORD_RE.test(w));
  if (words.length === 0 || words.length > 6) return null;
  if (words.some((w) => NOT_A_NAME.has(w.toLowerCase()))) return null;
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  if (words.length === 1) return { firstName: cap(words[0]!), lastName: null };
  // „Anna Maria von der Heide“: ab dem ersten Zusatz beginnt der Nachname.
  const particle = words.findIndex((w, i) => i > 0 && i < words.length - 1 && PARTICLES.has(w.toLowerCase()));
  if (particle > 0) return { firstName: words.slice(0, particle).map(cap).join(" "), lastName: [...words.slice(particle, -1), cap(words[words.length - 1]!)].join(" ") };
  return { firstName: words.slice(0, -1).map(cap).join(" "), lastName: cap(words[words.length - 1]!) };
}

// ------------------------------------------------------------ E-Mail

/** Wörter, die beim Sprechen für Zeichen stehen. Reihenfolge: längere zuerst. */
// Keine `\b`: Die Wortgrenze kennt in JavaScript auch mit `u` nur ASCII –
// vor „ät" gäbe es keine. Darum Unicode-Lookarounds.
const W = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
const EMAIL_TOKENS: Array<[RegExp, string]> = [
  [new RegExp(`${W}(?:unterstrich|underscore)${E}`, "giu"), "_"],
  [new RegExp(`${W}(?:bindestrich|minus|strich|dash|hyphen)${E}`, "giu"), "-"],
  [new RegExp(`${W}(?:punkt|dot|point)${E}`, "giu"), "."],
  [new RegExp(`${W}(?:ät|aet|at|add|klammeraffe|affenschwanz)${E}`, "giu"), "@"],
];
/** Häufige Endungen, die die Erkennung gern als Wort schreibt. */
const TLD_FIX_RE = /\.(?:d e|c o m|n e t|o r g|c h|a t)$/iu;
/** Was das Formular als gültig ansieht – dieselbe Prüfung wie beim Tippen. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/**
 * „max punkt mustermann ät gmx punkt de“ → „max.mustermann@gmx.de“.
 *
 * Schritte: Einleitungen weg, Zeichenwörter ersetzen, Buchstabier-Folgen
 * („m a x“) zusammenziehen, Leerzeichen entfernen, kleinschreiben, prüfen.
 * Kommt am Ende keine gültige Adresse heraus, ist die Antwort `null` – der
 * Automat fragt dann nach oder bietet das Tippen an.
 */
export function normalizeSpokenEmail(text: string): string | null {
  let s = text
    .trim()
    .replace(/^(?:(?:ja|nein|also|äh|ähm|okay|ok)[,\s]+)*(?:meine\s+e-?mail(?:-?adresse)?\s+(?:ist|lautet)|die\s+adresse\s+(?:ist|lautet)|(?:es|sie|die)\s+(?:ist|lautet)|e-?mail\s*:?|my\s+e-?mail\s+is|it's|it\s+is|email\s*:?)\s*/iu, "")
    .replace(/[.!?,;:]+$/u, "")
    .toLowerCase();
  // Bereits eine Adresse? Dann nur säubern.
  if (EMAIL_RE.test(s.replace(/\s+/gu, ""))) return s.replace(/\s+/gu, "");
  for (const [re, ch] of EMAIL_TOKENS) s = s.replace(re, ` ${ch} `);
  // Die Erkennung schreibt Endungen manchmal als Buchstabenfolge.
  s = s.replace(TLD_FIX_RE, (m) => m.replace(/\s+/gu, ""));
  // Buchstabierte Teile („m a x“) zusammenziehen: Folgen einzelner Zeichen.
  s = s.replace(/(?<![\p{L}\p{N}])(\p{L})(?:\s+(\p{L}))+(?![\p{L}\p{N}])/gu, (m) => m.replace(/\s+/gu, ""));
  // Alles Weitere ist ohne Leerzeichen gemeint.
  s = s.replace(/\s+/gu, "");
  // Doppelte Zeichen aus Ersetzungen („..“, „@@“) glätten.
  s = s.replace(/\.{2,}/gu, ".").replace(/@{2,}/gu, "@").replace(/^[.@_-]+|[.@_-]+$/gu, "");
  return EMAIL_RE.test(s) ? s : null;
}

// ----------------------------------------------------------- Telefon

const DIGIT_WORDS: Record<string, string> = {
  null: "0", eins: "1", ein: "1", zwei: "2", zwo: "2", drei: "3", vier: "4", fünf: "5", fuenf: "5", sechs: "6", sieben: "7", acht: "8", neun: "9",
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};
const TENS_WORDS: Record<string, string> = {
  zehn: "10", elf: "11", zwölf: "12", zwoelf: "12", dreizehn: "13", vierzehn: "14", fünfzehn: "15", fuenfzehn: "15", sechzehn: "16", siebzehn: "17", achtzehn: "18", neunzehn: "19",
  zwanzig: "20", dreißig: "30", dreissig: "30", vierzig: "40", fünfzig: "50", fuenfzig: "50", sechzig: "60", siebzig: "70", achtzig: "80", neunzig: "90",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
};

/**
 * „null eins sieben sechs, eins zwei drei“ oder „0176 123 45 67“ → nur
 * Ziffern, mit führendem Plus, wenn gesprochen. Weniger als sechs Ziffern
 * sind keine Telefonnummer.
 */
export function parseSpokenPhone(text: string): string | null {
  const s = text.trim().toLowerCase().replace(/^(?:(?:ja|also|äh|okay|ok)[,\s]+)*(?:meine\s+(?:nummer|handynummer|telefonnummer)\s+(?:ist|lautet)|(?:die\s+)?nummer\s+(?:ist|lautet)|my\s+(?:number|phone)\s+is)\s*/iu, "");
  const plus = /\b(?:plus|international)\b/iu.test(s) || s.trim().startsWith("+");
  const parts = s.split(/[\s,.\-/()]+/u).filter(Boolean);
  let digits = "";
  for (const raw of parts) {
    const w = raw.replace(/^\+/u, "");
    if (/^\d+$/u.test(w)) {
      digits += w;
      continue;
    }
    if (TENS_WORDS[w]) {
      digits += TENS_WORDS[w];
      continue;
    }
    if (DIGIT_WORDS[w]) {
      digits += DIGIT_WORDS[w];
      continue;
    }
    // „einundzwanzig“ u. ä. – zusammengesetzte Zahlwörter: Einer + „und“ + Zehner.
    const m = /^(\p{L}+?)und(\p{L}+)$/u.exec(w);
    if (m && DIGIT_WORDS[m[1]!] && TENS_WORDS[m[2]!]) {
      const t = Number(TENS_WORDS[m[2]!]);
      const u = Number(DIGIT_WORDS[m[1]!]);
      digits += String(t + u);
      continue;
    }
    if (/^(?:plus|international|und|and|dann|then)$/u.test(w)) continue;
    // Ein fremdes Wort mitten in der Nummer: Das war keine Nummer.
    return null;
  }
  if (digits.length < 6 || digits.length > 20) return null;
  return (plus ? "+" : "") + digits;
}

// ------------------------------------------------------------- Skip

const SKIP_RE =
  /^(?:(?:nein|nee|nö|no|nope)[,\s]*)?(?:nein|nee|nö|keine?|keins|nichts|nix|nicht nötig|nicht noetig|weiter|überspringen|ueberspringen|weglassen|ohne|lieber nicht|danke|nein danke|no|none|nothing|skip|next|not needed|no thanks|no thank you|thanks)[.!\s]*$/iu;

/** „Keine.“, „Nein danke.“, „Weiter.“ – die Patientin lässt ein optionales Feld aus. */
export function isSkip(text: string): boolean {
  return SKIP_RE.test(text.trim());
}

// -------------------------------------------------------------- Ja/Nein

const YES_RE = /^(?:(?:ja|jawohl|genau|richtig|stimmt|korrekt|passt|okay|ok|yes|yeah|yep|correct|right|exactly)[.!,\s]*)+$/iu;
const NO_RE = /^(?:(?:nein|nee|nö|falsch|nicht richtig|stimmt nicht|no|nope|wrong|incorrect)[.!,\s]*)+$/iu;

/** Eine kurze Rückfrage („richtig?“) beantworten: ja, nein, oder unklar. */
export function spokenYesNo(text: string): "yes" | "no" | null {
  const s = text.trim();
  if (YES_RE.test(s)) return "yes";
  if (NO_RE.test(s)) return "no";
  return null;
}
