/**
 * Die sieben Erzähl-Beats des cinematischen Heros.
 * Reihenfolge und Indizes steuern die Scroll-Choreografie.
 */

import { site } from "@/content/site";

export interface HeroBeatContent {
  /** ASCII-ID, dient auch als React-Key */
  id: string;
  /** Anzeige im Fortschritts-Indikator, z. B. „Willkommen" */
  label: string;
  /** Kleiner Kicker über der Headline */
  kicker: string;
  /** Headline-Zeilen (Serif, groß) */
  headline: string[];
  /** 1–2 ruhige Sätze */
  text: string;
  /** Optionale CTA */
  cta?: { label: string; href: string };
  /** Optionaler Sekundär-Link */
  secondary?: { label: string; href: string };
  /** Stichpunkte / Chips (z. B. Beschwerden-Begriffe) */
  items?: { title: string; note: string }[];
}

export const heroBeats: HeroBeatContent[] = [
  {
    id: "willkommen",
    label: "Willkommen",
    kicker: "Willkommen in Hamburg",
    headline: ["Proktologie", "Eimsbüttel"],
    text: "Moderne Proktologie, diskret, vertrauensvoll und patientenorientiert.",
    cta: { label: "Termin vereinbaren", href: "/#kontakt" },
  },
  {
    id: "arzt",
    label: "Dr. Kunstreich",
    kicker: "Ihr Facharzt",
    headline: ["Dr. Kai", "Kunstreich"],
    text: "Erfahrung, Sorgfalt und ein offenes Ohr: Bei mir sind Sie mit Ihren Beschwerden gut aufgehoben – von der ersten Frage bis zur Nachsorge.",
    secondary: { label: "Über den Arzt", href: "/#ueber-den-arzt" },
  },
  {
    id: "beschwerden",
    label: "Beschwerden",
    kicker: "Wir nehmen Ihre Beschwerden ernst",
    headline: ["Häufig – und", "gut behandelbar"],
    text: "Beschwerden im Analbereich sind weit verbreitet. Die meisten lassen sich heute schonend und wirksam behandeln.",
    items: [
      { title: "Hämorrhoiden", note: "stadiengerechte, schonende Behandlung" },
      { title: "Analfissur", note: "sorgfältige Abklärung und Therapie" },
      { title: "Analfistel", note: "erfahrene, individuelle Versorgung" },
      { title: "Marisken", note: "diskrete Beratung und Behandlung" },
    ],
  },
  {
    id: "diagnostik",
    label: "Diagnostik",
    kicker: "Moderne Diagnostik",
    headline: ["Klarheit schafft", "Vertrauen"],
    text: "Eine präzise Diagnose ist der erste Schritt zur richtigen Behandlung – behutsam, gründlich und auf dem Stand der modernen Medizin.",
    items: [
      { title: "Proktoskopie", note: "schonende Untersuchung des Analkanals" },
      { title: "Rektoskopie", note: "Blick auf den Enddarm, wenn nötig" },
      { title: "Individuelle Abklärung", note: "Schritt für Schritt erklärt" },
    ],
  },
  {
    id: "behandlung",
    label: "Behandlung",
    kicker: "Individuelle Behandlung",
    headline: ["So viel wie nötig,", "so schonend wie möglich"],
    text: "Konservativ, wo es sinnvoll ist – ambulant-operativ, wo es nötig ist. Immer abgestimmt auf Ihre Situation.",
    items: [
      { title: "Beratung", note: "verständlich und auf Augenhöhe" },
      { title: "Therapie", note: "moderne, bewährte Verfahren" },
      { title: "Nachsorge", note: "begleitet bis zur Genesung" },
    ],
  },
  {
    id: "praxis",
    label: "Praxis",
    kicker: "Ihre Praxis in Eimsbüttel",
    headline: ["Ankommen und", "gut aufgehoben sein"],
    text: "Ruhige Räume, kurze Wege und ein Team, das auf Diskretion achtet – mitten in Hamburg-Eimsbüttel.",
    secondary: { label: "Praxis & Anfahrt", href: "/#praxis" },
  },
  {
    id: "termin",
    label: "Termin",
    kicker: "Ihr nächster Schritt",
    headline: ["Der erste Schritt", "ist einfach"],
    text: "Vereinbaren Sie einen Termin – telefonisch oder über unser Kontaktformular. Wir kümmern uns um den Rest.",
    cta: { label: "Termin vereinbaren", href: "/#kontakt" },
    // Nummer kommt zentral aus content/site.ts – hier nichts pflegen
    secondary: { label: `${site.phone} anrufen`, href: site.phoneHref },
  },
];
