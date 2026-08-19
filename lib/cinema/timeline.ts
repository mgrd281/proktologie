/**
 * Zeitachse der Kamerafahrt – reine Mathematik, kein DOM.
 *
 * Die Startseite ist EINE durchgehende Fahrt über neun Zustände; erst nach
 * dem Auslauf beginnt die normale Seite. Der Scroll steuert nur einen
 * Fortschritt 0–1; welche Ebene wann wie stark sichtbar ist, entscheidet
 * ausschließlich diese Datei.
 *
 * Der Kern ist `band()`: Jede Ebene hat ein Band, das FRÜHER beginnt und
 * SPÄTER endet als ihr Zustand. Dadurch überlappen sich benachbarte Szenen
 * immer – die nächste ist schon da, bevor die vorige gegangen ist. Genau
 * das unterscheidet eine Kamerafahrt von aneinandergereihten Sektionen.
 *
 * Weil hier nichts vom Browser abhängt, ist die Dramaturgie ohne Browser
 * prüfbar (siehe lib/cinema/timeline.test.mjs).
 */

export type StateId =
  | "willkommen"
  | "beschwerden"
  | "leistungen"
  | "symptome"
  | "diagnostik"
  | "behandlung"
  | "team"
  | "praxis"
  | "termin";

export interface SequenceState {
  id: StateId;
  /** Nummer und Label der durchgehenden Leiste. */
  label: string;
  /** Beginn/Ende auf der Master-Zeitachse (0–1). */
  from: number;
  to: number;
}

/** Die neun Zustände der Fahrt. Grenzen wie vom Nutzer vorgegeben. */
export const STATES: SequenceState[] = [
  { id: "willkommen", label: "Willkommen", from: 0.0, to: 0.1 },
  { id: "beschwerden", label: "Beschwerden", from: 0.1, to: 0.2 },
  { id: "leistungen", label: "Leistungen", from: 0.2, to: 0.31 },
  { id: "symptome", label: "Symptome", from: 0.31, to: 0.41 },
  { id: "diagnostik", label: "Diagnostik", from: 0.41, to: 0.52 },
  { id: "behandlung", label: "Behandlung", from: 0.52, to: 0.63 },
  { id: "team", label: "Team", from: 0.63, to: 0.79 },
  { id: "praxis", label: "Praxis", from: 0.79, to: 0.9 },
  { id: "termin", label: "Termin", from: 0.9, to: 1.0 },
];

export const STATE_COUNT = STATES.length;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Weiche Ein-/Ausblendung zwischen zwei Schwellen (Hermite). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Gewicht einer Ebene bei Fortschritt p:
 * 0 vor `inStart`, sanft auf 1 bis `inEnd`, 1 bis `outStart`,
 * sanft zurück auf 0 bis `outEnd`.
 */
export function band(
  p: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
): number {
  return smoothstep(inStart, inEnd, p) * (1 - smoothstep(outStart, outEnd, p));
}

/**
 * Überlappungsbreite an einer Zustandsgrenze, abhängig von der Breite des
 * Zustands: Schmale Zustände bekommen schmalere Blenden, sonst bestünden
 * sie fast nur noch aus Überblendung. Die Untergrenze hält die Blende weich
 * genug, dass kein sichtbarer Sprung entsteht.
 */
export function ov(width: number): number {
  return Math.min(0.035, Math.max(0.02, 0.3 * width));
}

/**
 * Zyklus INNERHALB einer Ebene: `count` gleich breite Fenster über den
 * lokalen Fortschritt 0–1, mit weicher Blende `overlap` zwischen den
 * Fenstern. Erstes Fenster ist von Anfang an voll da, letztes bleibt bis
 * zum Schluss – die Ebene selbst blendet ja bereits als Ganzes.
 * (Gemeinsame Primitive für Leistungs-Stationen und Symptom-Zyklus.)
 */
export function cycleWeight(
  local: number,
  index: number,
  count: number,
  overlap: number,
): number {
  const from = index / count;
  const to = (index + 1) / count;
  const inStart = index === 0 ? -1 : from - overlap;
  const inEnd = index === 0 ? 0 : from + overlap;
  const outStart = index === count - 1 ? 1.1 : to - overlap;
  const outEnd = index === count - 1 ? 1.2 : to + overlap;
  return band(local, inStart, inEnd, outStart, outEnd);
}

