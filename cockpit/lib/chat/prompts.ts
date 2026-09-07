import { z } from "zod";
import type { Lang } from "./language.ts";
import type { LlmCall } from "./llm.ts";

/**
 * Was das Sprachmodell zu sehen bekommt – und was nicht.
 *
 * Zwei Aufgaben, mehr nicht:
 *  1. KLASSIFIZIEREN: Aus einem freien Satz die Absicht, die Sprache und
 *     eventuelle Angaben zu Terminart, Datum und Uhrzeit lesen – als
 *     striktes JSON, das anschließend gegen Zod geprüft wird.
 *  2. FORMULIEREN: Aus vorgegebenen Fakten einen freundlichen Satz machen.
 *     Fakten hinzuerfinden ist verboten und wird nachgeprüft.
 *
 * Buchen, Verfügbarkeit, Zusammenfassung und Bestätigung entscheidet das
 * Modell NIE – das macht der Automat in orchestrator.ts.
 *
 * ModelView hat bewusst kein Feld für Name, E-Mail oder Telefon. Diese
 * Daten werden über Formularfelder erfasst und gehen direkt an die
 * Buchung; sie können den Modellpfad gar nicht erreichen, weil der Typ
 * sie nicht kennt.
 */

/** Erste Zeile des Systemtexts – der Test-Server erkennt daran die Aufgabe. */
export const CLASSIFY_MARK = "[CLASSIFY]";
export const GROUND_MARK = "[GROUND]";

export interface ModelView {
  stage: string;
  lang: Lang;
  /** Bereits maskierter und gefilterter Text der Patientin. */
  text: string;
  /** Bezeichnungen der buchbaren Terminarten, damit das Modell zuordnen kann. */
  typeLabels: string[];
  /** Heutiges Datum (YYYY-MM-DD) und Wochentag – für „morgen“, „Dienstag“. */
  today: string;
  weekday: string;
}

export const classificationSchema = z.object({
  intent: z.enum(["booking", "hours", "directions", "info", "handover", "forward", "yes", "no", "other"]),
  lang: z.enum(["de", "en"]),
  /** Terminart, wie sie die Patientin genannt hat – wird später zugeordnet. */
  type: z.string().max(40).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  topics: z.array(z.string().max(30)).max(4),
});
export type Classification = z.infer<typeof classificationSchema>;

export function classifyPrompt(view: ModelView): LlmCall {
  const system = [
    CLASSIFY_MARK,
    "Du ordnest Nachrichten an eine Arztpraxis ein. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Text davor oder danach.",
    "",
    "Felder:",
    '  intent: "booking" (Termin vereinbaren), "hours" (Öffnungszeiten), "directions" (Anfahrt/Adresse),',
    '          "info" (andere Frage zur Praxis), "handover" (will einen Menschen sprechen),',
    '          "forward" (Rezept, Krankschreibung, Befund, Überweisung), "yes", "no", "other"',
    '  lang: "de" oder "en" – die Sprache der Nachricht',
    "  type: die genannte Terminart als Text, sonst null",
    "  date: Datum als YYYY-MM-DD, sonst null",
    "  time: Uhrzeit als HH:MM (24 Stunden), sonst null",
    "  topics: bis zu vier Stichwörter der Frage, sonst []",
    "",
    `Heute ist ${view.weekday}, ${view.today} (Europe/Berlin).`,
    `Buchbare Terminarten: ${view.typeLabels.join("; ")}.`,
    "",
    "Regeln: Rate nicht. Was nicht dasteht, ist null. Gib keine medizinische Einschätzung ab.",
  ].join("\n");
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: view.text },
    ],
    temperature: 0,
    maxTokens: 200,
    json: true,
  };
}

/** Antwort aus vorgegebenen Fakten formulieren – nichts hinzufügen. */
export function groundPrompt(question: string, facts: string[], lang: Lang): LlmCall {
  const system =
    lang === "de"
      ? [
          GROUND_MARK,
          "Du bist die Empfangskraft einer Arztpraxis. Antworte höflich, knapp und in der Sie-Form.",
          "Höchstens drei Sätze. Nutze AUSSCHLIESSLICH die folgenden Fakten.",
          "Erfinde nichts – keine Uhrzeiten, keine Adressen, keine Preise, keine Links, die unten nicht stehen.",
          "Gib keine medizinischen Auskünfte.",
          "",
          "Fakten:",
          ...facts.map((f) => `- ${f}`),
        ].join("\n")
      : [
          GROUND_MARK,
          "You are the receptionist of a medical practice. Answer politely and briefly, using formal address.",
          "At most three sentences. Use ONLY the facts below.",
          "Invent nothing – no times, addresses, prices or links that are not listed.",
          "Give no medical information.",
          "",
          "Facts:",
          ...facts.map((f) => `- ${f}`),
        ].join("\n");
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: question },
    ],
    temperature: 0.2,
    maxTokens: 220,
  };
}

/** JSON aus der Modellantwort lesen – auch wenn es in ```-Zäunen steckt. */
export function parseClassification(text: string): Classification | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = classificationSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
