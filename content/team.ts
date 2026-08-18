/**
 * Praxisteam – Datenquelle der Sektion „Unser Praxisteam".
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │ WICHTIG: KEINE ERFUNDENEN PERSONENANGABEN.                        │
 * │                                                                   │
 * │ Namen, Rollen, Kurzprofile und Sprachen der Mitarbeiterinnen und  │
 * │ Mitarbeiter sind derzeit NICHT bestätigt. Sie stehen deshalb      │
 * │ bewusst auf `null` bzw. sind leer – es wurde nichts geraten,      │
 * │ abgeleitet oder generiert.                                        │
 * │                                                                   │
 * │ So werden echte Daten ergänzt: einfach `name`, `role`, `bio` und  │
 * │ `languages` beim jeweiligen Eintrag füllen. Die Karten zeigen die │
 * │ Angaben dann automatisch statt des neutralen Labels „Praxisteam"; │
 * │ am Code muss nichts geändert werden.                              │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Bilder: je Porträt zwei WebP-Breiten unter public/images/team/
 * (`portrait-N-420.webp` und `portrait-N-840.webp`, Seitenverhältnis 4:5).
 * Jedes der sechs Fotos wird genau einmal verwendet – eine Person pro Karte.
 */

export interface TeamMember {
  /** Stabiler Schlüssel (React-Key, keine Personenangabe). */
  id: string;
  /** Basispfad ohne Größensuffix, z. B. "/images/team/portrait-1" */
  image: string;
  /** NICHT ERFUNDEN – null, bis von der Praxis bestätigt. */
  name: string | null;
  /** NICHT ERFUNDEN – null, bis von der Praxis bestätigt. */
  role: string | null;
  /** NICHT ERFUNDEN – null, bis von der Praxis bestätigt. */
  bio: string | null;
  /** NICHT ERFUNDEN – leer, bis von der Praxis bestätigt. */
  languages: string[];
  /**
   * Neutraler Alt-Text ohne Personenbezug. Bewusst geschlechtsneutral
   * formuliert: Auch das Geschlecht der abgebildeten Personen ist nicht
   * bestätigt und wird daher nicht behauptet.
   */
  alt: string;
}

/** Anzeige-Label, solange keine echten Namen/Rollen vorliegen. */
export const TEAM_PLACEHOLDER_LABEL = "Praxisteam";

/** Bildmaße der Quelldateien – gegen Layout-Shift (4:5). */
export const TEAM_IMAGE_WIDTH = 840;
export const TEAM_IMAGE_HEIGHT = 1050;

export const teamIntro = {
  kicker: "Unser Team",
  title: "Persönlich für Sie da.",
  text: "Unser eingespieltes Praxisteam begleitet Sie diskret, aufmerksam und mit viel Erfahrung – vom ersten Kontakt bis zur Behandlung und Nachsorge.",
};

export const team: TeamMember[] = [
  {
    id: "praxisteam-01",
    image: "/images/team/portrait-1",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Mitglied des Praxisteams der Proktologie Eimsbüttel",
  },
  {
    id: "praxisteam-02",
    image: "/images/team/portrait-2",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Porträt eines Mitglieds des Praxisteams der Proktologie Eimsbüttel",
  },
  {
    id: "praxisteam-03",
    image: "/images/team/portrait-3",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Mitglied des Praxisteams der Proktologie Eimsbüttel in der Praxis",
  },
  {
    id: "praxisteam-04",
    image: "/images/team/portrait-4",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Porträt eines Mitglieds des Praxisteams in Hamburg-Eimsbüttel",
  },
  {
    id: "praxisteam-05",
    image: "/images/team/portrait-5",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Mitglied des Praxisteams der Proktologie Eimsbüttel",
  },
  {
    id: "praxisteam-06",
    image: "/images/team/portrait-6",
    name: null,
    role: null,
    bio: null,
    languages: [],
    alt: "Porträt eines Mitglieds des Praxisteams der Proktologie Eimsbüttel",
  },
];
