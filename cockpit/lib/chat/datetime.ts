/**
 * Wann der Patient kommen möchte.
 *
 * Menschen sagen nicht „2026-07-16". Sie sagen „Donnerstag", „übermorgen",
 * „am 3. Oktober", „nächste Woche Dienstag", „halb drei", „nach der
 * Arbeit", „so früh wie möglich". Dieses Modul macht daraus einen Tag,
 * eine Uhrzeit oder ein Zeitfenster – und, genauso wichtig, es macht aus
 * „Guten Morgen" **kein** Datum und aus „so früh wie möglich" **keinen**
 * Sonntag.
 *
 * Die Fallen sind der eigentliche Grund für dieses Modul. Der frühere
 * Parser las „so" als Sonntag, „do" als Donnerstag und „Morgen" im Gruß
 * als morgen – jedes Mal buchte der Assistent überzeugt den falschen Tag.
 * Deshalb steht hier zu jeder Regel, wogegen sie sich wehrt.
 *
 * Zwei Festlegungen, die überall gelten:
 *
 *  - **Ein Wochentag meint das nächste Vorkommen nach heute.** Wer am
 *    Montag „Montag" sagt, meint nicht heute, sondern in einer Woche.
 *  - **Zeitfenster werden auf die Sprechzeiten beschnitten.** „Nach 16
 *    Uhr" heißt 16 bis 18 Uhr, nicht bis Mitternacht; die Praxis hat
 *    nachts nicht offen, und ein Fenster bis Mitternacht wäre eine
 *    Zusage, die niemand einlöst.
 *
 * Reine Funktionen, ohne Datenbank und ohne Uhr im Modulrumpf.
 *
 * Ausführen:  node --test lib/chat/datetime.test.mjs
 */

import { addDays, dateKey, isoWeekday } from "../time.ts";

export type Lang = "de" | "en";

/** Erster und letzter möglicher Zeitpunkt eines Praxistages. */
export const DAY_START = "07:00";
export const DAY_END = "18:00";

export interface DateHit {
  /** Ein bestimmter Tag. */
  kind: "day" | "range" | "weekend";
  /** Bei `day`: der Tag. */
  date?: string;
  /** Bei `range`: von … bis, jeweils einschließlich. */
  from?: string;
  to?: string;
}

export interface TimeHit {
  /** Eine genaue Uhrzeit, ein Fenster, oder „so früh wie möglich". */
  kind: "exact" | "window" | "earliest";
  time?: string;
  from?: string;
  to?: string;
  /** Woher das Fenster kommt – nur für Protokoll und Tests. */
  label?: string;
}

// ------------------------------------------------------------- Hilfen

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => hhmm(Math.floor(m / 60), m % 60);

/** Auf die Sprechzeiten beschneiden. Ein Fenster außerhalb ist kein Fenster. */
function clamp(from: string, to: string): TimeHit | null {
  const a = Math.max(toMin(from), toMin(DAY_START));
  const b = Math.min(toMin(to), toMin(DAY_END));
  if (a >= b) return null;
  return { kind: "window", from: fromMin(a), to: fromMin(b) };
}

const WEEKDAYS: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6, sonntag: 7,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};

/** Kurzformen sind im Fließtext gewöhnliche Wörter und brauchen einen Anlass. */
const WEEKDAYS_SHORT: Record<string, number> = {
  mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7,
  mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, sun: 7,
};

const MONTHS: Record<string, number> = {
  januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, october: 10, december: 12,
  jan: 1, feb: 2, "mär": 3, mrz: 3, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};

/** Das nächste Vorkommen dieses Wochentags – heute zählt nicht mit. */
function nextWeekday(today: string, weekday: number): string {
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, i);
    if (isoWeekday(day) === weekday) return day;
  }
  return today;
}

/** Montag der Woche, in der `day` liegt. */
function mondayOf(day: string): string {
  return addDays(day, 1 - isoWeekday(day));
}

