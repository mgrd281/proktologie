/**
 * Vom Bildschirm zur Stimme.
 *
 * Der Assistent formuliert seine Sätze für ein Fenster mit Schaltflächen:
 * „07:15 Uhr“, „PE-4F7K“, „nutzen Sie die Schaltflächen unten“. Am Telefon
 * ist davon fast jeder zweite Satz falsch – „112“ würde als
 * „hundertzwölf“ vorgelesen, eine Referenz als Kauderwelsch, und
 * Schaltflächen gibt es nicht.
 *
 * Dieses Modul übersetzt einen fertigen Antworttext in gesprochene Form.
 * Es entscheidet nichts und erfindet nichts: Es macht dieselbe Aussage
 * hörbar. Reine Funktionen, kein Anbieter, kein Netz – deshalb gilt sie
 * für jede Sprachtechnik, die wir später anschließen.
 *
 * Ausführen:  node --test lib/chat/speech.test.mjs
 */

export type Lang = "de" | "en";

export type Channel = "phone" | "web";

export interface SpeechOptions {
  /** Am Telefon gibt es keinen Bildschirm – manche Sätze müssen anders lauten. */
  channel?: Channel;
  /** Referenzen buchstabieren wie am Telefon üblich: „P wie Paula“. */
  phonetic?: boolean;
}

// ------------------------------------------------------------- Zahlen

const DE_UNITS = [
  "null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
  "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn",
];
const DE_TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

const EN_UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Zahlwort für 0 bis 99. Größeres bleibt Ziffer – dafür gibt es hier keinen Anlass. */
export function numberWord(n: number, lang: Lang): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (lang === "en") {
    if (n < 20) return EN_UNITS[n]!;
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? EN_TENS[t]! : `${EN_TENS[t]}-${EN_UNITS[u]}`;
  }
  if (n < 20) return DE_UNITS[n]!;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return DE_TENS[t]!;
  // 21 heißt „einundzwanzig“, nicht „einsundzwanzig“
  return `${u === 1 ? "ein" : DE_UNITS[u]}und${DE_TENS[t]}`;
}

/** Ziffern einzeln – so werden Notrufnummern und Telefonnummern verstanden. */
export function digitsSpoken(digits: string, lang: Lang): string {
  const table = lang === "en" ? EN_UNITS : DE_UNITS;
  return [...digits.replace(/\D/g, "")].map((d) => table[Number(d)]!).join(" ");
}

/** „07:15“ → „sieben Uhr fünfzehn“, „09:00“ → „neun Uhr“. */
export function timeSpoken(hhmm: string, lang: Lang): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return hhmm;
  if (lang === "en") return min === 0 ? `${numberWord(h, "en")} o'clock` : `${numberWord(h, "en")} ${numberWord(min, "en")}`;
  return min === 0 ? `${numberWord(h, "de")} Uhr` : `${numberWord(h, "de")} Uhr ${numberWord(min, "de")}`;
}

// -------------------------------------------------------- Buchstabieren

/**
 * Deutsches Buchstabieralphabet, die geläufige Fassung mit Vornamen. Die
 * Neufassung mit Städtenamen (DIN 5009:2022) kennt am Telefon kaum jemand;
 * wer eine Referenz notiert, versteht „P wie Paula“ sofort.
 */
const SPELLING_DE: Record<string, string> = {
  A: "Anton", B: "Berta", C: "Cäsar", D: "Dora", E: "Emil", F: "Friedrich", G: "Gustav", H: "Heinrich",
  I: "Ida", J: "Julius", K: "Kaufmann", L: "Ludwig", M: "Martha", N: "Nordpol", O: "Otto", P: "Paula",
  Q: "Quelle", R: "Richard", S: "Samuel", T: "Theodor", U: "Ulrich", V: "Viktor", W: "Wilhelm",
  X: "Xanthippe", Y: "Ypsilon", Z: "Zacharias",
};

