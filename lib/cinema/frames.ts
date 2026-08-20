/**
 * Die Master-FRAME-Timeline – einzige Quelle der Wahrheit der Kamerafahrt.
 *
 * Die Fahrt ist EIN scrubbares Filmwerk aus 500 logischen Frames
 * (FRAME 0001 … 0500). Der Scroll liefert nur einen Fortschritt p ∈ 0–1;
 * daraus wird der Ziel-Frame, dem der eine rAF-Loop mit LERP 0.12 folgt.
 * ALLE Ebenen – Canvas-Compositor, Texte, Team, Korridor, Bahn, Zähler –
 * sind zustandslose Funktionen des aktuellen Frames. Genau deshalb kehrt
 * Rückwärts-Scrollen den Film exakt um.
 *
 * Acht Hauptszenen + Termin-Finale (vom Praxisinhaber so entschieden;
 * das Finale ist kein Leistenpunkt). An JEDER Szenengrenze überblenden
 * beide Nachbarn über ein Fenster von 20 % der kürzeren Szenendauer –
 * nie ein Schnitt, nie Weiß, nie ein leerer Frame.
 *
 * Reine Daten + Mathematik, kein DOM – prüfbar ohne Browser
 * (lib/cinema/frames.test.mjs).
 */

// Relativ importiert, damit die Tests ohne Bundler-Alias laufen
import { band, clamp, smoothstep } from "./timeline.ts";

export const TOTAL_FRAMES = 500;

/** Der EINE Glättungsfaktor: currentFrame += (target − current) · LERP. */
export const LERP = 0.12;

export type SceneId =
  | "willkommen"
  | "arzt"
  | "leistungen"
  | "beschwerden"
  | "diagnostik"
  | "behandlung"
  | "team"
  | "praxis"
  | "termin";

export interface Scene {
  id: SceneId;
  /** Label des Leistenpunkts (Termin-Finale steht nicht auf der Leiste). */
  label: string;
  /** Erster/letzter Frame der Szene (1-basiert, inklusive). */
  first: number;
  last: number;
  rail: boolean;
}

/** Die acht Hauptszenen + Termin-Finale. Frames lückenlos 1–500. */
export const SCENES: Scene[] = [
  { id: "willkommen", label: "Willkommen", first: 1, last: 55, rail: true },
  { id: "arzt", label: "Dr. Kunstreich", first: 56, last: 115, rail: true },
  { id: "leistungen", label: "Leistungen", first: 116, last: 175, rail: true },
  { id: "beschwerden", label: "Beschwerden", first: 176, last: 235, rail: true },
  { id: "diagnostik", label: "Diagnostik", first: 236, last: 290, rail: true },
  { id: "behandlung", label: "Behandlung", first: 291, last: 345, rail: true },
  { id: "team", label: "Warum diese Praxis", first: 346, last: 430, rail: true },
  { id: "praxis", label: "Praxis & Standort", first: 431, last: 470, rail: true },
  { id: "termin", label: "Termin", first: 471, last: 500, rail: false },
];

export const SCENE_COUNT = SCENES.length;
export const RAIL_SCENES = SCENES.filter((s) => s.rail);

const duration = (i: number) => SCENES[i].last - SCENES[i].first + 1;

/**
 * Blendenbreite an der Grenze i→i+1: 20 % der kürzeren Nachbarszene –
 * immer innerhalb des geforderten 15–25 %-Fensters.
 */
export function dissolveWidth(i: number): number {
  return Math.round(0.2 * Math.min(duration(i), duration(i + 1)));
}

/** Grenzposition (zwischen last und first der Nachbarn). */
function boundary(i: number): number {
  return SCENES[i].last + 0.5;
}

interface AlphaEdges {
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
}

/** Vorberechnete Blendenkanten jeder Szene. */
export const SCENE_EDGES: AlphaEdges[] = SCENES.map((scene, i) => {
  const inW = i === 0 ? 0 : dissolveWidth(i - 1);
  const outW = i === SCENE_COUNT - 1 ? 0 : dissolveWidth(i);
  return {
    // Erste Szene steht bei Frame 1 bereits voll; das Finale verblasst nie –
    // es reitet auf dem Release in die echte Buchung.
    inStart: i === 0 ? -10 : boundary(i - 1) - inW / 2,
    inEnd: i === 0 ? 1 : boundary(i - 1) + inW / 2,
    outStart: i === SCENE_COUNT - 1 ? 1200 : boundary(i) - outW / 2,
    outEnd: i === SCENE_COUNT - 1 ? 1300 : boundary(i) + outW / 2,
  };
});

/** Sichtbarkeit einer Szene bei Frame f (überblendet, nie geschnitten). */
export function sceneAlpha(f: number, i: number): number {
  const e = SCENE_EDGES[i];
  return band(f, e.inStart, e.inEnd, e.outStart, e.outEnd);
}

