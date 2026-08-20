/**
 * Szenen-Quellen der Master-Frame-Timeline – das Register des Filmwerks.
 *
 * Jede Umgebung ist eine typisierte Quelle in einem von zwei Modi:
 *
 *   A) FRAME SEQUENCE MODE – nummerierte Frames, per Canvas gescrubbt
 *   B) STATIC CINEMATIC MODE – EIN echtes Foto mit Kamerafahrt
 *      (Pan/Zoom/Parallaxe – niemals gefälschte Personenbewegung)
 *
 * Der Compositor (components/cinema/SceneCanvas.tsx) kennt nur diese
 * Schnittstelle.
 *
 * ── Belegung HEUTE ──────────────────────────────────────────────────────
 * Der GESAMTE Film (Frames 1–500) ist offline aus den REALEN Praxis-
 * Assets gebacken (scripts/bake-film.mjs): eine durchgehende Kamerafahrt
 * durch das echte Untersuchungsraum-Foto – aus tiefer Unschärfe ankommen,
 * scharf im Raum, Dolly zur grünen Liege, Rückzug ins helle Empfangs-
 * Ambiente. Kamerabewegung und Licht, keine erfundenen Menschen.
 * Desktop lädt 500 Frames (1600×900), Telefone 250 Frames (960×540).
 *
 * ── Echte menschliche Bewegung später ───────────────────────────────────
 * Sobald echte Video-Clips aus der Praxis vorliegen (Empfang, Gang,
 * Behandlungsgriff – mit Einverständnis der Gezeigten), werden ihre
 * extrahierten Frames DIREKT in public/sequence/desktop/ die
 * betreffenden Frame-Bereiche ersetzen (Dateitausch, kein Code):
 *   001–115  Empfang/Arzt (Begrüßung)      236–345  Untersuchungsraum
 *   116–235  Praxisräume (Kamerafahrt)     406–500  Empfang ohne Personen
 * Clips bitte INKLUSIVE der Blenden-Ausläufer rendern, Benennung
 * frame_%04d.webp, 1600×900; Mobil-Varianten 960×540 (jeder 2. Frame).
 * KI-generierte Personen kommen nicht infrage (Projektregel).
 */

import type { CamKeyframe } from "./camera.ts";
import { TOTAL_FRAMES } from "./frames.ts";

/** Store-Feintuning je Quelle (Rest kommt aus DEFAULT_STORE_CONFIG). */
export interface FilmStoreTuning {
  /** Voll aufgelöstes Gleitfenster ±radius um den Playhead. */
  windowRadius: number;
  /** Breite der dauerhaften Grob-Leiter. */
  ladderWidth: number;
}

export interface FramesSource {
  mode: "frames";
  id: string;
  /** Pfadschema der Einzelframes (1-basiert). */
  path: (i: number) => string;
  count: number;
  /** Master-Frame-Spanne, über die die lokalen Frames gescrubbt werden. */
  span: [number, number];
  /** Sichtbarkeit über Master-Frames. */
  alpha: (f: number) => number;
  /** Welche Geräteklasse diese Sequenz lädt (<768 px = mobile). */
  media: "desktop" | "mobile";
  store: FilmStoreTuning;
}

export interface StillSource {
  mode: "still";
  id: string;
  /** Scharfe Ebene (Desktop) + kleinere Variante (Mobil). */
  src: string;
  srcMobile: string;
  /** Weiche Rückwand (Blur steckt IM Asset – nie filter im Renderpfad). */
  soft?: string;
  softMobile?: string;
  srcW: number;
  srcH: number;
  /** Kamerafahrt als Keyframe-Kette über Master-Frames. */
  camera: CamKeyframe[];
  /** Sichtbarkeit über Master-Frames. */
  alpha: (f: number) => number;
  /** Zeiger-Parallaxe der scharfen Ebene in px (0 = aus). */
  pointerShift: number;
}

export type SceneSource = FramesSource | StillSource;

/**
 * Der gebackene Film – trägt die GESAMTE Fahrt (alpha konstant 1; die
 * Kreuzblenden liegen IM Material, der DOM-Release vollendet das Ende).
 * windowRadius 24: 1600×900-Bitmaps ≈ 5.8 MB → Fenster ≈ 320 MB Peak.
 */
export const FILM_DESKTOP: FramesSource = {
  mode: "frames",
  id: "film",
  path: (i) => `/sequence/desktop/frame_${String(i).padStart(4, "0")}.webp`,
  count: 500,
  span: [1, TOTAL_FRAMES],
  alpha: () => 1,
  media: "desktop",
  store: { windowRadius: 24, ladderWidth: 640 },
};

/** Mobil: jeder 2. Master-Frame bei 960×540 (≈ 1.6 MB Bitmap, Fenster ≈ 50 MB). */
export const FILM_MOBILE: FramesSource = {
  mode: "frames",
  id: "film-mobile",
  path: (i) => `/sequence/mobile/frame_${String(i).padStart(4, "0")}.webp`,
  count: 250,
  span: [1, TOTAL_FRAMES],
  alpha: () => 1,
  media: "mobile",
  store: { windowRadius: 12, ladderWidth: 480 },
};

/** Alle Canvas-Quellen in Zeichenreihenfolge (unten → oben). */
export const SOURCES: SceneSource[] = [FILM_DESKTOP, FILM_MOBILE];
