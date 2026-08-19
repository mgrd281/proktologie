/**
 * Textplan der Kamerafahrt – EIN expliziter Plan statt Nachschlagen per id.
 *
 * Warum explizit: Die Fahrt und die Detailsektionen benennen dieselben
 * Themen aus verschiedenen Blickwinkeln. `heroBeats` enthält z. B. einen
 * Beat „beschwerden“ mit Symptom-Inhalt – der Zustand 02 „Beschwerden“
 * trägt aber das Praxis-Intro („Ihre Praxis für Proktologie in Hamburg“).
 * Ein Lookup per id griffe hier zwangsläufig daneben.
 *
 * Jeder Eintrag gehört zu genau einem Textband aus lib/cinema/timeline.ts
 * (gleiche Reihenfolge, gleiche ids – wird beim Modul-Laden geprüft).
 */

import type { StateTextContent } from "@/components/cinema/layers/StateText";
import { beschwerden, beschwerdenIntro } from "@/content/beschwerden";
import { bookingSteps, terminSection } from "@/content/booking";
import { diagnostikIntro } from "@/content/diagnostik";
import { heroBeats } from "@/content/hero";
import { leistungen, leistungenIntro } from "@/content/leistungen";
import { intro } from "@/content/sections";
import { teamIntro } from "@/content/team";
import { TEXT_BANDS } from "@/lib/cinema/timeline";

function beat(id: string) {
  const found = heroBeats.find((b) => b.id === id);
  if (!found) throw new Error(`Kein Hero-Beat „${id}“`);
  return found;
}

/**
 * Die zehn Texte der Fahrt (Zustand 01 trägt zwei: Willkommen, dann Arzt).
 * Reihenfolge = TEXT_BANDS.
 */
export const CINEMA_TEXTS: StateTextContent[] = [
  // 01a – Willkommen (H1)
  {
    kicker: beat("willkommen").kicker,
    headline: beat("willkommen").headline,
    text: beat("willkommen").text,
    cta: beat("willkommen").cta,
  },
  // 01b – Dr. Kai Kunstreich
  {
    kicker: beat("arzt").kicker,
    headline: beat("arzt").headline,
    text: beat("arzt").text,
    secondary: beat("arzt").secondary,
  },
  // 02 – Beschwerden: das Praxis-Intro, wortgleich übernommen
  {
    kicker: intro.kicker,
    headline: ["Beschwerden im Analbereich sind häufig –", "und in den meisten Fällen gut behandelbar"],
    headlineSize: "md",
    text: intro.paragraphs[0],
  },
  // 03 – Leistungen (die acht Tafeln trägt der Korridor rechts)
  {
    kicker: leistungenIntro.kicker,
    headline: ["Unser proktologisches", "Leistungsspektrum"],
    text: leistungenIntro.text,
    secondary: { label: "Alle Leistungen im Detail", href: "/#leistungen" },
  },
  // 04 – Symptome (die vier Cluster zyklieren rechts)
  {
    kicker: beschwerdenIntro.kicker,
    headline: ["Was Sie bemerken –", "und was dahinterstecken kann"],
    headlineSize: "md",
    text: beschwerdenIntro.lead,
    secondary: { label: "Beschwerden im Überblick", href: "/#beschwerden" },
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
  // 07 – Team
  {
    kicker: teamIntro.kicker,
    headline: [teamIntro.title.replace(/\.$/, "")],
    text: teamIntro.text,
    secondary: teamIntro.cta,
  },
  // 08 – Praxis
  {
    kicker: beat("praxis").kicker,
    headline: beat("praxis").headline,
    text: beat("praxis").text,
  },
  // 09 – Termin
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
  "beschwerden",
  "leistungen",
  "symptome",
  "diagnostik",
  "behandlung",
  "team",
  "praxis",
  "termin",
];
if (
  CINEMA_TEXTS.length !== TEXT_BANDS.length ||
  TEXT_BANDS.some((b, i) => b.id !== EXPECTED_IDS[i])
) {
  throw new Error("content/cinema.ts und TEXT_BANDS sind auseinandergelaufen");
}

/** Die acht Tafeln des Leistungs-Korridors (Zustand 03). */
export const CINEMA_PANELS = leistungen.map((l, i) => ({
  number: String(i + 1).padStart(2, "0"),
  title: l.title,
  teaser: l.teaser,
}));

/** Die vier Symptom-Karten des Typo-Zyklus (Zustand 04). */
export const CINEMA_SYMPTOME = beschwerden.map((b) => ({
  symptom: b.symptom,
  text: b.text,
}));

/** Die Buchungs-Vorschau (Zustand 09) – zeigt, was unten wirklich wartet. */
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