const SPELLING_EN: Record<string, string> = {
  A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel",
  I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa",
  Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

/**
 * Eine Referenz wie „PE-4F7K“ hörbar machen. Ohne `phonetic` werden die
 * Zeichen einzeln genannt; mit `phonetic` so, wie man sie jemandem
 * durchgibt, der mitschreibt.
 */
export function refSpoken(ref: string, lang: Lang, phonetic = false): string {
  const table = lang === "en" ? SPELLING_EN : SPELLING_DE;
  const like = lang === "en" ? "as in" : "wie";
  const parts: string[] = [];
  for (const ch of ref.toUpperCase()) {
    if (ch === "-") continue;
    if (ch >= "0" && ch <= "9") parts.push(numberWord(Number(ch), lang));
    else if (table[ch]) parts.push(phonetic ? `${ch} ${like} ${table[ch]}` : ch);
    else parts.push(ch);
  }
  return parts.join(", ");
}

/** „erika@example.de“ → buchstabiert, mit „at“ und „Punkt“. */
export function emailSpoken(email: string, lang: Lang, phonetic = false): string {
  const table = lang === "en" ? SPELLING_EN : SPELLING_DE;
  const like = lang === "en" ? "as in" : "wie";
  const at = lang === "en" ? "at" : "at";
  const dot = lang === "en" ? "dot" : "Punkt";
  const dash = lang === "en" ? "dash" : "Bindestrich";
  const under = lang === "en" ? "underscore" : "Unterstrich";
  const parts: string[] = [];
  for (const raw of email.trim()) {
    const ch = raw.toUpperCase();
    if (raw === "@") parts.push(at);
    else if (raw === ".") parts.push(dot);
    else if (raw === "-") parts.push(dash);
    else if (raw === "_") parts.push(under);
    else if (ch >= "0" && ch <= "9") parts.push(numberWord(Number(ch), lang));
    else if (table[ch]) parts.push(phonetic ? `${ch} ${like} ${table[ch]}` : ch);
    else parts.push(raw);
  }
  return parts.join(", ");
}

// ---------------------------------------------------- Bildschirm-Sätze

/**
 * Wendungen, die nur vor einem Bildschirm stimmen. Am Telefon gibt es
 * keine Schaltflächen und niemand „schreibt“ etwas.
 */
const SCREENISMS: Record<Lang, Array<[RegExp, string]>> = {
  de: [
    [/\s*[–-]\s*oder nutzen Sie die Schaltflächen unten\.?/giu, "."],
    [/\s*oder nutzen Sie die Schaltflächen unten\.?/giu, "."],
    [/\s*Oder nutzen Sie die Schaltflächen unten\.?/gu, ""],
    [/Bitte schreiben Sie hier keine gesundheitlichen Details/giu, "Bitte nennen Sie mir keine gesundheitlichen Details"],
    [/Bitte tragen Sie noch Ihre Kontaktdaten ein/giu, "Dafür brauche ich noch Ihren Namen und Ihre E-Mail-Adresse"],
    [/Bitte tragen Sie Ihren Namen und Ihre Telefonnummer ein/giu, "Dafür brauche ich Ihren Namen und Ihre Telefonnummer"],
    [/hier im Chat/giu, "am Telefon"],
    [/in diesem Chat/giu, "hier"],
    [/Dieser Chat kann keine Notfallhilfe leisten\./giu, "Ich kann Ihnen hier nicht weiterhelfen."],
    [/Über den Chat kann ich/giu, "Ich kann"],
    [/Der Chat ist im Moment nicht verfügbar\./giu, "Der Terminassistent ist im Moment nicht verfügbar."],
    [/\bklicken Sie\b/giu, "sagen Sie"],
  ],
  en: [
    [/\s*[–-]\s*or use the buttons below\.?/giu, "."],
    [/\s*or use the buttons below\.?/giu, "."],
    [/Please do not write any health details here/giu, "Please do not tell me any health details"],
    [/here in the chat/giu, "on the phone"],
    [/in this chat/giu, "here"],
    [/This chat cannot provide emergency help\./giu, "I cannot help you with that here."],
    [/\bclick\b/giu, "say"],
  ],
};
const REF_RE = /\b(?:PE|AN|WL)-[A-Z0-9]{4,6}\b/gu;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gu;
/** Uhrzeit samt nachfolgendem "Uhr" - sonst kaeme "neun Uhr Uhr" heraus. */
const TIME_RE = /(?<!\d)(\d{1,2}:\d{2})(?!\d)(?:\s*Uhr\b)?/gu;
/** Zeitspannen wie Sprechzeiten: "07:00-12:00" ist "von sieben bis zwoelf". */
const RANGE_RE = /(?<!\d)(\d{1,2}:\d{2})\s*[\u2013\u2014-]\s*(\d{1,2}:\d{2})(?!\d)(?:\s*Uhr\b)?/gu;
/** 112 und 116 117 - als Zahl gelesen waeren sie im Notfall wertlos. */
const RESCUE_RE = /(?<!\d)(?:116\s*117|112)(?!\d)/gu;
/** Telefonnummern: Zifferngruppen mit Trenner, also nicht "14. Juli 2026". */
const PHONE_RE = /(?<![\d/])(?:\+49\s*)?0?\d{2,5}(?:[\s/-]\d{2,4}){1,4}(?![\d/])/gu;
const URL_RE = /https?:\/\/\S+/gu;

/**
 * Ein Antworttext, hoerbar gemacht. Die Aussage bleibt gleich; nur ihre
 * Form aendert sich. Nichts wird hinzugefuegt, was der Assistent nicht
 * ohnehin gesagt hat.
 *
 * Fertig uebersetzte Stellen werden zwischengelegt, damit eine spaetere
 * Regel sie nicht ein zweites Mal anfasst. Ein Datum wie "14. Juli 2026"
 * bleibt deshalb unberuehrt - gesprochen wird es ohnehin richtig, als
 * Ziffernfolge waere es unverstaendlich.
 */
export function toSpeech(text: string, lang: Lang, options: SpeechOptions = {}): string {
  const phonetic = options.phonetic ?? false;
  const phone = (options.channel ?? "phone") === "phone";
  const kept: string[] = [];
  const keep = (s: string): string => {
    kept.push(s);
    return ` \u0000${kept.length - 1}\u0000 `;
  };
  let out = text;

  // 1. Links haben in gesprochener Sprache nichts verloren; der Kanal
  //    reicht sie ohnehin getrennt weiter.
  out = out.replace(URL_RE, "");

  // 2. Referenzen und E-Mail-Adressen buchstabieren, bevor irgendeine
  //    Zahlenregel sie zerlegt.
  out = out.replace(REF_RE, (m) => keep(refSpoken(m, lang, phonetic)));
  out = out.replace(EMAIL_RE, (m) => keep(emailSpoken(m, lang, phonetic)));

  // 3. Notrufnummern zuerst - sie duerfen nie in die Telefonregel geraten.
  out = out.replace(RESCUE_RE, (m) => keep(digitsSpoken(m, lang)));

  // 4. Zeitspannen zuerst, damit aus Sprechzeiten kein Aufzaehlungspaar wird.
  out = out.replace(RANGE_RE, (_m, from: string, to: string) =>
    keep(lang === "en" ? `from ${timeSpoken(from, lang)} to ${timeSpoken(to, lang)}` : `von ${timeSpoken(from, lang)} bis ${timeSpoken(to, lang)}`),
  );

  // 5. Einzelne Uhrzeiten sprechen.
  out = out.replace(TIME_RE, (_m, hhmm: string) => keep(timeSpoken(hhmm, lang)));

  // 6. Telefonnummern als Ziffernfolge.
  out = out.replace(PHONE_RE, (m) => keep(digitsSpoken(m, lang)));

  // 7. Bildschirm-Wendungen ersetzen - nur, wo es keinen Bildschirm gibt.
  const all = SCREENISMS[lang];
  const rules = phone ? all : all.slice(0, 2);
  for (const [re, replacement] of rules) out = out.replace(re, replacement);

  // 8. Gedankenstriche werden zu Pausen, doppelte Leerzeichen verschwinden.
  out = out.replace(/\s*[\u2013\u2014]\s*/gu, ", ");
  out = out
    .replace(/[ \t]+/gu, " ")
    .replace(/\s+([,.!?])/gu, "$1")
    .replace(/,\s*\./gu, ".")
    .trim();

  // 9. Das Zwischengelegte zurueckholen.
  return out.replace(/\u0000(\d+)\u0000/gu, (_m, i: string) => kept[Number(i)] ?? "").replace(/[ ]{2,}/gu, " ").trim();
}

/**
 * Aus Schaltflaechen wird ein Satz: "Sagen Sie einfach: Termin,
 * Oeffnungszeiten oder Anfahrt." Ohne Schaltflaechen bleibt es still.
 */
export function optionsSpoken(labels: string[], lang: Lang): string {
  const clean = labels.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return lang === "en" ? `Just say: ${clean[0]}.` : `Sagen Sie einfach: ${clean[0]}.`;
  const last = clean[clean.length - 1]!;
  const head = clean.slice(0, -1).join(", ");
  return lang === "en" ? `Just say: ${head} or ${last}.` : `Sagen Sie einfach: ${head} oder ${last}.`;
}
