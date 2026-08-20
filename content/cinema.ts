/**
 * Textplan des Filmwerks – EIN expliziter Plan, ein Text je Szene.
 *
 * Warum explizit: Film und Detailsektionen benennen dieselben Themen aus
 * verschiedenen Blickwinkeln (Szene 04 „Beschwerden“ trägt z. B. das
 * Praxis-Intro UND den Symptom-Zyklus). Ein Lookup per id griffe daneben.
 *
 * Jeder Eintrag gehört zu genau einer Szene aus lib/cinema/frames.ts
 * (gleiche Reihenfolge, gleiche ids – wird beim Modul-Laden geprüft).
 * Kein Text wird in Frames gebacken – alles bleibt DOM (Zugänglichkeit,
 * SEO, scharfe Typografie).
 */

import type { StateTextContent } from "@/components/cinema/layers/StateText";
import { benefits, benefitsIntro } from "@/content/benefits";
import { beschwerden, beschwerdenIntro } from "@/content/beschwerden";
import { bookingSteps, terminSection } from "@/content/booking";
import { diagnostikIntro } from "@/content/diagnostik";
import { heroBeats } from "@/content/hero";
import { leistungen, leistungenIntro } from "@/content/leistungen";
import { intro } from "@/content/sections";
import { teamIntro } from "@/content/team";
import { SCENES } from "@/lib/cinema/frames";

function beat(id: string) {
  const found = heroBeats.find((b) => b.id === id);
  if (!found) throw new Error(`Kein Hero-Beat „${id}“`);
  return found;
}

/** Die neun Texte des Films – Reihenfolge = SCENES (8 Szenen + Finale). */
export const CINEMA_TEXTS: StateTextContent[] = [
  // 01 – Willkommen (H1)
  {
    kicker: beat("willkommen").kicker,
    headline: beat("willkommen").headline,
    text: beat("willkommen").text,
    cta: beat("willkommen").cta,
  },
  // 02 – Dr. Kunstreich
  {
    kicker: beat("arzt").kicker,
    headline: beat("arzt").headline,
    text: beat("arzt").text,
    secondary: beat("arzt").secondary,
  },
  // 03 – Leistungen (die acht Tafeln trägt der Korridor rechts)
  {
    kicker: leistungenIntro.kicker,
    headline: ["Unser proktologisches", "Leistungsspektrum"],
    text: leistungenIntro.text,
    secondary: { label: "Alle Leistungen im Detail", href: "/#leistungen" },
  },
  // 04 – Beschwerden: Praxis-Intro (wortgleich) + Symptom-Zyklus rechts
  {
    kicker: intro.kicker,
    headline: ["Beschwerden im Analbereich sind häufig –", "und in den meisten Fällen gut behandelbar"],
    headlineSize: "md",
    text: beschwerdenIntro.lead,
    secondaryText: intro.paragraphs[1],
  },
  // 05 – Diagnostik (der echte Untersuchungsraum trägt die Szene)
  {
    kicker: diagnostikIntro.kicker,
    headline: ["Moderne Diagnostik –", "behutsam und gründlich"],
    headlineSize: "md",
    text: diagnostikIntro.lead,
    secondary: { label: "So läuft die Untersuchung ab", href: "/#diagnostik" },
  },
  // 06 – Behandlung
  {
    kicker: beat("behandlung").kicker,
    headline: beat("behandlung").headline,
    text: beat("behandlung").text,
    items: beat("behandlung").items,
  },
  // 07 – Warum diese Praxis / Team (Vertrauensargumente aus content/benefits.ts)
  {
    kicker: benefitsIntro.kicker,
    headline: [teamIntro.title.replace(/\.$/, "")],
    text: teamIntro.text,
    items: [
      { title: benefits[0].title, note: benefits[0].text },
      { title: benefits[3].title, note: benefits[3].text },
      { title: benefits[5].title, note: benefits[5].text },
    ],
    secondary: teamIntro.cta,
  },
  // 08 – Praxis & Standort
  {
    kicker: beat("praxis").kicker,
    headline: beat("praxis").headline,
    text: beat("praxis").text,
  },
  // FINAL – Termin
  {
    kicker: beat("termin").kicker,
    headline: beat("termin").headline,
    text: beat("termin").text,
    cta: beat("termin").cta,
    secondary: beat("termin").secondary,
  },
];

const EXPECTED_IDS = [
  "willkommen",
  "arzt",
  "leistungen",
  "beschwerden",
  "diagnostik",
  "behandlung",
  "team",
  "praxis",
  "termin",
];
if (
  CINEMA_TEXTS.length !== SCENES.length ||
  SCENES.some((s, i) => s.id !== EXPECTED_IDS[i])
) {
  throw new Error("content/cinema.ts und SCENES sind auseinandergelaufen");
}

/** Die acht Tafeln des Leistungs-Korridors (Szene 03). */
export const CINEMA_PANELS = leistungen.map((l, i) => ({
  number: String(i + 1).padStart(2, "0"),
  title: l.title,
  teaser: l.teaser,
}));

/**
 * Die vier Symptom-Karten des Typo-Zyklus (Szene 04).
 *
 * Bewusst MIT dem Rat: In der Quelle gehört zu jeder beruhigenden
 * Einordnung untrennbar die Handlungsempfehlung – beim Blut-Cluster der
 * Hinweis, dass Blut immer ärztlich abgeklärt werden sollte. Nur die
 * beruhigende Hälfte zu zeigen wäre eine medizinische Verkürzung.
 */
export const CINEMA_SYMPTOME = beschwerden.map((b) => ({
  symptom: b.symptom,
  text: b.text,
  advice: b.advice,
}));

/** Die Buchungs-Vorschau (Finale) – zeigt, was unten wirklich wartet. */
export const CINEMA_TERMIN = {
  kicker: terminSection.kicker,
  title: terminSection.title,
  text: terminSection.text,
  steps: bookingSteps.map((s, i) => ({
    number: String(i + 1).padStart(2, "0"),
    label: s.short,
  })),
  cta: { label: "Zur Terminbuchung", href: "/#kontakt" },
};