/**
 * Textbänder – bewusst von den Zuständen entkoppelt: Zustand 01 trägt ZWEI
 * Texte (Willkommen, dann Dr. Kunstreich), beide auf Leistenpunkt 01.
 *
 * Das erste Band klemmt seine Einblendung vor den Anfang (bei p = 0 steht
 * die H1 voll da – vorher stand sie durch die symmetrische Blende nur auf
 * halbem Gewicht), das letzte Band bleibt bis über das Ende hinaus.
 */
export interface TextBand {
  id: string;
  from: number;
  to: number;
  /** Zu welchem Leistenpunkt dieser Text gehört. */
  railIndex: number;
}

export const TEXT_BANDS: TextBand[] = [
  { id: "willkommen", from: 0.0, to: 0.05, railIndex: 0 },
  { id: "arzt", from: 0.05, to: 0.1, railIndex: 0 },
  ...STATES.slice(1).map((state, i) => ({
    id: state.id as string,
    from: state.from,
    to: state.to,
    railIndex: i + 1,
  })),
];

export const TEXT_BAND_COUNT = TEXT_BANDS.length;

/** Gewicht eines Textbands bei Fortschritt p. */
export function textBandWeight(p: number, index: number): number {
  const b = TEXT_BANDS[index];
  const o = ov(b.to - b.from);
  const inStart = index === 0 ? -1 : b.from - o;
  const inEnd = index === 0 ? 0 : b.from + o;
  const outStart = index === TEXT_BAND_COUNT - 1 ? 1.1 : b.to - o;
  const outEnd = index === TEXT_BAND_COUNT - 1 ? 1.2 : b.to + o;
  return band(p, inStart, inEnd, outStart, outEnd);
}

/** Lokaler Fortschritt (0–1) innerhalb eines Textbands – für die Bewegung. */
export function textBandLocal(p: number, index: number): number {
  const b = TEXT_BANDS[index];
  return clamp((p - b.from) / (b.to - b.from));
}

/**
 * Bänder aller Ebenen. Bewusst an einer Stelle gebündelt: Hier – und nur
 * hier – steht, wie die Fahrt dramaturgisch zusammenhängt.
 *
 * Die wichtigsten Übergänge zum Ablesen:
 * – `leistungen` beginnt bei 0.165, mitten im Zustand „Beschwerden“
 * – `exam` (der echte Untersuchungsraum) setzt bei 0.43 ein, noch in
 *   „Symptome“, und trägt Diagnostik UND Behandlung
 * – `team` beginnt bei 0.56, mitten in „Behandlung“
 * – `room` (Empfangs-Ambiente) übernimmt ab 0.60 vom Untersuchungsraum
 * – `praxis` beginnt bei 0.72, während Team noch läuft
 * – `termin` beginnt bei 0.86 und verblasst NIE – die Buchungs-Vorschau
 *   reitet auf dem Auslauf in die echte Buchung hinein
 */
export const LAYERS = {
  /** Abstrakte Lichtsequenz + Verläufe: trägt 01–05 und verblasst zum Raum. */
  ambient: (p: number) => band(p, -1, 0, 0.44, 0.58),
  /** Freisteller des Arztes: trägt 01–02 und weicht den Panels. */
  doctor: (p: number) => band(p, 0.0, 0.04, 0.16, 0.24),
  /** Leistungs-Panels im Z-Korridor: kommen in 02, gehen in 04 auf. */
  leistungen: (p: number) => band(p, 0.165, 0.215, 0.3, 0.36),
  /** Symptom-Zyklus: kommt in 03, geht in 05 auf. */
  symptome: (p: number) => band(p, 0.285, 0.335, 0.4, 0.46),
  /** Der ECHTE Untersuchungsraum: trägt Diagnostik und Behandlung. */
  exam: (p: number) => band(p, 0.43, 0.55, 0.68, 0.8),
  /** Empfangs-Ambiente: übernimmt für Team, Praxis und Termin. */
  room: (p: number) => band(p, 0.6, 0.72, 1.1, 1.2),
  /** Porträt-Ebenen des Teams: erscheinen deutlich vor ihrem Zustand. */
  team: (p: number) => band(p, 0.56, 0.645, 0.815, 0.9),
  /** Praxis-Karte: beginnt, während Team noch läuft. */
  praxis: (p: number) => band(p, 0.72, 0.82, 0.87, 0.93),
  /** Buchungs-Vorschau: verblasst nie, sondern reitet auf dem Auslauf. */
  termin: (p: number) => band(p, 0.86, 0.94, 1.2, 1.3),
  /** Grüne Bahn – durchgehend, nie unterbrochen. */
  trajectory: (p: number) => band(p, -0.1, 0.02, 0.97, 1.06),
  /** Umgebungsglow – durchgehend. */
  glow: (p: number) => band(p, -0.1, 0.01, 1.05, 1.2),
  /** Auslauf: die Bühne löst sich in die normale Seite auf. */
  release: (p: number) => smoothstep(0.955, 1.0, p),
} as const;

