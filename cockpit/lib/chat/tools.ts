import * as repo from "../booking/repo.ts";
import { addDays, dateKey, fmtLongDateLocale } from "../time.ts";
import { formatHours, type HoursRow } from "./knowledge.ts";
import type { Lang } from "./language.ts";

/**
 * Die Werkzeuge des Assistenten – ausschließlich lesend.
 *
 * Sie fragen dieselbe Verfügbarkeit ab, aus der die Website-Buchung ihre
 * Zeiten nimmt: Sprechzeiten, Ausnahmen, Belegung, Vorlauf und Horizont je
 * Terminart. Damit kann der Chat keine Zeit nennen, die es nicht gibt.
 *
 * Keine dieser Funktionen wirft. Geht etwas schief (Datenbank weg,
 * Buchung pausiert, unbekannte Terminart), kommt ein Ergebnis mit Grund
 * zurück – dann sagt der Assistent ehrlich, dass er gerade nicht
 * nachsehen kann, statt eine Fehlerseite zu zeigen.
 */
export interface ToolContext {
  now: Date;
  lang: Lang;
}

export type SlotAnswer =
  | { kind: "time_free"; date: string; time: string }
  | { kind: "time_taken"; date: string; time: string; alternatives: string[] }
  | { kind: "day_slots"; date: string; slots: string[] }
  | { kind: "day_empty"; date: string; nextDays: Array<{ date: string; slots: string[] }> }
  | { kind: "next_days"; days: Array<{ date: string; slots: string[] }> }
  | { kind: "unavailable"; reason: "not_live" | "paused" | "unknown_type" | "past" | "error"; banner?: string | null };

/** Wie viele Zeiten der Assistent höchstens auf einmal anbietet. */
const MAX_SLOTS = 5;
const MAX_ALTERNATIVES = 3;
/**
 * Rückfall, falls eine Terminart keinen eigenen Horizont hat. Die Buchung
 * erlaubt bis zu `maxAheadDays` je Terminart (Standard 56) – der Chat darf
 * nicht weniger anbieten als die Terminkarte der Website.
 */
const DEFAULT_HORIZON_DAYS = 56;

async function liveOrReason(): Promise<{ ok: true } | { ok: false; answer: SlotAnswer }> {
  const s = await repo.getSettings();
  if (!s.bookingLive) return { ok: false, answer: { kind: "unavailable", reason: "not_live" } };
  if (s.bookingPaused) return { ok: false, answer: { kind: "unavailable", reason: "paused", banner: s.bannerText } };
  return { ok: true };
}

/** Öffentlich buchbare Terminarten – dieselbe Auswahl wie auf der Website. */
export async function publicTypeList(): Promise<Array<{ id: string; label: string; durationMin: number; maxAheadDays: number }>> {
  try {
    const types = await repo.listTypes();
    return types
      .filter((t) => t.visibility === "public")
      .map((t) => ({ id: t.id, label: t.label, durationMin: t.durationMin, maxAheadDays: t.maxAheadDays ?? DEFAULT_HORIZON_DAYS }));
  } catch {
    return [];
  }
}

export async function praxisSprechzeiten(lang: Lang): Promise<string> {
  try {
    const rows = (await repo.listHours()) as HoursRow[];
    return formatHours(rows, lang);
  } catch {
    return formatHours([], lang);
  }
}

/**
 * „Ist Dienstag 14:30 frei?“ · „Was haben Sie am Dienstag?“ · „Wann geht es?“
 * Je nachdem, wie viel die Patientin schon gesagt hat.
 */
