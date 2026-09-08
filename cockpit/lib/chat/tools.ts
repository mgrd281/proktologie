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
  /** Zeiten eines Tages – seitenweise, damit „gibt es was später?" eine Antwort hat. */
  | { kind: "day_slots"; date: string; slots: string[]; total: number; page: number; hasMore: boolean; hasEarlier: boolean; window?: { from: string; to: string } | null }
  | { kind: "day_empty"; date: string; nextDays: Array<{ date: string; slots: string[] }> }
  | { kind: "next_days"; days: Array<{ date: string; slots: string[] }> }
  /** Der früheste freie Platz – die Antwort auf „so früh wie möglich". */
  | { kind: "earliest"; date: string; time: string }
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
  args: { art: string; datum?: string | null; uhrzeit?: string | null; fenster?: { from: string; to: string } | null; seite?: number | null },
  ctx: ToolContext,
): Promise<SlotAnswer> {
  try {
    const live = await liveOrReason();
    if (!live.ok) return live.answer;

    const types = await publicTypeList();
    if (!types.some((t) => t.id === args.art)) return { kind: "unavailable", reason: "unknown_type" };

    // Ohne Datum: die nächsten Tage mit freien Zeiten
    if (!args.datum) return naechsteTage(args.art, ctx, undefined, args.fenster ?? null);

    const heute = dateKey(ctx.now);
    if (args.datum < heute) return { kind: "unavailable", reason: "past" };

    const all = (await repo.availability(args.art, args.datum, ctx.now)).map((s) => s.time);
    // Ein genanntes Fenster ist ein Wunsch, kein Vorschlag: Wer „nur
    // nachmittags" sagt, will nicht sieben Uhr angeboten bekommen.
    const slots = inWindow(all, args.fenster ?? null);

    if (args.uhrzeit) {
      if (slots.includes(args.uhrzeit)) return { kind: "time_free", date: args.datum, time: args.uhrzeit };
      // Nicht frei: die nächstgelegenen Zeiten desselben Tages anbieten
      const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const wanted = minutes(args.uhrzeit);
      const alternatives = [...slots].sort((a, b) => Math.abs(minutes(a) - wanted) - Math.abs(minutes(b) - wanted)).slice(0, MAX_ALTERNATIVES).sort();
      return { kind: "time_taken", date: args.datum, time: args.uhrzeit, alternatives };
    }

    if (slots.length === 0) {
      const next = await naechsteTage(args.art, { ...ctx, now: ctx.now }, args.datum, args.fenster ?? null);
      return { kind: "day_empty", date: args.datum, nextDays: next.kind === "next_days" ? next.days : [] };
    }
    // Seitenweise: „gibt es was später?" heißt eine Seite weiter, nicht
    // dieselben fünf Zeiten noch einmal. Eine Seite hinter dem Ende gibt
    // es nicht – dann bleibt die letzte, und der Assistent sagt das.
    const pages = Math.max(1, Math.ceil(slots.length / MAX_SLOTS));
    const page = Math.min(pages, Math.max(1, Math.trunc(args.seite ?? 1)));
    const start = (page - 1) * MAX_SLOTS;
    return {
      kind: "day_slots",
      date: args.datum,
      slots: slots.slice(start, start + MAX_SLOTS),
      total: slots.length,
      page,
      hasMore: page < pages,
      hasEarlier: page > 1,
      window: args.fenster ?? null,
    };
  } catch {
    return { kind: "unavailable", reason: "error" };
  }
}

/** Nur die Zeiten, die in ein gewünschtes Fenster fallen. */
function inWindow(slots: string[], fenster: { from: string; to: string } | null): string[] {
  if (!fenster) return slots;
  return slots.filter((t) => t >= fenster.from && t < fenster.to);
}

/**
 * „Wann haben Sie am ehesten etwas frei?“ – die Antwort auf „so früh wie
 * möglich". Ein Fenster („aber nachmittags") und ein frühester Tag
 * („nächste Woche") schränken ein, ohne die Frage zu ändern.
 */
export async function naechsterFreierTermin(
  args: { art: string; fenster?: { from: string; to: string } | null; ab?: string | null; bis?: string | null },
  ctx: ToolContext,
): Promise<SlotAnswer> {
  const days = await naechsteTage(args.art, ctx, args.ab ? addDays(args.ab, -1) : undefined, args.fenster ?? null, args.bis ?? null);
  if (days.kind !== "next_days") return days;
  const first = days.days.find((d) => d.slots.length > 0);
  if (!first || !first.slots[0]) return days;
  return { kind: "earliest", date: first.date, time: first.slots[0] };
}

async function naechsteTage(
  art: string,
  ctx: ToolContext,
  ab?: string,
  fenster: { from: string; to: string } | null = null,
  bis: string | null = null,
): Promise<SlotAnswer> {
  try {
    const live = await liveOrReason();
    if (!live.ok) return live.answer;
    const from = ab ? addDays(ab, 1) : dateKey(ctx.now);
    const horizon = (await publicTypeList()).find((t) => t.id === art)?.maxAheadDays ?? DEFAULT_HORIZON_DAYS;
    const to = bis && bis < addDays(dateKey(ctx.now), horizon) ? bis : addDays(dateKey(ctx.now), horizon);
    if (from > to) return { kind: "next_days", days: [] };
    const range = await repo.availabilityRange(art, from, to, ctx.now);
    const days = range
      .map((d) => ({ date: d.date, slots: inWindow(d.slots, fenster) }))
      .filter((d) => d.slots.length > 0)
      .slice(0, 3)
      .map((d) => ({ date: d.date, slots: d.slots.slice(0, MAX_SLOTS) }));
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
    case "earliest":
      return lang === "de"
        ? `Der früheste freie Termin ist ${day(a.date)} um ${a.time}${uhr}.`
        : `The earliest available appointment is ${day(a.date)} at ${a.time}.`;
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

/**
 * Datum und Uhrzeit lesen jetzt `datetime.ts` – dieselbe Aufgabe, aber mit
 * Monatsnamen, Zeitfenstern, Bereichen und einer Regel gegen jede Falle,
 * die der frühere Parser hier hatte. Zwei Parser nebeneinander, die sich
 * uneinig sein können, wären genau der Fehler, den Stufe 2 behoben hat.
 */
