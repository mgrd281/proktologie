/**
 * Poster- und Mobile-Video-Konstanten der Hero-Bildsequenz.
 *
 * Die Sequenz selbst (500 Frames, Pfadschema, Spannen) ist seit der
 * Frame-Timeline-Engine in lib/cinema/sources.ts registriert; geladen
 * wird sie vom parametrisierten FrameStore über den Compositor
 * (components/cinema/SceneCanvas.tsx).
 */

export const FRAME_DIR = "/hero-frames";

/** Statisches Poster (Reduced Motion / Mobile-Video-Vorschau). */
export const POSTER_PATH = `${FRAME_DIR}/poster.webp`;

/**
 * Mobile-Fallback: statt 500 Frames ein kurzes Video.
 * Dateien hier ablegen, sobald sie produziert sind – die Website fällt
 * bis dahin automatisch auf das Porträt-Panel zurück.
 */
export const MOBILE_VIDEO_WEBM = `${FRAME_DIR}/hero-mobile.webm`;
export const MOBILE_VIDEO_MP4 = `${FRAME_DIR}/hero-mobile.mp4`;