/** Montag bis Freitag einer Woche – am Wochenende ist geschlossen. */
function workWeek(monday: string): DateHit {
  return { kind: "range", from: monday, to: addDays(monday, 4) };
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Letzter Tag eines Monats, ohne Bibliothek. */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ------------------------------------------------------------- Datum

/**
 * Wörter, die wie ein Datum aussehen, aber keines sind. Sie werden vor
 * jeder Prüfung entfernt, damit keine Regel darauf anspringt.
 */
const DATE_DECOYS =
  /(?<!\p{L})(?:guten\s+(?:morgen|tag|abend)|good\s+(?:morning|afternoon|evening)|morgens|abends|mittags|vormittags|nachmittags|so\s+(?:früh|frueh|schnell|bald)|as\s+soon|do\s+i|do\s+you|do\s+we|so\s+dass|so\s+viel|so\s+weit)(?!\p{L})/giu;

export function parseDate(text: string, now: Date, lang: Lang): DateHit | null {
  const today = dateKey(now);
  const raw = text.toLowerCase();
  const t = raw.replace(DATE_DECOYS, " ");

  // 1. Ausdrücklich benannte Tage.
  if (/(?<!\p{L})(?:übermorgen|uebermorgen|day after tomorrow)(?!\p{L})/u.test(t)) return { kind: "day", date: addDays(today, 2) };
  if (/(?<!\p{L})(?:heute|today)(?!\p{L})/u.test(t)) return { kind: "day", date: today };
  // „morgen" ja, „morgens" nein – deshalb die rechte Wortgrenze.
  if (/(?<!\p{L})(?:morgen|tomorrow)(?!\p{L})/u.test(t)) return { kind: "day", date: addDays(today, 1) };

  // 2. Eindeutige Schreibweisen zuerst, damit keine Wortregel dazwischenfunkt.
  const iso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(t);
  if (iso) return { kind: "day", date: `${iso[1]}-${iso[2]}-${iso[3]}` };

  // 16.7. · 16.07.2026 · 16/07/2026 – Tag zuerst, wie in Deutschland üblich.
  const numeric = /(?<!\d)(\d{1,2})[./](\d{1,2})[./]?(?:\s?(\d{4}))?(?!\d)/.exec(t);
  if (numeric && !/\d{1,2}[.:]\d{2}\s*(?:uhr|h)\b/.test(t)) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = numeric[3] ? Number(numeric[3]) : Number(today.slice(0, 4));
      const candidate = ymd(year, month, day);
      // Ohne Jahr meint ein vergangenes Datum das nächste Jahr.
      return { kind: "day", date: !numeric[3] && candidate < today ? ymd(year + 1, month, day) : candidate };
    }
  }

  // 3. Monatsnamen: „3. Oktober", „16. Juli", „October 3rd", „16th of July".
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const dayThenMonth = new RegExp(`(?<!\\d)(\\d{1,2})\\.?\\s*(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthNames})(?!\\p{L})`, "u").exec(t);
  const monthThenDay = new RegExp(`(?<!\\p{L})(${monthNames})\\s+(\\d{1,2})(?:\\s*(?:st|nd|rd|th))?(?!\\d)`, "u").exec(t);
  const named = dayThenMonth
    ? { day: Number(dayThenMonth[1]), month: MONTHS[dayThenMonth[2]!]! }
    : monthThenDay
      ? { day: Number(monthThenDay[2]), month: MONTHS[monthThenDay[1]!]! }
      : null;
  if (named && named.day >= 1 && named.day <= lastDay(Number(today.slice(0, 4)), named.month)) {
    const year = Number(today.slice(0, 4));
    const candidate = ymd(year, named.month, named.day);
    return { kind: "day", date: candidate < today ? ymd(year + 1, named.month, named.day) : candidate };
  }

  // 4. „in drei Tagen", „in 3 days"
  const inDays = /(?<!\p{L})in\s+(\d{1,2}|einem|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|a|two|three|four|five|six|seven)\s+(?:tagen|tage|days|day)(?!\p{L})/u.exec(t);
  if (inDays) {
    const n = wordNumber(inDays[1]!);
    if (n !== null) return { kind: "day", date: addDays(today, n) };
  }

  // 5. Wochenbezüge. „nächste Woche Dienstag" ist ein Tag, „nächste Woche"
  //    allein ein Bereich – deshalb erst der Wochentag, dann der Bereich.
  const thisWeek = /(?<!\p{L})(?:diese|dieser)\s+woche|(?<!\p{L})this\s+week/u.test(t);
  const nextWeek = /(?<!\p{L})(?:nächste|naechste|nächster|kommende|kommender)\s+woche|(?<!\p{L})next\s+week/u.test(t);
  const inTwoWeeks = /(?<!\p{L})(?:in\s+(?:zwei|2)\s+wochen|übernächste\s+woche|uebernaechste\s+woche|in\s+two\s+weeks)(?!\p{L})/u.test(t);

  // „von Dienstag auf Donnerstag verschieben" meint den Donnerstag. Ohne
  // diese Regel gewinnt der zuerst genannte Tag – und der Termin landet
  // wieder dort, wo er schon war.
  const moved = /(?<!\p{L})(?:von|from)\s+\p{L}+\s+(?:auf|an|to|until)\s+(\p{L}+)/u.exec(t);
  const weekday = (moved ? findWeekday(moved[1] ?? "", lang) : null) ?? findWeekday(t, lang);
  if (weekday !== null) {
    if (nextWeek || /(?<!\p{L})(?:nächsten|naechsten|kommenden|next)\s+\p{L}+/u.test(t)) {
      // „nächsten Dienstag" ist der Dienstag der nächsten Kalenderwoche.
      const monday = addDays(mondayOf(today), 7);
      return { kind: "day", date: addDays(monday, weekday - 1) };
    }
    if (inTwoWeeks) {
      const monday = addDays(mondayOf(today), 14);
      return { kind: "day", date: addDays(monday, weekday - 1) };
    }
    if (weekday >= 6) return { kind: "weekend" };
    return { kind: "day", date: nextWeekday(today, weekday) };
  }

  if (/(?<!\p{L})(?:am\s+)?wochenende|(?<!\p{L})(?:at\s+the\s+|on\s+the\s+)?weekend(?!\p{L})/u.test(t)) return { kind: "weekend" };

  if (inTwoWeeks) return workWeek(addDays(mondayOf(today), 14));
  if (nextWeek) return workWeek(addDays(mondayOf(today), 7));
  if (thisWeek) {
    // „diese Woche" heißt: ab heute bis Freitag – Vergangenes hilft niemandem.
    const friday = addDays(mondayOf(today), 4);
    return today <= friday ? { kind: "range", from: today, to: friday } : workWeek(addDays(mondayOf(today), 7));
  }

  // 6. „Ende der Woche", „Anfang Oktober"
  const endOfWeek = /(?<!\p{L})(?:ende\s+der\s+woche|end\s+of\s+the\s+week)(?!\p{L})/u.test(t);
  if (endOfWeek) {
    const monday = mondayOf(today);
    const from = addDays(monday, 3);
    return { kind: "range", from: from < today ? today : from, to: addDays(monday, 4) };
  }

  const part = new RegExp(`(?<!\\p{L})(anfang|mitte|ende|beginning of|middle of|end of)\\s+(${monthNames})(?!\\p{L})`, "u").exec(t);
  if (part) {
    const month = MONTHS[part[2]!]!;
    const year = Number(today.slice(0, 4)) + (ymd(Number(today.slice(0, 4)), month, 28) < today ? 1 : 0);
    const last = lastDay(year, month);
    const which = part[1]!;
    if (/anfang|beginning/.test(which)) return { kind: "range", from: ymd(year, month, 1), to: ymd(year, month, Math.min(10, last)) };
    if (/mitte|middle/.test(which)) return { kind: "range", from: ymd(year, month, 11), to: ymd(year, month, Math.min(20, last)) };
    return { kind: "range", from: ymd(year, month, Math.min(21, last)), to: ymd(year, month, last) };
  }

  return null;
}