/** Lokaler Fortschritt (0–1) innerhalb einer Szene. */
export function sceneLocal(f: number, i: number): number {
  const scene = SCENES[i];
  return clamp((f - scene.first) / (scene.last - scene.first));
}

/** Fortschritt p ∈ 0–1 → Frame (float, 1 … 500). */
export function frameForProgress(p: number): number {
  return 1 + clamp(p) * (TOTAL_FRAMES - 1);
}

/** Frame → Fortschritt p ∈ 0–1. */
export function progressForFrame(f: number): number {
  return clamp((f - 1) / (TOTAL_FRAMES - 1));
}

/** Aktive Szene (für Leiste und Zähler-Label). */
export function activeScene(f: number): number {
  const clamped = Math.min(TOTAL_FRAMES, Math.max(1, f));
  for (let i = SCENE_COUNT - 1; i >= 0; i--) {
    if (clamped >= SCENES[i].first) return i;
  }
  return 0;
}

/**
 * Kontinuitäts- und Umgebungsbänder – in FRAME-Einheiten. Getrennt von den
 * Szenenblenden, denn Umgebungen tragen mehrere Szenen: Die Lichtsequenz
 * trägt 01–04, der ECHTE Untersuchungsraum trägt 05+06 (eine Quelle, eine
 * verkettete Kamerafahrt), das Empfangs-Ambiente trägt 07 bis zum Release.
 */
export const FRAME_LAYERS = {
  /** Lichtsequenz (hero-frames) + Verläufe: trägt 01–04. */
  ambient: (f: number) => band(f, -10, 1, 230, 250),
  /** Der echte Untersuchungsraum (Canvas-Still, Kamera weit → Liege nah). */
  exam: (f: number) => band(f, 228, 242, 340, 355),
  /** Empfangs-Ambiente: trägt 07–Finale, geht nur mit dem Release. */
  room: (f: number) => band(f, 340, 351, 1200, 1300),
  /** Arzt-Freisteller: trägt 01–02, weicht den Leistungs-Tafeln. */
  doctor: (f: number) => band(f, -10, 1, 109, 122),
  /** Leistungs-Korridor (Szene 03, tiefengestaffelt – bleibt im Film). */
  leistungen: (f: number) => band(f, 104, 116, 172, 186),
  /** Symptom-Zyklus – innere Tiefe der Szene 04 Beschwerden. */
  symptome: (f: number) => band(f, 166, 180, 226, 240),
  /** Team-Porträt-Ebenen: erscheinen vor Szene 07, weichen vor Praxis. */
  team: (f: number) => band(f, 326, 348, 424, 438),
  /** Praxis-Karte (Adresse/Sprechzeiten) – Kern der Szene 08. */
  praxisCard: (f: number) => band(f, 422, 431, 464, 473),
  /** Buchungs-Vorschau: verblasst nie – reitet auf dem Release. */
  terminCard: (f: number) => band(f, 458, 470, 1200, 1300),
  /** Grüne Bahn: das durchgehende Verbindungselement der ganzen Fahrt. */
  trajectory: (f: number) => band(f, -50, 10, 485, 505),
  /** Umgebungsglow – durchgehend. */
  glow: (f: number) => band(f, -50, 5, 525, 600),
  /** Release: die Bühne löst sich NACH dem Termin-Einsatz in Cream auf. */
  release: (f: number) => smoothstep(478, 500, f),
} as const;

/** Helligkeit der Bühne (heller Raum aktiv?). */
export function brightnessF(f: number): number {
  return Math.max(FRAME_LAYERS.exam(f), FRAME_LAYERS.room(f));
}

export const ROOM_BRIGHT = 0.55;

/**
 * Frame, ab dem der fixe Header deckend wird – VOR der hellen Phase
 * (der Untersuchungsraum überschreitet ROOM_BRIGHT bei ~Frame 236).
 */
export const HEADER_SOLID_FRAME = 230;

/** p-Raum-Wert für das data-header-solid-Attribut (Header bleibt unverändert). */
export function headerSolidProgress(): number {
  return progressForFrame(HEADER_SOLID_FRAME);
}

/**
 * Sprungmarken der Leiste (8 Punkte). Bewusst NICHT die Szenenmitte:
 * Bei 03 liegt die Marke auf einer Fokus-Station des Korridors, bei 04
 * mittig im zweiten Zyklusfenster – die Mitte läge in einer Blende.
 */
export const ANCHOR_FRAMES = [25, 85, 138, 198, 263, 318, 388, 450];

/** Frame-Spanne der Lichtsequenz: 500 lokale Frames über Master 1–240. */
export const AMBIENT_SPAN: [number, number] = [1, 240];

/** Indizes für die Senken. */
export const TEAM_SCENE = SCENES.findIndex((s) => s.id === "team");
export const LEISTUNGEN_SCENE = SCENES.findIndex((s) => s.id === "leistungen");
export const SYMPTOME_SCENE = SCENES.findIndex((s) => s.id === "beschwerden");
export const TERMIN_SCENE = SCENES.findIndex((s) => s.id === "termin");
