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
