import { PRAXIS_WISSEN, type Topic } from "../../content/praxis-wissen.ts";
import type { Lang } from "./language.ts";
import { fold } from "./normalize.ts";

/**
 * Antworten auf Praxisfragen – ausschließlich aus gepflegten Fakten.
 *
 * Das Sprachmodell darf diese Fakten höchstens umformulieren, nie ergänzen.
 * Deshalb gibt es `groundingCheck`: Enthält eine Modellantwort eine Zahl,
 * die in den Fakten nicht vorkommt (eine erfundene Uhrzeit etwa), wird sie
 * verworfen und der nüchterne Faktentext genommen.
 *
 * Öffnungszeiten kommen NICHT aus der Datei, sondern live aus der
 * Datenbank – dieselbe Quelle, aus der die Buchung ihre Slots rechnet.
 * So kann der Chat keine Zeiten nennen, zu denen niemand buchen kann.
 */
export type { Topic };

const WEEKDAYS: Record<Lang, string[]> = {
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

export interface HoursRow {
  /** 1 = Montag … 7 = Sonntag */
  weekday: number;
  opens: string;
  closes: string;
}

/**
 * Sprechzeiten in einem Satz: gleiche Tage werden zusammengefasst, damit
 * daraus „Mo, Mi, Fr 7–12 Uhr · Di, Do 7–12 und 14–18 Uhr“ wird und keine
 * Liste aus sieben Zeilen.
 */
export function formatHours(rows: HoursRow[], lang: Lang): string {
  if (rows.length === 0) return lang === "de" ? "Dazu liegen mir keine Sprechzeiten vor." : "I have no opening hours on file.";
  const byDay = new Map<number, string[]>();
  for (const r of [...rows].sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens))) {
    const list = byDay.get(r.weekday) ?? [];
    list.push(`${r.opens}–${r.closes}`);
    byDay.set(r.weekday, list);
  }
  // Tage mit identischen Zeitfenstern bündeln
  const groups = new Map<string, number[]>();
  for (const [day, windows] of byDay) {
    const key = windows.join(", ");
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }
  const short = (d: number) => WEEKDAYS[lang][d - 1]!.slice(0, lang === "de" ? 2 : 3);
  const parts = [...groups.entries()].map(([windows, days]) => `${days.map(short).join(", ")} ${windows}`);
  return lang === "de" ? `${parts.join(" · ")} Uhr` : parts.join(" · ");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trifft ein Stichwort? Kurze Stichwörter (bis vier Zeichen) nur als
 * ganzes Wort – sonst wäre „weg“ in „wegen“ und „auto“ in „automatisch“
 * ein Treffer. Längere gelten als Wortanfang, damit „parkpl“ auch
 * „Parkplätze“ und „absag“ auch „absagen“ findet. Mehrwortausdrücke
 * werden am Wortanfang gesucht.
 */
export function keywordHits(text: string, keyword: string): boolean {
  // Beide Seiten gefaltet: Wer „Oeffnungszeiten" oder „oeffnungszeiten"
  // tippt, meint dasselbe wie „Öffnungszeiten" – und die Tippfehler-
  // Korrektur liefert ohnehin nur die gefaltete Schreibweise.
  const kw = fold(keyword).trim();
  if (!kw) return false;
  const body = escapeRe(kw);
  const re = kw.length <= 4 && !kw.includes(" ") ? new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, "iu") : new RegExp(`(?<!\\p{L})${body}`, "iu");
  return re.test(fold(text));
}

/**
 * Wörter, mit denen nach dem Leistungsangebot gefragt wird („Behandeln Sie
 * Fisteln?"). Sie führen auf das Thema `leistungen` – dort steht auch die
 * ehrliche Grenze, dass die komplette Darmspiegelung nicht hier stattfindet.
 *
 * Zweierlei ist beim Pflegen zu beachten:
 *
 *  - **Wortanfang-Regel.** „fissur" trifft NICHT „Analfissur". Deshalb steht
 *    jede Zusammensetzung, die Patientinnen wirklich schreiben, einzeln.
 *  - **Keine Symptome.** „Blut", „Schmerzen", „Juckreiz" gehören nicht
 *    hierher: Das sind Gesundheitsangaben, die der Sicherheitsfilter vor dem
 *    Wissen abfängt. Ein Fachwort wie „Fistel" ist dagegen eine Frage nach
 *    dem Angebot – und die darf beantwortet werden.
 */
export const SERVICE_TERMS: string[] = [
  // Krankheitsbilder
  "hämorrhoid", "haemorrhoid", "hemorrhoid", "hemorroid",
  "fissur", "analfissur", "fissure",
  "fistel", "analfistel", "fistula",
  "mariske", "marisken", "skin tag",
  "abszess", "analabszess", "abscess",
  "analvenenthrombose", "thrombose", "thrombosis",
  // Diagnostik
  "proktoskop", "proctoscop", "rektoskop", "rectoscop",
  "enddarm", "darmspiegelung", "koloskop", "colonoscop", "sigmoidoskop", "bowel screening",
  // Vorsorge
  "krebsvorsorge", "darmkrebs", "enddarmkrebs", "vorsorge", "cancer screening",
  // Behandlung
  "ambulant", "outpatient", "operation", "operativ", "eingriff",
  "gummibandligatur", "ligatur", "verödung", "veroedung", "sklerosierung", "banding",
];