export async function verfuegbarkeitPruefen(
  args: { art: string; datum?: string | null; uhrzeit?: string | null },
  ctx: ToolContext,
): Promise<SlotAnswer> {
  try {
    const live = await liveOrReason();
    if (!live.ok) return live.answer;

    const types = await publicTypeList();
    if (!types.some((t) => t.id === args.art)) return { kind: "unavailable", reason: "unknown_type" };

    // Ohne Datum: die nächsten Tage mit freien Zeiten
    if (!args.datum) return naechsteTage(args.art, ctx);

    const heute = dateKey(ctx.now);
    if (args.datum < heute) return { kind: "unavailable", reason: "past" };

    const slots = (await repo.availability(args.art, args.datum, ctx.now)).map((s) => s.time);

    if (args.uhrzeit) {
      if (slots.includes(args.uhrzeit)) return { kind: "time_free", date: args.datum, time: args.uhrzeit };
      // Nicht frei: die nächstgelegenen Zeiten desselben Tages anbieten
      const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const wanted = minutes(args.uhrzeit);
      const alternatives = [...slots].sort((a, b) => Math.abs(minutes(a) - wanted) - Math.abs(minutes(b) - wanted)).slice(0, MAX_ALTERNATIVES).sort();
      return { kind: "time_taken", date: args.datum, time: args.uhrzeit, alternatives };
    }

    if (slots.length === 0) {
      const next = await naechsteTage(args.art, { ...ctx, now: ctx.now }, args.datum);
      return { kind: "day_empty", date: args.datum, nextDays: next.kind === "next_days" ? next.days : [] };
    }
    return { kind: "day_slots", date: args.datum, slots: slots.slice(0, MAX_SLOTS) };
  } catch {
    return { kind: "unavailable", reason: "error" };
  }
}

/** „Wann haben Sie am ehesten etwas frei?“ */
export async function naechsterFreierTermin(args: { art: string }, ctx: ToolContext): Promise<SlotAnswer> {
  return naechsteTage(args.art, ctx);
}

async function naechsteTage(art: string, ctx: ToolContext, ab?: string): Promise<SlotAnswer> {
  try {
    const live = await liveOrReason();
    if (!live.ok) return live.answer;
    const from = ab ? addDays(ab, 1) : dateKey(ctx.now);
    const horizon = (await publicTypeList()).find((t) => t.id === art)?.maxAheadDays ?? DEFAULT_HORIZON_DAYS;
    const to = addDays(dateKey(ctx.now), horizon);
    if (from > to) return { kind: "next_days", days: [] };
    const range = await repo.availabilityRange(art, from, to, ctx.now);
    const days = range.filter((d) => d.slots.length > 0).slice(0, 3).map((d) => ({ date: d.date, slots: d.slots.slice(0, MAX_SLOTS) }));
    return { kind: "next_days", days };
  } catch {
    return { kind: "unavailable", reason: "error" };
  }
}

/**
 * Antwort in Worte fassen – rein, ohne Datenbank, damit sich jeder Satz
 * einzeln prüfen lässt. Der Ton folgt dem Auftrag: höflich, knapp, Sie.
 */
export function renderSlotAnswer(a: SlotAnswer, lang: Lang, typeLabel: string, phone: string, now: Date): string {
  const day = (iso: string) => fmtLongDateLocale(new Date(`${iso}T12:00:00Z`), lang);
  const uhr = lang === "de" ? " Uhr" : "";
  const und = lang === "de" ? "und" : "and";
  const list = (times: string[]) =>
    times.length <= 1 ? times.join("") : `${times.slice(0, -1).join(", ")} ${und} ${times[times.length - 1]}`;

  switch (a.kind) {
    case "time_free":
      return lang === "de"
        ? `Ja, ${a.time}${uhr} am ${day(a.date)} ist frei.`
        : `Yes, ${a.time} on ${day(a.date)} is available.`;
    case "time_taken":
      if (a.alternatives.length === 0) {
        return lang === "de"
          ? `Nein, ${a.time}${uhr} ist an dem Tag nicht mehr frei – und sonst leider auch nichts.`
          : `No, ${a.time} is taken that day, and nothing else is free either.`;
      }
      return lang === "de"
        ? `Nein, ${a.time}${uhr} ist belegt – frei sind ${list(a.alternatives)}${uhr}.`
        : `No, ${a.time} is taken – ${list(a.alternatives)} are available.`;
    case "day_slots":
      return lang === "de"
        ? `Am ${day(a.date)} ist frei: ${list(a.slots)}${uhr}.`
        : `On ${day(a.date)} these times are free: ${list(a.slots)}.`;
    case "day_empty":
      if (a.nextDays.length === 0) {
        return lang === "de"
          ? `Am ${day(a.date)} ist leider nichts frei. Bitte rufen Sie uns an: ${phone}.`
          : `Nothing is free on ${day(a.date)}. Please call us: ${phone}.`;
      }
      return lang === "de"
        ? `Am ${day(a.date)} ist nichts frei. Frei wäre ${day(a.nextDays[0]!.date)} um ${list(a.nextDays[0]!.slots.slice(0, 3))}${uhr}.`
        : `Nothing is free on ${day(a.date)}. The next option is ${day(a.nextDays[0]!.date)} at ${list(a.nextDays[0]!.slots.slice(0, 3))}.`;
    case "next_days":
      if (a.days.length === 0) {
        return lang === "de"
          ? `Für „${typeLabel}“ sehe ich gerade keinen freien Termin. Bitte rufen Sie uns an: ${phone}.`
          : `I see no free appointment for “${typeLabel}” at the moment. Please call us: ${phone}.`;
      }
      return lang === "de"
        ? `Nächste freie Zeiten für „${typeLabel}“: ${a.days.map((d) => `${day(d.date)} ${list(d.slots.slice(0, 3))}${uhr}`).join("; ")}.`
        : `Next available times for “${typeLabel}”: ${a.days.map((d) => `${day(d.date)} ${list(d.slots.slice(0, 3))}`).join("; ")}.`;
    case "unavailable":
      if (a.reason === "paused") {
        const text = a.banner?.trim();
        if (text) return text;
        return lang === "de"
          ? `Die Online-Buchung ist vorübergehend pausiert. Bitte rufen Sie uns an: ${phone}.`
          : `Online booking is paused at the moment. Please call us: ${phone}.`;
      }
      if (a.reason === "past") {
        return lang === "de" ? "Dieses Datum liegt in der Vergangenheit. Welcher Tag passt Ihnen?" : "That date is in the past. Which day would suit you?";
      }
      return lang === "de"
        ? `Das kann ich gerade nicht nachsehen. Bitte rufen Sie uns an: ${phone}.`
        : `I cannot check that right now. Please call us: ${phone}.`;
  }
  // Unerreichbar – alle Fälle sind oben behandelt
  void now;
}

