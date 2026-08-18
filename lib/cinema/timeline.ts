/**
 * Zeitachse der Kamerafahrt – reine Mathematik, kein DOM.
 *
 * Die Startseite beginnt mit EINER durchgehenden Fahrt über sieben Zustände.
 * Der Scroll steuert nur einen Fortschritt 0–1; welche Ebene wann wie stark
 * sichtbar ist, entscheidet ausschließlich diese Datei.
 *
 * Der Kern ist `band()`: Jede Ebene hat ein Band, das FRÜHER beginnt und
 * SPÄTER endet als ihr Zustand. Dadurch überlappen sich benachbarte Zustände
 * immer – die nächste Szene ist schon da, bevor die vorige gegangen ist. Genau
 * das unterscheidet eine Kamerafahrt von aneinandergereihten Sektionen.
 *
 * Weil hier nichts vom Browser abhängt, ist die Dramaturgie ohne Browser
 * prüfbar (siehe lib/cinema/timeline.test.mjs).
 */

export type StateId =
  | "willkommen"
  | "arzt"
  | "beschwerden"
  | "diagnostik"
  | "behandlung"
  | "team"
  | "praxis";

export interface SequenceState {
  id: StateId;
  /** Nummer und Label der durchgehenden Leiste. */
  label: string;
  /** Beginn/Ende auf der Master-Zeitachse (0–1). */
  from: number;
  to: number;
}

/** Die sieben Zustände der Fahrt. Grenzen wie vom Nutzer vorgegeben. */
export const STATES: SequenceState[] = [
  { id: "willkommen", label: "Willkommen", from: 0.0, to: 0.12 },
  { id: "arzt", label: "Dr. Kunstreich", from: 0.12, to: 0.25 },
  { id: "beschwerden", label: "Beschwerden", from: 0.25, to: 0.38 },
  { id: "diagnostik", label: "Diagnostik", from: 0.38, to: 0.51 },
  { id: "behandlung", label: "Behandlung", from: 0.51, to: 0.64 },
  { id: "team", label: "Team", from: 0.64, to: 0.86 },
  { id: "praxis", label: "Praxis", from: 0.86, to: 1.0 },
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
 * Bänder aller Ebenen. Bewusst an einer Stelle gebündelt: Hier – und nur
 * hier – steht, wie die Fahrt dramaturgisch zusammenhängt.
 *
 * Ablesbar sind die zwei wichtigsten Übergänge:
 * – `team` beginnt bei 0.58, also mitten in „Behandlung"
 * – `praxis` beginnt bei 0.80, also während Team noch läuft
 */
export const LAYERS = {
  /** Abstrakte Lichtsequenz + Verläufe: trägt 01–05 und verblasst zum Raum hin. */
  ambient: (p: number) => band(p, -1, 0, 0.62, 0.78),
  /** Freisteller des Arztes: kommt sofort, steht in 02 vorn, weicht zurück. */
  doctor: (p: number) => band(p, 0.0, 0.04, 0.5, 0.6),
  /** Porträt-Ebenen des Teams: erscheinen deutlich vor ihrem Zustand. */
  team: (p: number) => band(p, 0.56, 0.66, 0.88, 0.96),
  /**
   * Der Empfangsraum als Umgebung: setzt schon in „Behandlung" ein, trägt
   * Team und Praxis und bleibt bis zum Auslauf. Er löst die Lichtsequenz
   * ab, ohne dass es einen Schnitt gibt – beide sind gleichzeitig da.
   */
  room: (p: number) => band(p, 0.54, 0.7, 1.1, 1.2),
  /** Empfangsraum: beginnt, während Team noch läuft. */
  praxis: (p: number) => band(p, 0.78, 0.9, 1.1, 1.2),
  /** Grüne Bahn – durchgehend, nie unterbrochen. */
  trajectory: (p: number) => band(p, -0.1, 0.02, 0.97, 1.06),
  /** Umgebungsglow – durchgehend. */
  glow: (p: number) => band(p, -0.1, 0.01, 1.05, 1.2),
  /** Auslauf: die Bühne löst sich in die normale Seite auf. */
  release: (p: number) => smoothstep(0.94, 1.0, p),
} as const;

export type LayerId = keyof typeof LAYERS;

/** Gewicht eines Zustands: sein Textblock, mit Überlappung zum Nachbarn. */
export function stateWeight(p: number, index: number): number {
  const state = STATES[index];
  const overlap = 0.04;
  return band(
    p,
    state.from - overlap,
    state.from + overlap,
    state.to - overlap,
    state.to + overlap,
  );
}

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

/** Sprungmarke: Fortschritt, bei dem ein Zustand mittig steht. */
export function progressForState(index: number): number {
  const state = STATES[clamp(index, 0, STATES.length - 1)];
  return (state.from + state.to) / 2;
}

/** Index des Team-Zustands – die einzige Stelle mit eigenem Unter-Fortschritt. */
export const TEAM_INDEX = STATES.findIndex((s) => s.id === "team");
/** Zustände, die von der Lichtsequenz getragen werden (01–05). */
export const AMBIENT_FIRST = 0;
export const AMBIENT_LAST = STATES.findIndex((s) => s.id === "behandlung");

/**
 * Ab diesem Anteil des Empfangsraums liest die Bühne als hell: Leiste,
 * Zähler und Linien schalten dann auf dunkle Schrift.
 */
export const ROOM_BRIGHT = 0.55;

/**
 * Fortschritt, ab dem der fixe Header deckend wird.
 *
 * Er muss VOR der hellen Phase liegen – sonst stünde seine helle Schrift
 * kurz auf hellem Grund. Der Test hält genau das fest.
 */
export const HEADER_SOLID_AT = 0.6;