export type LayerId = keyof typeof LAYERS;

/**
 * Helligkeit der Bühne: hell ist sie, sobald einer der beiden Räume trägt.
 * Ab ROOM_BRIGHT schalten Leiste, Zähler und Bahn auf dunkle Farben.
 */
export function brightness(p: number): number {
  return Math.max(LAYERS.exam(p), LAYERS.room(p));
}

export const ROOM_BRIGHT = 0.55;

/**
 * Fortschritt, ab dem der fixe Header deckend wird.
 * Er muss VOR der hellen Phase liegen – sonst stünde seine helle Schrift
 * kurz auf hellem Grund. Der Test hält genau das fest.
 */
export const HEADER_SOLID_AT = 0.46;

/** Lokaler Fortschritt (0–1) innerhalb eines Zustands. */
export function localProgress(p: number, index: number): number {
  const state = STATES[index];
  return clamp((p - state.from) / (state.to - state.from));
}

/**
 * Lokaler Fortschritt über eine Spanne mehrerer Zustände – etwa für die
 * Lichtsequenz, die über 01–05 als ein Stück läuft.
 */
export function spanProgress(p: number, fromIndex: number, toIndex: number): number {
  const from = STATES[fromIndex].from;
  const to = STATES[toIndex].to;
  return clamp((p - from) / (to - from));
}

/** Aktiver Zustand für die Leiste. */
export function activeState(p: number): number {
  const clamped = clamp(p);
  for (let i = STATES.length - 1; i >= 0; i--) {
    if (clamped >= STATES[i].from) return i;
  }
  return 0;
}

/**
 * Sprungmarken der Leiste – bewusst NICHT die Zustandsmitte: Die Mitte von
 * 01 läge exakt in der Kreuzblende zwischen Willkommen- und Arzt-Text.
 * Jede Marke steht dort, wo der dominante Text voll trägt.
 */
/*
 * Leistungen springt auf 0.24 und Symptome auf 0.3475 – nicht auf die
 * Zustandsmitte: Bei Leistungen steht dort Station 2 des Korridors exakt
 * im Fokus, bei Symptomen die Mitte des zweiten Zyklusfensters. Die
 * Zustandsmitte läge jeweils genau in einer Blende.
 */
export const ANCHORS = [0.015, 0.15, 0.24, 0.3475, 0.465, 0.575, 0.7, 0.845, 0.93];

/** Sprungmarke eines Zustands. */
export function progressForState(index: number): number {
  return ANCHORS[Math.round(clamp(index, 0, STATE_COUNT - 1))];
}

/** Index des Team-Zustands – eigener Unter-Fortschritt (01/06). */
export const TEAM_INDEX = STATES.findIndex((s) => s.id === "team");
/** Index des Leistungs-Zustands – Kamerafahrt durch den Panel-Korridor. */
export const LEISTUNGEN_INDEX = STATES.findIndex((s) => s.id === "leistungen");
/** Index des Symptom-Zustands – Typo-Zyklus. */
export const SYMPTOME_INDEX = STATES.findIndex((s) => s.id === "symptome");
/** Zustände, die von der Lichtsequenz getragen werden (01–05). */
export const AMBIENT_FIRST = 0;
export const AMBIENT_LAST = STATES.findIndex((s) => s.id === "diagnostik");