// ---------- Erkennung in freiem Text ----------

const TYPE_SYNONYMS: Array<{ id: string; words: string[] }> = [
  { id: "kontrolle", words: ["kontrolle", "kontrolltermin", "nachkontrolle", "check-up", "checkup", "check up", "follow-up appointment"] },
  {
    id: "erstuntersuchung",
    words: ["erstuntersuchung", "erstvorstellung", "erster termin", "neu", "neupatient", "noch nie", "ersten mal", "erste mal", "erstmals", "first", "initial", "new patient", "never been", "new here"],
  },
  { id: "nachsorge", words: ["nachsorge", "nachbehandlung", "aftercare", "follow-up", "follow up"] },
  { id: "unklar", words: ["unklar", "weiß nicht", "weiss nicht", "keine ahnung", "beratung", "not sure", "don't know", "dont know", "unclear"] },
  { id: "haemorrhoiden", words: ["hämorrhoid", "haemorrhoid", "hemorrhoid"] },
  { id: "analfissur", words: ["fissur", "fissure"] },
  { id: "analfistel", words: ["fistel", "fistula"] },
];

/**
 * Alle Wörter, mit denen Patientinnen eine buchbare Terminart benennen –
 * Bezeichnungen und Synonyme. Der Gesundheitsfilter nimmt sie aus, denn wer
 * „Hämorrhoiden“ schreibt, um den Termin zu wählen, drückt einen Knopf mit
 * Worten und gibt keine Gesundheitsangabe preis.
 */
export function typeTerms(types: Array<{ id: string; label: string }>): string[] {
  const out = new Set<string>();
  for (const type of types) {
    out.add(type.label);
    for (const syn of TYPE_SYNONYMS) if (syn.id === type.id) for (const w of syn.words) out.add(w);
  }
  return [...out];
}

/** Terminart aus dem Text lesen – erst Bezeichnung, dann Synonyme. */
export function matchType(text: string, types: Array<{ id: string; label: string }>, lang: Lang): string | null {
  const t = text.toLowerCase();
  for (const type of types) {
    if (t.includes(type.label.toLowerCase())) return type.id;
  }
  for (const syn of TYPE_SYNONYMS) {
    if (!types.some((x) => x.id === syn.id)) continue;
    if (syn.words.some((w) => t.includes(w))) return syn.id;
  }
  void lang;
  return null;
}

const WEEKDAY_WORDS: Record<string, number> = {
  montag: 1, monday: 1, mo: 1, mon: 1,
  dienstag: 2, tuesday: 2, di: 2, tue: 2,
  mittwoch: 3, wednesday: 3, mi: 3, wed: 3,
  donnerstag: 4, thursday: 4, do: 4, thu: 4,
  freitag: 5, friday: 5, fr: 5, fri: 5,
  samstag: 6, saturday: 6, sa: 6, sat: 6,
  sonntag: 7, sunday: 7, so: 7, sun: 7,
};