/**
 * Einen Wochentag finden. Volle Namen zählen immer; Kurzformen nur mit
 * Anlass – ein Punkt dahinter, ein Signalwort davor, oder die ganze
 * Nachricht. Sonst wird aus „so früh wie möglich" ein Sonntag und aus
 * „do i need a referral" ein Donnerstag.
 */
function findWeekday(t: string, lang: Lang): number | null {
  for (const [word, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`(?<!\\p{L})${word}`, "u").test(t)) return weekday;
  }
  const trimmed = t.trim();
  for (const [word, weekday] of Object.entries(WEEKDAYS_SHORT)) {
    const english = word.length === 3 || word.length === 4;
    if (english && !WEEKDAYS_SHORT[word.slice(0, 2)] && lang !== "en") continue;
    if (word.length >= 3 && lang !== "en") continue;
    // Ohne Signalwort davor zählt die Kurzform nur mit Punkt („Sa. 10 Uhr")
    // oder als ganze Nachricht („do?"). Ein bloßes „so gegen halb zehn"
    // fängt zwar mit „so" an, meint aber keinen Sonntag.
    const cue = new RegExp(
      `(?:(?<=\\b(?:am|jeden|nächsten|naechsten|diesen|kommenden|on|next|this)\\s)${word}(?:\\.|(?=\\s)|(?=\\s*$))|(?:^|(?<=\\s))${word}(?:\\.|(?=\\s*$)))`,
      "u",
    );
    if (cue.test(trimmed)) return weekday;
  }
  return null;
}

