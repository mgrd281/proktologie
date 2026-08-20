/**
 * Szenen-Quellen der Master-Frame-Timeline – das Register des Filmwerks.
 *
 * Jede Umgebung ist eine typisierte Quelle in einem von zwei Modi:
 *
 *   A) FRAME SEQUENCE MODE – nummerierte Frames, per Canvas gescrubbt
 *      (für Bereiche mit echtem Bewegtmaterial)
 *   B) STATIC CINEMATIC MODE – EIN echtes Foto mit Kamerafahrt
 *      (Pan/Zoom/Parallaxe – niemals gefälschte Personenbewegung)
 *
 * Der Compositor (components/cinema/SceneCanvas.tsx) kennt nur diese
 * Schnittstelle. Sobald echte Motion-Clips vorliegen, wird eine
 * still-Quelle durch eine frames-Quelle ERSETZT – reine Datenänderung,
 * kein Architektur-Umbau.
 *
 * ── Ehrliche Belegung HEUTE ─────────────────────────────────────────────
 *  Master-Frames   Quelle                                   Modus
 *  001–240         Lichtsequenz (hero-frames, Platzhalter)  frames
 *  228–355         ECHTES Untersuchungsraum-Foto            still (Kamera
 *                  (trägt Diagnostik UND Behandlung)         weit → Liege)
 *  340–500         Empfangs-Ambiente                        DOM (.team-env)
 *
 * ── Frame-Bereiche, die auf echtes Bewegtmaterial warten ────────────────
 *  001–115  Empfang/Arzt (Begrüßung, Handbewegung)  → /sequence/desktop/
 *  116–235  Praxisräume (Kamerafahrt)                 frame_0001.webp …
 *  236–345  Untersuchungs-/Behandlungsraum (Bewegung im Raum)
 *  406–500  Wartezimmer/Empfang ohne Personen
 *  Clips bitte INKLUSIVE der Blenden-Ausläufer rendern (die Bereiche
 *  überlappen die Szenengrenzen), Benennung frame_%04d.webp, Desktop
 *  1280–1600 px; Mobil-Varianten optional (Gerät nutzt sonst Stills).
 */

import type { CamKeyframe } from "./camera.ts";
import { AMBIENT_SPAN, FRAME_LAYERS } from "./frames.ts";

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

/** Lichtsequenz: trägt die Szenen 01–04 als abstrakte Umgebung. */
export const AMBIENT_SOURCE: FramesSource = {
  mode: "frames",
  id: "ambient",
  path: (i) => `/hero-frames/frame-${String(i).padStart(4, "0")}.webp`,
  count: 500,
  span: AMBIENT_SPAN,
  alpha: FRAME_LAYERS.ambient,
};

/**
 * Der ECHTE Untersuchungsraum – EINE Quelle für Diagnostik UND Behandlung.
 * Die Keyframe-Kette macht die Grenze 05→06 zu einer durchgehenden
 * Kamerabewegung (weit → Diagnostik-Seite → nah an der grünen Liege):
 * keine Blende, kein Schnitt – dieselbe Einstellung, weitergefahren.
 */
export const EXAM_SOURCE: StillSource = {
  mode: "still",
  id: "exam",
  src: "/images/untersuchungsraum-1536.webp",
  srcMobile: "/images/untersuchungsraum-960.webp",
  soft: "/images/untersuchungsraum-soft-1536.webp",
  softMobile: "/images/untersuchungsraum-soft-960.webp",
  srcW: 1536,
  srcH: 1024,
  camera: [
    { at: 228, cam: { x: 0.5, y: 0.42, zoom: 1.0 } },
    { at: 290.5, cam: { x: 0.58, y: 0.46, zoom: 1.09 } },
    { at: 355, cam: { x: 0.42, y: 0.6, zoom: 1.2 } },
  ],
  alpha: FRAME_LAYERS.exam,
  pointerShift: 8,
};

/** Alle Canvas-Quellen in Zeichenreihenfolge (unten → oben). */
export const SOURCES: SceneSource[] = [AMBIENT_SOURCE, EXAM_SOURCE];
