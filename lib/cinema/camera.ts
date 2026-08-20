/**
 * Kameramathematik der Still-Quellen – reine Mathematik, kein DOM.
 *
 * Eine Still-Quelle ist ein einzelnes echtes Foto, durch das eine Kamera
 * fährt: cover-Beschnitt plus Pan/Zoom als Quellrechteck für
 * drawImage(bitmap, sx, sy, sw, sh, 0, 0, viewW, viewH). Weil das
 * Quellrechteck eine reine Funktion der Kamerapose ist, ist die Fahrt
 * exakt umkehrbar – und ohne Browser prüfbar (lib/cinema/camera.test.mjs).
 *
 * WICHTIG (Ehrlichkeit): Eine Still-Kamera bewegt das BILD, nie den
 * Inhalt – keine gefälschte Gesichts- oder Handbewegung. Sobald echte
 * Motion-Clips vorliegen, ersetzt eine frames-Quelle den Still ohne
 * Architektur-Umbau (lib/cinema/sources.ts).
 */

import { clamp, smoothstep } from "./timeline.ts";

export interface Cam {
  /** Blickpunkt als Anteil der Quellbreite/-höhe (0–1). */
  x: number;
  y: number;
  /** 1 = reiner cover-Beschnitt; > 1 fährt näher heran. */
  zoom: number;
}

/**
 * Zoom-Deckel: Das gelieferte Untersuchungsraum-Foto ist 1536 px breit.
 * Auf einem 1440-px-Viewport bei DPR 1.5 bedeutet Zoom 1.22 bereits
 * ~1.7-fache Hochskalierung – mehr läse sich als Matsch. (Ein
 * ≥ 2880-px-Re-Export des Fotos hebt diesen Deckel; siehe README.)
 */
export const MAX_ZOOM = 1.22;

/** DPR-Deckel für Still-Quellen (Sequenzen dürfen bis 2). */
export const STILL_DPR_CAP = 1.5;

export interface CamKeyframe {
  /** Master-Frame, an dem diese Pose exakt gilt. */
  at: number;
  cam: Cam;
}

/** Lineare Mischung zweier Posen. */
export function mixCam(a: Cam, b: Cam, t: number): Cam {
  const k = clamp(t);
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    zoom: a.zoom + (b.zoom - a.zoom) * k,
  };
}

/**
 * Pose bei Master-Frame f aus einer Keyframe-Kette. Zwischen den
 * Keyframes wird mit smoothstep geblendet – dadurch sind verkettete
 * Szenen (05 Diagnostik → 06 Behandlung auf demselben Foto) eine
 * mathematisch stetige „matched camera movement“ ohne Schnitt.
 */
export function camAt(keyframes: CamKeyframe[], f: number): Cam {
  if (keyframes.length === 0) throw new Error("Kamerafahrt ohne Keyframes");
  if (f <= keyframes[0].at) return keyframes[0].cam;
  const last = keyframes[keyframes.length - 1];
  if (f >= last.at) return last.cam;
  for (let i = 1; i < keyframes.length; i++) {
    const a = keyframes[i - 1];
    const b = keyframes[i];
    if (f <= b.at) {
      return mixCam(a.cam, b.cam, smoothstep(a.at, b.at, f));
    }
  }
  return last.cam;
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Quellrechteck für cover + Pan/Zoom. Das Rechteck bleibt IMMER innerhalb
 * der Bildgrenzen (Blickpunkt wird geklemmt) – kein schwarzer Rand, egal
 * welche Pose interpoliert wird.
 */
export function sourceRectFor(
  cam: Cam,
  srcW: number,
  srcH: number,
  viewW: number,
  viewH: number,
): SourceRect {
  const zoom = clamp(cam.zoom, 1, MAX_ZOOM);
  const coverScale = Math.max(viewW / srcW, viewH / srcH);
  const drawScale = coverScale * zoom;
  const sw = viewW / drawScale;
  const sh = viewH / drawScale;
  const sx = clamp(cam.x * srcW - sw / 2, 0, srcW - sw);
  const sy = clamp(cam.y * srcH - sh / 2, 0, srcH - sh);
  return { sx, sy, sw, sh };
}