const WORD_NUMBERS: Record<string, number> = {
  ein: 1, eine: 1, einem: 1, einer: 1, eins: 1, a: 1, an: 1, one: 1,
  zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, "fünf": 5, fuenf: 5, five: 5,
  sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9,
  zehn: 10, ten: 10, elf: 11, eleven: 11, "zwölf": 12, zwoelf: 12, twelve: 12,
};

function wordNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return WORD_NUMBERS[word] ?? null;
}

// ------------------------------------------------------------ Uhrzeit

/** Feste Tagesteile, auf die Sprechzeiten bezogen. */
const DAYPARTS: Array<{ re: RegExp; from: string; to: string; label: string }> = [
  { re: /(?<!\p{L})(?:vormittags?|morgens|früh(?:morgens)?|frueh(?:morgens)?|am\s+vormittag|in\s+the\s+morning|mornings?\s+only|morning)(?!\p{L})/iu, from: "07:00", to: "12:00", label: "vormittags" },
  { re: /(?<!\p{L})(?:mittagspause|zur\s+mittagszeit|lunch\s*break|over\s+lunch|during\s+lunch)(?!\p{L})/iu, from: "12:00", to: "14:00", label: "mittags" },
  { re: /(?<!\p{L})(?:nachmittags?|am\s+nachmittag|in\s+the\s+afternoon|afternoons?)(?!\p{L})/iu, from: "12:00", to: "18:00", label: "nachmittags" },
  { re: /(?<!\p{L})(?:abends?|am\s+abend|spät(?:nachmittags)?|spaet|in\s+the\s+evening|evenings?)(?!\p{L})/iu, from: "16:00", to: "18:00", label: "abends" },
  { re: /(?<!\p{L})(?:nach\s+der\s+arbeit|nach\s+feierabend|after\s+work)(?!\p{L})/iu, from: "16:00", to: "18:00", label: "nach der Arbeit" },
];

const EARLIEST_RE =
  /(?<!\p{L})(?:so\s+(?:früh|frueh|schnell|bald)\s+wie\s+möglich|so\s+(?:früh|frueh|schnell|bald)\s+wie\s+moeglich|schnellst(?:möglich|moeglich)|frühest\p{L}*|fruehest\p{L}*|kurzfristig(?:es|en|e)?|asap|so\s+bald\s+wie\s+möglich|möglichst\s+(?:bald|früh|schnell)|moeglichst\s+(?:bald|frueh|schnell)|n(?:ä|ae)chst(?:er|en|e)\s+freie[rn]?\s+termin|erste[rn]?\s+freie[rn]?\s+termin|earliest(?:\s+possible)?|as\s+soon\s+as\s+possible|first\s+available|next\s+available)(?!\p{L})/iu;

/** Dieselbe Wendung, aber zum Herausschneiden. */
const EARLIEST_G = new RegExp(EARLIEST_RE.source, "giu");