/** „morgen“, „Dienstag“, „12.3.“, „2026-03-12“, „next tuesday“. */
export function parseDateWords(text: string, now: Date, lang: Lang): string | null {
  const t = text.toLowerCase();
  const heute = dateKey(now);

  if (/(?<!\p{L})(heute|today)(?!\p{L})/u.test(t)) return heute;
  // „Guten Morgen“ ist ein Gruß, „morgens“ ein Tagesteil – nur das nackte „morgen“ ist ein Datum
  if (/(?<!\p{L})(?<!guten\s)(?<!guten )(morgen|tomorrow)(?!\p{L})/u.test(t) && !/übermorgen|uebermorgen/.test(t)) return addDays(heute, 1);
  if (/(?<!\p{L})(übermorgen|uebermorgen|day after tomorrow)(?!\p{L})/u.test(t)) return addDays(heute, 2);

  // ISO zuerst – eindeutig
  const iso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 12.3. / 12.03.2026 – deutsche Schreibweise
  const dmy = /(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?(?!\d)/.exec(t);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3] ? Number(dmy[3]) : new Date(`${heute}T12:00:00Z`).getUTCFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // Ohne Jahresangabe: ein bereits vergangenes Datum meint das nächste Jahr
      if (!dmy[3] && candidate < heute) return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return candidate;
    }
  }

  // Wochentag → nächstes Vorkommen (heute zählt nicht mit).
  // Kurzformen („Mo“, „Di“, „so“, „do“) sind im Fließtext gewöhnliche
  // Wörter – „so früh wie möglich“, „do i need“. Sie zählen nur mit Anlass:
  // nach „am/jeden/nächsten/…“, mit Punkt, oder als ganze Nachricht.
  for (const [word, weekday] of Object.entries(WEEKDAY_WORDS)) {
    if (word.length <= 3) {
      const english = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(word);
      if (english && lang !== "en") continue;
      const cue = new RegExp(`(?:^|(?<=\\b(?:am|jeden|nächsten|naechsten|diesen|kommenden|on|next|this)\\s))${word}(?:\\.|(?=\\s*$))`, "u");
      if (!cue.test(t.trim())) continue;
    } else if (!t.includes(word)) {
      continue;
    }
    for (let i = 1; i <= 7; i++) {
      const d = addDays(heute, i);
      const dow = ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      if (dow === weekday) return d;
    }
  }
  return null;
}

/** „14:30“, „14.30 Uhr“, „14 Uhr“, „halb drei“, „2:30 pm“. */
export function parseTimeWords(text: string): string | null {
  const t = text.toLowerCase();
  const pad = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // 2:30 pm / 2 pm
  const ampm = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?!\p{L})/u.exec(t);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? 0);
    if (h >= 1 && h <= 12) {
      if (ampm[3] === "pm" && h !== 12) h += 12;
      if (ampm[3] === "am" && h === 12) h = 0;
      return pad(h, m);
    }
  }

  // 14:30 oder 14.30 (Uhr)
  const hm = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/.exec(t);
  if (hm) return pad(Number(hm[1]), Number(hm[2]));

  // „14 Uhr“ / „at 14“
  const hOnly = /(?<!\d)([01]?\d|2[0-3])\s*(?:uhr|o'?clock)/.exec(t);
  if (hOnly) return pad(Number(hOnly[1]), 0);

  // „halb drei“ = 14:30, „viertel nach zwei“ = 14:15 – nur nachmittags sinnvoll
  const ZAHL: Record<string, number> = { eins: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12 };
  const halb = /halb\s+(\p{L}+)/u.exec(t);
  if (halb && ZAHL[halb[1]!] !== undefined) {
    const h = ZAHL[halb[1]!]!;
    return pad(h === 1 ? 12 : h - 1 + (h - 1 < 7 ? 12 : 0), 30);
  }
  const viertel = /viertel\s+(nach|vor)\s+(\p{L}+)/u.exec(t);
  if (viertel && ZAHL[viertel[2]!] !== undefined) {
    const base = ZAHL[viertel[2]!]!;
    const h = base < 7 ? base + 12 : base;
    return viertel[1] === "nach" ? pad(h, 15) : pad(h === 0 ? 23 : h - 1, 45);
  }
  return null;
}
