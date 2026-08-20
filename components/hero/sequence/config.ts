/**
 * Poster- und Mobile-Video-Konstanten der ruhigen Fassung (Reduced
 * Motion / statischer Hero).
 *
 * Der Film selbst (gebackene Frames unter public/sequence/, Pfadschema,
 * Spannen) ist in lib/cinema/sources.ts registriert; geladen wird er vom
 * parametrisierten FrameStore über den Compositor
 * (components/cinema/SceneCanvas.tsx). Gebacken wird er offline mit
 * scripts/bake-film.mjs.
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