/** Zahlwörter für Uhrzeiten – „halb drei", „viertel nach zwei". */
const CLOCK_WORDS: Record<string, number> = {
  eins: 1, ein: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8,
  neun: 9, zehn: 10, elf: 11, "zwölf": 12, zwoelf: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/**
 * Eine Stunde in die Sprechzeiten legen. „halb drei" ist 14:30, nicht
 * 2:30 – nachts hat niemand offen. Passt beides nicht, gilt die Zahl.
 */
function intoOpeningHours(h: number, m: number): { h: number; m: number } {
  const minutes = h * 60 + m;
  if (minutes >= toMin(DAY_START) && minutes <= toMin(DAY_END)) return { h, m };
  const pm = minutes + 12 * 60;
  if (h < 12 && pm >= toMin(DAY_START) && pm <= toMin(DAY_END)) return { h: h + 12, m };
  return { h, m };
}

function clockWord(word: string): number | null {
  if (/^\d{1,2}$/.test(word)) return Number(word);
  return CLOCK_WORDS[word] ?? null;
}

export function parseTime(text: string, lang: Lang): TimeHit | null {
  void lang;
  // „Dienstagnachmittag" ist ein Wort, aber zwei Angaben. Ohne diese
  // Trennung findet keine Tagesteil-Regel den Nachmittag.
  const t = text
    .toLowerCase()
    .replace(
      /(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|heute|morgen|übermorgen|uebermorgen|today|tomorrow)(vormittag|nachmittag|abend|morgen|mittag|früh|frueh)/giu,
      "$1 $2",
    );

  // „So früh wie möglich, am liebsten vormittags" ist beides: der früheste
  // Termin, aber nur im genannten Fenster. Der Wunsch nach dem Fenster
  // geht sonst verloren, und der Patient bekommt sieben Uhr angeboten,
  // obwohl er nachmittags gesagt hat.
  if (EARLIEST_RE.test(t)) {
    // Die Wendung selbst wird entfernt, bevor nach einem Tagesteil gesucht
    // wird: „so früh wie möglich" enthält das Wort „früh", meint aber nicht
    // den Vormittag. Wer es so liest, verschweigt einen freien Platz um
    // 14 Uhr, obwohl er der früheste ist.
    const rest = t.replace(EARLIEST_G, " ");
    for (const part of DAYPARTS) {
      if (part.re.test(rest)) {
        const win = clamp(part.from, part.to);
        if (win) return { kind: "earliest", from: win.from, to: win.to, label: part.label };
      }
    }
    return { kind: "earliest" };
  }

  const words = Object.keys(CLOCK_WORDS).sort((a, b) => b.length - a.length).join("|");

  // 1. Genaue Uhrzeiten in Ziffern: 14:30 · 14.30 Uhr · 2:30 pm
  const digital = /(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)\s*(uhr|h|am|pm)?/u.exec(t);
  if (digital && (digital[3] || digital[0].includes(":") || /uhr/.test(digital[0]))) {
    let h = Number(digital[1]);
    const m = Number(digital[2]);
    if (h <= 23 && m <= 59) {
      if (digital[3] === "pm" && h < 12) h += 12;
      if (digital[3] === "am" && h === 12) h = 0;
      const fixed = digital[3] ? { h, m } : intoOpeningHours(h, m);
      return { kind: "exact", time: hhmm(fixed.h, fixed.m) };
    }
  }

  // 2. „viertel nach zwei", „viertel vor zehn", „dreiviertel drei"
  const quarter = new RegExp(`(?<!\\p{L})(?:viertel\\s+(nach|vor)|quarter\\s+(past|to))\\s+(${words}|\\d{1,2})(?!\\p{L})`, "u").exec(t);
  if (quarter) {
    const base = clockWord(quarter[3]!);
    if (base !== null) {
      const before = quarter[1] === "vor" || quarter[2] === "to";
      const h = before ? (base === 1 ? 12 : base - 1) : base;
      const fixed = intoOpeningHours(h, before ? 45 : 15);
      return { kind: "exact", time: hhmm(fixed.h, fixed.m) };
    }
  }

  // 3. „halb drei" – im Deutschen die halbe Stunde VOR der genannten.
  const half = new RegExp(`(?<!\\p{L})(?:halb|half\\s+past)\\s+(${words}|\\d{1,2})(?!\\p{L})`, "u").exec(t);
  if (half) {
    const base = clockWord(half[1]!);
    if (base !== null) {
      const english = /half\s+past/.test(half[0]);
      const h = english ? base : base === 1 ? 12 : base - 1;
      const fixed = intoOpeningHours(h, 30);
      const time = hhmm(fixed.h, fixed.m);
      // „so gegen halb zehn" ist ein Fenster, kein Termin auf die Minute.
      if (/(?<!\p{L})(?:gegen|so\s+gegen|ungefähr|ungefaehr|etwa|around|about)(?!\p{L})/u.test(t)) {
        return clamp(fromMin(toMin(time) - 30), fromMin(toMin(time) + 30)) ?? { kind: "exact", time };
      }
      return { kind: "exact", time };
    }
  }

  // 4. Fenster mit Grenze: „zwischen 14 und 16", „nach 16 Uhr", „vor 9"
  const between = new RegExp(`(?<!\\p{L})(?:zwischen|between)\\s+(${words}|\\d{1,2})(?::(\\d{2}))?\\s*(?:uhr)?\\s*(?:und|and|-|bis|to)\\s*(${words}|\\d{1,2})(?::(\\d{2}))?`, "u").exec(t);
  if (between) {
    const a = clockWord(between[1]!);
    const b = clockWord(between[3]!);
    if (a !== null && b !== null) {
      const from = intoOpeningHours(a, Number(between[2] ?? 0));
      const to = intoOpeningHours(b, Number(between[4] ?? 0));
      const win = clamp(hhmm(from.h, from.m), hhmm(to.h, to.m));
      if (win) return { ...win, label: "zwischen" };
    }
  }

  const after = new RegExp(`(?<!\\p{L})(?:nach|ab|from|after)\\s+(${words}|\\d{1,2})(?::(\\d{2}))?\\s*(uhr|am|pm)?`, "u").exec(t);
  // Kein Ausschluss für „nach der Arbeit": Das Muster verlangt ohnehin
  // eine Zahl, und ein Satz kann beides enthalten – „Nach der Arbeit,
  // also ab 16 Uhr" nennt das Fenster ausdrücklich.
  if (after) {
    const base = clockWord(after[1]!);
    if (base !== null) {
      let h = base;
      if (after[3] === "pm" && h < 12) h += 12;
      const fixed = after[3] === "pm" ? { h, m: Number(after[2] ?? 0) } : intoOpeningHours(h, Number(after[2] ?? 0));
      const win = clamp(hhmm(fixed.h, fixed.m), DAY_END);
      if (win) return { ...win, label: "ab" };
    }
  }

  const before = new RegExp(`(?<!\\p{L})(?:vor|bis|before|until)\\s+(${words}|\\d{1,2})(?::(\\d{2}))?\\s*(uhr|am|pm)?`, "u").exec(t);
  if (before) {
    const base = clockWord(before[1]!);
    if (base !== null) {
      const fixed = intoOpeningHours(base, Number(before[2] ?? 0));
      const win = clamp(DAY_START, hhmm(fixed.h, fixed.m));
      if (win) return { ...win, label: "bis" };
    }
  }

  // 5. „gegen 10" – eine halbe Stunde in jede Richtung.
  const around = new RegExp(`(?<!\\p{L})(?:gegen|so\\s+gegen|ungefähr|ungefaehr|etwa|around|about)\\s+(${words}|\\d{1,2})(?::(\\d{2}))?\\s*(uhr)?`, "u").exec(t);
  if (around) {
    const base = clockWord(around[1]!);
    if (base !== null) {
      const fixed = intoOpeningHours(base, Number(around[2] ?? 0));
      const center = toMin(hhmm(fixed.h, fixed.m));
      const win = clamp(fromMin(center - 30), fromMin(center + 30));
      if (win) return { ...win, label: "gegen" };
    }
  }

  // 6. Nackte Stunde: „14 Uhr", „um 8", „at 9", „10 o'clock", „3 pm".
  //    Steht sie da, schlägt sie jeden Tagesteil: „Um 8 Uhr morgens" ist
  //    acht Uhr, nicht irgendwann am Vormittag.
  const bare = new RegExp(`(?<!\\p{L})(?:um|at)?\\s*(${words}|\\d{1,2})\\s*(uhr|o'?clock|am|pm)(?!\\p{L})`, "u").exec(t);
  if (bare) {
    const base = clockWord(bare[1]!);
    if (base !== null && base <= 23) {
      let h = base;
      if (bare[2] === "pm" && h < 12) h += 12;
      if (bare[2] === "am" && h === 12) h = 0;
      const fixed = bare[2] === "am" || bare[2] === "pm" ? { h, m: 0 } : intoOpeningHours(h, 0);
      return { kind: "exact", time: hhmm(fixed.h, fixed.m) };
    }
  }

  // 7. „um 10" ohne „Uhr" – nur mit dem Wörtchen „um"/„at" davor, sonst
  //    würde jede Hausnummer zur Uhrzeit.
  const withUm = new RegExp(`(?<!\\p{L})(?:um|at)\\s+(${words}|\\d{1,2})(?!\\s*(?:minuten|minute|tage|tagen|wochen))(?!\\p{L})(?!\\d)`, "u").exec(t);
  if (withUm) {
    const base = clockWord(withUm[1]!);
    if (base !== null && base <= 23) {
      const fixed = intoOpeningHours(base, 0);
      return { kind: "exact", time: hhmm(fixed.h, fixed.m) };
    }
  }

  // 8. Tagesteile – erst wenn keine Uhrzeit genannt wurde.
  for (const part of DAYPARTS) {
    if (part.re.test(t)) {
      const win = clamp(part.from, part.to);
      if (win) return { ...win, label: part.label };
    }
  }

  return null;
}