/** Welche Themen berührt die Frage? Reihenfolge = Reihenfolge der Fakten. */
export function findTopics(text: string, lang: Lang): Topic[] {
  const t = fold(text);
  const found: Topic[] = [];
  // Die Stichwörter beider Sprachen zählen: Wer die Oberfläche auf Englisch
  // gestellt hat und trotzdem „Wann haben Sie geöffnet?“ tippt, bekommt die
  // Sprechzeiten – auf Englisch, denn `lang` bestimmt nur die Antwort.
  const own = PRAXIS_WISSEN;
  for (const key of Object.keys(own) as Topic[]) {
    const words = lang === "de" ? [...own[key].keywords.de, ...own[key].keywords.en] : [...own[key].keywords.en, ...own[key].keywords.de];
    if (words.some((w) => keywordHits(t, w))) found.push(key);
  }
  // „Behandeln Sie Fisteln?“ – ein Fachwort führt auf das Leistungsspektrum.
  // Bewusst hier und nicht in den Stichwörtern der Praxis: So bleibt die
  // gepflegte Liste kurz und die lange Fachwortliste getrennt davon.
  if (!found.includes("leistungen") && SERVICE_TERMS.some((w) => keywordHits(t, w))) found.push("leistungen");
  return found;
}

export interface FactAnswer {
  /** Fertiger Antworttext aus den Fakten – leer, wenn nichts bekannt ist. */
  text: string;
  /** Die einzelnen Fakten – Grundlage für das Modell und die Nachprüfung. */
  facts: string[];
  /** Themen, zu denen die Praxis nichts hinterlegt hat. */
  unknown: Topic[];
}

export interface LiveFacts {
  /** Sprechzeiten aus der Datenbank, schon formatiert. */
  hoursText: string;
  /** Hinweistext der Praxis (Urlaub o. Ä.), wenn gesetzt. */
  banner: string | null;
  /**
   * Termindauern aus der Datenbank. Die Website nennt keine – die Zahl steht
   * je Terminart in `appointment_types.duration_min`. Fehlt sie, bleibt das
   * Thema „dauer" ehrlich unbeantwortet statt geraten.
   */
  durations?: Array<{ label: string; durationMin: number }>;
  /** Die schon genannte Terminart, falls im Gespräch bekannt. */
  typeLabel?: string | null;
}

export function answerFromFacts(topics: Topic[], lang: Lang, live: LiveFacts): FactAnswer {
  const facts: string[] = [];
  const unknown: Topic[] = [];
  for (const topic of topics) {
    if (topic === "oeffnungszeiten") {
      facts.push(lang === "de" ? `Sprechzeiten: ${live.hoursText}.` : `Opening hours: ${live.hoursText}.`);
      continue;
    }
    // Die Termindauer ist keine Textzeile, sondern eine Zahl aus der
    // Datenbank – und je Terminart eine andere. Ist die Terminart schon
    // bekannt, wird sie genannt; sonst die Spanne.
    if (topic === "dauer") {
      const rows = live.durations ?? [];
      if (rows.length === 0) {
        unknown.push(topic);
        continue;
      }
      const chosen = live.typeLabel ? rows.find((r) => r.label === live.typeLabel) : undefined;
      if (chosen) {
        facts.push(
          lang === "de"
            ? `Für „${chosen.label}“ planen wir ${chosen.durationMin} Minuten ein.`
            : `For “${chosen.label}” we schedule ${chosen.durationMin} minutes.`,
        );
        continue;
      }
      const min = Math.min(...rows.map((r) => r.durationMin));
      const max = Math.max(...rows.map((r) => r.durationMin));
      facts.push(
        min === max
          ? lang === "de"
            ? `Für einen Termin planen wir ${min} Minuten ein.`
            : `We schedule ${min} minutes for an appointment.`
          : lang === "de"
            ? `Je nach Terminart planen wir ${min} bis ${max} Minuten ein.`
            : `Depending on the appointment type we schedule ${min} to ${max} minutes.`,
      );
      continue;
    }
    const value = PRAXIS_WISSEN[topic][lang];
    if (value) facts.push(value);
    else unknown.push(topic);
  }
  if (live.banner) facts.push(live.banner);
  return { text: facts.join(" "), facts, unknown };
}

/**
 * Nachprüfung einer Modellantwort: Sie darf nur sagen, was in den Fakten
 * steht. Geprüft wird das Nachweisbare – Zahlen und Links. Erfindet das
 * Modell eine Uhrzeit („bis 19:30“) oder eine fremde Adresse, fällt die
 * Antwort durch und der Faktentext wird genommen.
 */
export function groundingCheck(answer: string, facts: string[]): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  // Höchstens drei Sätze – der Auftrag verlangt kurze Antworten
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 3) return false;

  const haystack = facts.join(" ");
  // Jede Zahlengruppe der Antwort muss in den Fakten vorkommen
  for (const num of trimmed.match(/\d+(?:[.:,]\d+)*/g) ?? []) {
    if (!haystack.includes(num)) return false;
  }
  // Keine Links, die nicht aus den Fakten stammen
  for (const url of trimmed.match(/https?:\/\/\S+/g) ?? []) {
    if (!haystack.includes(url.replace(/[.,;)]+$/, ""))) return false;
  }
  return true;
}
