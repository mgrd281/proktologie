/**
 * Konfiguration der scroll-getriebenen Hero-Bildsequenz.
 *
 * Frames liegen unter public/hero-frames/ als
 * frame-0001.webp … frame-0500.webp (1-basiert). Die aktuellen Dateien
 * sind generierte Platzhalter – finale Renders ersetzen sie 1:1 bei
 * identischem Namensschema, ohne Code-Änderung.
 */

export const FRAME_COUNT = 500;

/** Glättungsfaktor der Playhead-Interpolation (pro rAF-Tick). */
export const LERP_FACTOR = 0.14;

export const FRAME_DIR = "/hero-frames";

export const framePath = (index: number): string =>
  `${FRAME_DIR}/frame-${String(index).padStart(4, "0")}.webp`;

/** Statisches Poster (Reduced Motion / Mobile-Video-Vorschau). */
export const POSTER_PATH = `${FRAME_DIR}/poster.webp`;

/**
 * Mobile-Fallback: statt 500 Frames ein kurzes Video.
 * Dateien hier ablegen, sobald sie produziert sind – die Website fällt
 * bis dahin automatisch auf das Porträt-Panel zurück.
 */
export const MOBILE_VIDEO_WEBM = `${FRAME_DIR}/hero-mobile.webm`;
export const MOBILE_VIDEO_MP4 = `${FRAME_DIR}/hero-mobile.mp4`;

/**
 * Speicher-Strategie: 500 voll dekodierte 720p-Bitmaps wären ~1,8 GB RAM.
 * Deshalb zweistufig:
 * – Grob-Leiter: jeder LADDER_STEP-te Frame bleibt dauerhaft dekodiert
 *   (halbe Auflösung) → sofort verfügbares „nearest" bei schnellem Scrub
 * – Voll aufgelöstes Gleitfenster ±WINDOW_RADIUS um den Playhead (LRU)
 */
export const LADDER_STEP = 8;
export const LADDER_WIDTH = 640;
export const WINDOW_RADIUS = 40;
export const WINDOW_CAPACITY = 2 * WINDOW_RADIUS + 16;

/** Parallele fetch()-Anfragen beim Vorladen der Blobs. */
export const FETCH_CONCURRENCY = 8;

/** Parallele createImageBitmap-Dekodierungen. */
export const DECODE_CONCURRENCY = 4;
