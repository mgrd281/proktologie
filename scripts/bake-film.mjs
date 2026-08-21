/**
 * Backt den Film der Startseite aus ECHTEM Bewegtmaterial des
 * Untersuchungsraums: drei 4K-Clips (10 s, 24 fps) werden zu EINER
 * durchgehenden Fahrt über 500 Master-Frames montiert und dabei
 * gegradet – Fokusfahrt, Belichtung, Markenton, Filmkorn, Vignette.
 *
 * Die Clips zeigen den ECHTEN Raum in ECHTER Kamerabewegung (aus dem
 * Originalfoto animiert). Keine erfundenen Personen, keine erfundene
 * Ausstattung – die Bildtreue ist hier nicht nur Ästhetik, sondern
 * Rechtsschutz (§ 3 HWG, § 5 UWG: irreführende Werbung).
 *
 * Ausführen (sharp + extrahierte Clip-Frames werden lokal gebraucht):
 *   npm i --no-save sharp
 *   node scripts/bake-film.mjs
 *
 * Ausgabe:
 *   public/sequence/desktop/frame_0001.webp … frame_0500.webp  (1600×900)
 *   public/sequence/mobile/frame_0001.webp  … frame_0250.webp  (960×540)
 *
 * ── Montage ─────────────────────────────────────────────────────────────
 *   R  REZEPTION       Master 001–070   Szene 01: Ankunft am Tresen
 *                      (Standbild + Engine-Kamera, kein Clip – das
 *                       gelieferte Video war 852×480 und damit für das
 *                       1600-px-Ziel zu weich)
 *   C  „subtle push“   Master 045–205   Untersuchungsraum ab Szene 02
 *   A  „dolly in“      Master 165–460   DIE Fahrt: heran an die Liege
 *   B  „pan“           Master 420–500   Ausklang, Blick öffnet sich
 *   An beiden Nähten liegt eine 40 Frames breite Blende, PIXELWEISE in
 *   die Frames gebacken – im Browser gibt es keinen Schnitt zu sehen.
 *
 * Jeder Frame ist eine reine Funktion seiner Nummer – der Film ist
 * stetig und exakt umkehrbar. Nach dem Rendern prüft das Skript die
 * Differenz benachbarter Frames und meldet das Gesamtgewicht.
 */

import { createRequire } from "node:module";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("sharp fehlt – bitte:  npm i --no-save sharp");
  process.exit(1);
}

const ROOT = new URL("..", import.meta.url).pathname;
/**
 * Ausgabeziel und Szene-01-Schalter sind überschreibbar, damit sich der
 * Zustand OHNE Szene 01 reproduzieren und Frame für Frame gegen den
 * neuen Stand vergleichen lässt (Beweis der Szenen-Isolation):
 *   S01=0 SEQ_OUT=/tmp/ref node scripts/bake-film.mjs
 */
const SEQ_OUT = process.env.SEQ_OUT ?? join(ROOT, "public/sequence");
const OUT_DESKTOP = join(SEQ_OUT, "desktop");
const OUT_MOBILE = join(SEQ_OUT, "mobile");
const S01_ENABLED = process.env.S01 !== "0";
const S02_ENABLED = process.env.S02 !== "0";

/**
 * Verzeichnis der extrahierten Clip-Frames (f_0001.jpg …). Liegt bewusst
 * AUSSERHALB des Repos: 723 4K-Frames sind Rohmaterial, nicht Quellcode.
 * Erzeugt mit:
 *   ffmpeg -i clip.mp4 -vf scale=2560:1440 -qscale:v 2 frames/X/f_%04d.jpg
 * Die 2560 px Breite ist Absicht: Sie geben der EDITORISCHEN Kamera
 * (ZOOM/PAN unten) Reserve, ohne je hochzuskalieren.
 */
const CLIP_ROOT =
  process.env.CLIP_FRAMES ??
  "/tmp/claude-0/-home-user-proktologie/517eb647-c0fe-5839-bbfe-61e8ecd84bd6/scratchpad/frames";

const TOTAL = 500;
/** Breite/Höhe der extrahierten Clip-Frames (Reserve für den Punch-in). */
const CLIP_W = 2560;
const CLIP_H = 1440;
const GRAIN_TILE = 512;
/** Korn-Amplitude: Rauschwerte 96–160 um 128 → ±32·0.28 ≈ ±9 Stufen. */
const GRAIN_K = 0.28;

const DEEP_C = [23, 37, 27]; // Marken-Deep #17251B
const CREAM_C = [247, 246, 241];

// ---------- Mathematik (identisch zur Engine) ----------
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (a, b, v) => {
  if (a === b) return v < a ? 0 : 1;
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** Keyframe-Kette mit smoothstep-Blenden – stetig, umkehrbar. */
function chain(keys, f) {
  if (f <= keys[0].at) return keys[0].v;
  const last = keys[keys.length - 1];
  if (f >= last.at) return last.v;
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].at) {
      return mix(keys[i - 1].v, keys[i].v, smoothstep(keys[i - 1].at, keys[i].at, f));
    }
  }
  return last.v;
}

// ---------- Standbild-Quellen: echte Fotos mit Engine-Kamera ----------
/**
 * Jede Still-Quelle bringt ihre eigene Kamerafahrt mit. Die Ketten stehen
 * hier zusammen, damit Szenen sich die Mechanik teilen statt sie zu
 * duplizieren: Der Renderer liest `zoom/x/y/pulse` und braucht nicht zu
 * wissen, welche Szene gerade fährt.
 *
 * `pulse` schickt eine weiche Helligkeitswelle über die grün leuchtenden
 * Pixel der Quelle (Position als Anteil der Bildbreite). In Szene 01 sind
 * das Tresenband und Bodenbahn, in Szene 02 die echten Tresenbänder und
 * die grüne Wegeführung auf der Glastür – das Verbindungselement ist in
 * beiden Fällen reales Material, keine erfundene Grafik.
 */
const STILLS = {
  /*
   * Szene 01. Quelle 2400 px breit (das Original misst nur 1672 px, ein
   * Dolly-in ohne Hochskalierung wäre auf Zoom 1.045 begrenzt gewesen).
   * Start bewusst nicht bei Zoom 1.0: Bei voller Bildbreite liesse sich
   * der Blickpunkt nicht verschieben, und die Tresenkurve läge hinter dem
   * Lesbarkeitsschleier der Typografie (linke 56 %).
   */
  rezeption: {
    src: join(ROOT, "public/images/rezeption-2400.webp"),
    zoom: [{ at: 1, v: 1.1 }, { at: 30, v: 1.18 }, { at: 55, v: 1.26 }, { at: 70, v: 1.3 }],
    x: [{ at: 1, v: 0.55 }, { at: 30, v: 0.6 }, { at: 55, v: 0.64 }, { at: 70, v: 0.67 }],
    y: [{ at: 1, v: 0.52 }, { at: 40, v: 0.5 }, { at: 70, v: 0.47 }],
    pulse: [{ at: 1, v: -0.25 }, { at: 70, v: 1.25 }],
  },

  /*
   * Szene 02: echtes Foto derselben Rezeption vom anderen Ende, Blick auf
   * die Glastüren. Quelle 2560×1920 (4:3) – bei Zoom 1.60 ist der
   * Ausschnitt noch 1600 px breit, die ganze Fahrt läuft also ohne eine
   * einzige Hochskalierung. Bewegung aus dem gelieferten Referenzvideo
   * abgelesen: langsamer Dolly vorwärts am Tresen vorbei, leichte Drift
   * nach rechts, Blick hebt sich zur Türbeschriftung „wartebereich".
   */
  flur: {
    src: join(ROOT, "public/images/flur-2560.webp"),
    zoom: [{ at: 44, v: 1.0 }, { at: 85, v: 1.28 }, { at: 115, v: 1.5 }, { at: 130, v: 1.6 }],
    x: [{ at: 44, v: 0.5 }, { at: 85, v: 0.56 }, { at: 130, v: 0.63 }],
    y: [{ at: 44, v: 0.42 }, { at: 85, v: 0.4 }, { at: 130, v: 0.36 }],
    pulse: [{ at: 44, v: -0.25 }, { at: 130, v: 1.25 }],
  },
};

// ---------- Die Montage: welcher Clip trägt welchen Master-Frame ----------
const CLIP_FRAMES = 241;

/**
 * Ein Segment bildet Master-Frames auf Clip-Frames ab. `fadeIn`/`fadeOut`
 * geben die Breite der Blende an; innerhalb der Überlappung mischen zwei
 * Segmente pixelweise, sodass keine Naht sichtbar bleibt.
 *
 * `inAt` entkoppelt den Blendenbeginn von `from`: Segment C blendet erst
 * ab Frame 45 ein, behält aber seine ursprüngliche Frame-Zuordnung
 * (from 1 … to 205). Ohne diese Trennung würde ein späterer Start die
 * gesamte Clip-Zuordnung dahinter verschieben – und damit Szenen ändern,
 * die unangetastet bleiben sollen.
 */
const SEGMENTS = [
  ...(S01_ENABLED ? [{ still: "rezeption", from: 1, to: 70, fadeOut: 26 }] : []),
  ...(S02_ENABLED ? [{ still: "flur", from: 44, to: 130, fadeIn: 26, fadeOut: 22 }] : []),
  /*
   * Segment C behält IMMER seine Frame-Zuordnung (from 1 … to 205); nur
   * der Blendenbeginn `inAt` wandert. Ohne diese Trennung würde ein
   * späterer Start die gesamte Clip-Zuordnung dahinter verschieben – und
   * damit Szenen verändern, die unangetastet bleiben sollen.
   */
  {
    clip: "C", from: 1, to: 205, clipFrom: 1, clipTo: 241, fadeOut: 40,
    ...(S02_ENABLED
      ? { inAt: 108, fadeIn: 22 }
      : S01_ENABLED
        ? { inAt: 45, fadeIn: 26 }
        : {}),
  },
  { clip: "A", from: 165, to: 460, clipFrom: 1, clipTo: 241, fadeIn: 40, fadeOut: 40 },
  { clip: "B", from: 420, to: 500, clipFrom: 1, clipTo: 100, fadeIn: 40 },
];

/** Gewicht eines Segments bei Master-Frame f (0 = trägt nicht). */
function segmentWeight(seg, f) {
  if (f < seg.from || f > seg.to) return 0;
  let w = 1;
  if (seg.fadeIn) {
    const a = seg.inAt ?? seg.from;
    w *= smoothstep(a, a + seg.fadeIn, f);
  }
  if (seg.fadeOut) w *= 1 - smoothstep(seg.to - seg.fadeOut, seg.to, f);
  return w;
}

/** Clip-Frame-Nummer (1-basiert, gerundet) eines Segments bei Master f. */
function clipFrameFor(seg, f) {
  const t = clamp((f - seg.from) / (seg.to - seg.from));
  const n = Math.round(seg.clipFrom + t * (seg.clipTo - seg.clipFrom));
  return Math.max(1, Math.min(CLIP_FRAMES, n));
}

// ---------- Das Grading: alle Parameter als Funktion von f ----------
/**
 * Unschärfe (σ). Deutlich sanfter als in der Foto-Fassung: Das echte
 * Material bringt eigene Tiefenschärfe mit, ein Softfokus genügt.
 */
const BLUR = [
  { at: 1, v: 26 }, { at: 60, v: 22 }, { at: 115, v: 17 }, { at: 176, v: 11 },
  { at: 235, v: 3.5 }, { at: 252, v: 0 }, { at: 345, v: 0 },
  { at: 400, v: 6 }, { at: 470, v: 13 }, { at: 500, v: 17 },
];
/** Belichtung: dunkle Ankunft → volles Licht ab Diagnostik → heller Ausklang. */
const BRIGHT = [
  { at: 1, v: 0.58 }, { at: 115, v: 0.66 }, { at: 176, v: 0.74 }, { at: 235, v: 0.9 },
  { at: 263, v: 1.0 }, { at: 345, v: 1.0 }, { at: 430, v: 1.07 }, { at: 500, v: 1.1 },
];
/** Dunkelgrüner Marken-Schleier (Deep #17251B) – stark am Anfang. */
const DEEP_TINT = [
  { at: 1, v: 0.44 }, { at: 115, v: 0.37 }, { at: 176, v: 0.28 }, { at: 235, v: 0.12 },
  { at: 263, v: 0 }, { at: 345, v: 0 }, { at: 500, v: 0 },
];
/** Cream-Beruhigung ganz am Ende (der DOM-Release vollendet sie). */
const CREAM = [
  { at: 1, v: 0 }, { at: 440, v: 0 }, { at: 470, v: 0.22 }, { at: 500, v: 0.55 },
];
/** Sättigung: zurückhaltend im Dunkeln, natürlich im hellen Raum. */
const SAT = [
  { at: 1, v: 0.8 }, { at: 200, v: 0.86 }, { at: 263, v: 1.0 }, { at: 500, v: 1.0 },
];
/**
 * EDITORISCHE KAMERA über dem Clip-Bild: Ausschnitt aus dem 2560er Frame,
 * skaliert auf die Zielgröße. Sie ADDIERT sich zur echten Kamerafahrt im
 * Material – erst zusammen ergibt das pro Scroll-Einheit die Bewegung,
 * die ein Film braucht. Da immer VERKLEINERT wird (Ausschnitt ≥ Zielbreite),
 * kostet der Punch-in keine Schärfe.
 *
 *   001–235  Schub aus der Unschärfe heran            1.52 → 1.12
 *            (kräftig: die Weichzeichnung dort dämpft jede Bewegung,
 *             also braucht die dunkle Phase den grössten Kamera-Hub)
 *   236–345  DIE Fahrt: heran an die grüne Liege      1.12 → 1.36
 *   346–460  Rückzug, die Bühne öffnet sich wieder    1.36 → 1.05
 *   461–500  Beruhigung                               1.05 → 1.00
 * Der Deckel 1.52 ist gerechnet: 2560/1.52 = 1684 px Ausschnitt, immer
 * noch breiter als die 1600 px Zielbreite – es wird nie hochskaliert.
 */
const ZOOM = [
  { at: 1, v: 1.52 }, { at: 60, v: 1.42 }, { at: 115, v: 1.32 }, { at: 176, v: 1.22 },
  { at: 235, v: 1.12 }, { at: 263, v: 1.16 }, { at: 291, v: 1.22 }, { at: 345, v: 1.36 },
  { at: 400, v: 1.2 }, { at: 460, v: 1.05 }, { at: 500, v: 1.0 },
];
/** Blickpunkt (Anteil der Quellbreite/-höhe) – leichte Seitwärtsdrift. */
const PAN_X = [
  { at: 1, v: 0.38 }, { at: 60, v: 0.45 }, { at: 115, v: 0.57 }, { at: 176, v: 0.44 },
  { at: 235, v: 0.48 }, { at: 345, v: 0.54 }, { at: 460, v: 0.5 }, { at: 500, v: 0.5 },
];
const PAN_Y = [
  { at: 1, v: 0.41 }, { at: 115, v: 0.48 }, { at: 235, v: 0.5 },
  { at: 345, v: 0.56 }, { at: 500, v: 0.5 },
];

/** Lichtschweif: Position (Anteil der Breite) und Stärke – zwei Durchgänge. */
const SWEEP_X = [
  { at: 1, v: -0.35 }, { at: 105, v: 1.4 }, { at: 118, v: -0.45 }, { at: 240, v: 1.3 }, { at: 500, v: 1.5 },
];
const SWEEP_A = [
  { at: 1, v: 0.26 }, { at: 88, v: 0.22 }, { at: 104, v: 0 }, { at: 124, v: 0 },
  { at: 140, v: 0.22 }, { at: 215, v: 0.16 }, { at: 250, v: 0 }, { at: 500, v: 0 },
];

/**
 * Szene-01-Override. Die Ketten oben bleiben UNANGETASTET; für Szene 01
 * wird darüber eine zweite Fassung gemischt, deren Gewicht bis Frame 76
 * auf exakt null ausläuft. Ab Frame 76 sind damit alle Grading-Werte
 * bitgenau die alten – Szene 02 und alles danach bleiben unverändert,
 * was nach dem Bake per Dateivergleich bewiesen wird.
 */
const S01_MIX = (f) => (S01_ENABLED ? 1 - smoothstep(46, 76, f) : 0);

/** Rezeption ist der verbindliche Look: klar ab dem ersten Frame. */
const S01_BLUR = [{ at: 1, v: 6 }, { at: 12, v: 0 }, { at: 76, v: 0 }];
/** Heller Empfangsraum statt dunkler Ankunft. */
const S01_BRIGHT = [{ at: 1, v: 0.94 }, { at: 55, v: 0.9 }, { at: 76, v: 0.88 }];
/** Kaum Markenschleier – die Rezeption trägt ihr Grün selbst. */
const S01_DEEP = [{ at: 1, v: 0.05 }, { at: 76, v: 0.1 }];
/** Natürliche Sättigung: das grüne Lichtband soll leuchten. */
const S01_SAT = [{ at: 1, v: 0.98 }, { at: 76, v: 0.94 }];

/**
 * Szene-02-Override, gleiches Prinzip: Gewicht läuft bis Frame 131 auf
 * exakt null aus, damit Szene 03 und alles danach bitgenau bleiben.
 * Szene 02 zeigte bisher den Arzt vor einem fast schwarzen Bokeh-Feld –
 * er stand im Nichts. Jetzt trägt ihn die echte, helle Praxis.
 */
const S02_MIX = (f) =>
  S02_ENABLED ? smoothstep(44, 70, f) * (1 - smoothstep(108, 131, f)) : 0;

const S02_BLUR = [{ at: 44, v: 0 }, { at: 131, v: 0 }];
const S02_BRIGHT = [{ at: 44, v: 0.92 }, { at: 115, v: 0.9 }, { at: 131, v: 0.88 }];
const S02_DEEP = [{ at: 44, v: 0.06 }, { at: 131, v: 0.12 }];
const S02_SAT = [{ at: 44, v: 0.97 }, { at: 131, v: 0.93 }];

// ---------- Hilfsebenen (einmal erzeugt, als Rohpuffer) ----------

/** Weicher diagonaler Lichtstreif (RGBA-Rohpuffer, Alpha trägt die Form). */
async function makeLightSweep(w, h) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#e9f5d0" stop-opacity="0.9"/>
      <stop offset="0.65" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
  const data = await sharp(Buffer.from(svg)).blur(30).ensureAlpha().raw().toBuffer();
  return { data, w, h };
}

/**
 * Vignette als vorberechneter Multiplikator je Pixel und Kanal:
 * m = (1−a) + a·C/255 mit C = #0b120d und a = 0 (Mitte) … 0.36 (Rand).
 */
async function makeVignetteMult(w, h) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="v" cx="0.5" cy="0.46" r="0.75">
      <stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#0b120d" stop-opacity="0.36"/>
    </radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#v)"/></svg>`;
  const rgba = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const mult = new Float32Array(w * h * 3);
  const C = [11 / 255, 18 / 255, 13 / 255]; // #0b120d
  for (let p = 0, q = 0; p < rgba.length; p += 4, q += 3) {
    const a = rgba[p + 3] / 255;
    mult[q] = 1 - a + a * C[0];
    mult[q + 1] = 1 - a + a * C[1];
    mult[q + 2] = 1 - a + a * C[2];
  }
  return mult;
}

/**
 * Deterministischer Zufall (mulberry32). Bewusst KEIN Math.random():
 * Der Skriptkopf verspricht, dass jeder Frame eine reine Funktion seiner
 * Nummer ist. Mit echtem Zufall wäre jeder Bake-Lauf byteverschieden –
 * dann liesse sich nicht mehr beweisen, dass eine Änderung nur eine
 * einzige Szene berührt hat.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kachelbares Filmkorn – 8 Varianten (1 Kanal), pro Frame gewechselt + versetzt. */
function makeGrainTiles(size, count = 8) {
  const rand = rng(0x5eed1701);
  const tiles = [];
  for (let t = 0; t < count; t++) {
    const raw = new Uint8Array(size * size);
    for (let i = 0; i < raw.length; i++) {
      const n = (rand() + rand() + rand()) / 3;
      raw[i] = Math.round(96 + n * 64);
    }
    tiles.push(raw);
  }
  return tiles;
}

// ---------- Pixel-Mischung: Montage + Grading in EINEM Durchlauf ----------
function blendFrame(o) {
  const {
    outW, outH, layers, deep, cream, sweepA, sweepLeft,
    bright, sat, sweep, vigMult, grainTile, gx, gy,
  } = o;
  const out = Buffer.allocUnsafe(outW * outH * 3);
  const hasDeep = deep > 0.001;
  const hasCream = cream > 0.001;
  const hasSweep = sweepA > 0.001;
  let p = 0;
  for (let y = 0; y < outH; y++) {
    const grow = ((y + gy) % GRAIN_TILE) * GRAIN_TILE;
    for (let x = 0; x < outW; x++, p += 3) {
      // Montage: gewichtete Summe der aktiven Clip-Segmente
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < layers.length; i++) {
        const { data, w } = layers[i];
        r += data[p] * w;
        g += data[p + 1] * w;
        b += data[p + 2] * w;
      }
      // Dunkelgrüner Schleier
      if (hasDeep) {
        r += (DEEP_C[0] - r) * deep;
        g += (DEEP_C[1] - g) * deep;
        b += (DEEP_C[2] - b) * deep;
      }
      // Lichtschweif: screen-Blend, Alpha aus der Gradient-Form × SWEEP_A
      if (hasSweep) {
        const sxp = x - sweepLeft;
        if (sxp >= 0 && sxp < sweep.w) {
          const si = (y * sweep.w + sxp) * 4;
          const a = (sweep.data[si + 3] / 255) * sweepA;
          if (a > 0.002) {
            r += (255 - ((255 - r) * (255 - sweep.data[si])) / 255 - r) * a;
            g += (255 - ((255 - g) * (255 - sweep.data[si + 1])) / 255 - g) * a;
            b += (255 - ((255 - b) * (255 - sweep.data[si + 2])) / 255 - b) * a;
          }
        }
      }
      // Cream-Beruhigung
      if (hasCream) {
        r += (CREAM_C[0] - r) * cream;
        g += (CREAM_C[1] - g) * cream;
        b += (CREAM_C[2] - b) * cream;
      }
      // Vignette (Multiplikation)
      r *= vigMult[p];
      g *= vigMult[p + 1];
      b *= vigMult[p + 2];
      // Grading: Sättigung um die Luma, dann Belichtung, dann Korn
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const grainAdd = (grainTile[grow + ((x + gx) % GRAIN_TILE)] - 128) * GRAIN_K;
      r = (lum + (r - lum) * sat) * bright + grainAdd;
      g = (lum + (g - lum) * sat) * bright + grainAdd;
      b = (lum + (b - lum) * sat) * bright + grainAdd;
      out[p] = r < 0 ? 0 : r > 255 ? 255 : r;
      out[p + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      out[p + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
  return out;
}

// ---------- Bake ----------
async function bake({ outDir, outW, outH, frames, masterFor }) {
  await mkdir(outDir, { recursive: true });

  const sweep = await makeLightSweep(Math.round(outW * 0.9), outH);
  const vigMult = await makeVignetteMult(outW, outH);
  const grain = makeGrainTiles(GRAIN_TILE);

  /*
   * Clip-Frames werden in Zielgröße als RGB-Rohpuffer gecacht. Der Cache
   * ist auf ein Fenster begrenzt (4K-Quellen, 1600×900×3 ≈ 4.3 MB je
   * Frame): mehr als ~90 gleichzeitig wären unnötiger Speicherdruck.
   */
  const cache = new Map();
  const cacheOrder = [];
  const CACHE_MAX = 60;
  /**
   * Ein Clip-Frame durch die editorische Kamera: Ausschnitt (extract) aus
   * dem 2560er Frame, dann auf die Zielgröße verkleinert. Der Ausschnitt
   * geht in den Cache-Key – bei Rückwärtsfahrten trifft er wieder.
   */
  const clipRaw = async (clip, n, cam) => {
    const key = `${clip}/${n}/${cam.sx},${cam.sy},${cam.sw}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const file = join(CLIP_ROOT, clip, `f_${String(n).padStart(4, "0")}.jpg`);
    const data = await sharp(file)
      .extract({ left: cam.sx, top: cam.sy, width: cam.sw, height: cam.sh })
      .resize(outW, outH, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();
    cache.set(key, data);
    cacheOrder.push(key);
    while (cacheOrder.length > CACHE_MAX) cache.delete(cacheOrder.shift());
    return data;
  };

  /*
   * Szene 01: Die Rezeption wird EINMAL in voller Breite als Rohpuffer
   * geladen; die Kamerafahrt schneidet daraus pro Frame aus. Dazu die
   * Maske der grün leuchtenden Pixel (Tresenband + Bodenbahn), über die
   * pro Frame eine Helligkeitswelle Richtung Flur wandert.
   */
  const stillCache = new Map();
  const loadStill = async (name) => {
    const hit = stillCache.get(name);
    if (hit) return hit;
    const { data, info } = await sharp(STILLS[name].src)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Grünmaske: Grün deutlich über Rot UND Blau, dazu hell genug
    const mask = new Float32Array(info.width * info.height);
    for (let i = 0, p = 0; p < data.length; p += 3, i++) {
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const dom = g - Math.max(r, b);
      if (dom > 18 && g > 90) mask[i] = Math.min(1, (dom - 18) / 60);
    }
    const entry = { data, w: info.width, h: info.height, mask, cam: STILLS[name] };
    stillCache.set(name, entry);
    return entry;
  };

  /**
   * Ein Standbild-Frame: Kameraausschnitt + wandernde Lichtwelle auf den
   * grünen Elementen. Die Welle wird VOR dem Verkleinern angewandt, damit
   * sie dieselbe Weichheit hat wie das Bild selbst.
   */
  const stillRaw = async (name, f) => {
    const R = await loadStill(name);
    const zoom = Math.max(1, chain(R.cam.zoom, f));
    const sw = Math.round(R.w / zoom);
    const sh = Math.round((sw * 9) / 16);
    const sx = Math.round(clamp(chain(R.cam.x, f) * R.w - sw / 2, 0, R.w - sw));
    const sy = Math.round(clamp(chain(R.cam.y, f) * R.h - sh / 2, 0, R.h - sh));

    const pulse = chain(R.cam.pulse, f);
    const cut = Buffer.allocUnsafe(sw * sh * 3);
    for (let y = 0; y < sh; y++) {
      const srcRow = (sy + y) * R.w;
      let q = y * sw * 3;
      for (let x = 0; x < sw; x++, q += 3) {
        const si = srcRow + sx + x;
        const p = si * 3;
        let r = R.data[p], g = R.data[p + 1], b = R.data[p + 2];
        const m = R.mask[si];
        if (m > 0.01) {
          // Position im QUELLBILD, nicht im Ausschnitt – dadurch läuft das
          // Licht unabhängig von der Kamerafahrt
          const u = (sx + x) / R.w;
          const d = Math.abs(u - pulse);
          const wv = d < 0.22 ? Math.pow(1 - d / 0.22, 2) : 0;
          const boost = 1 + m * wv * 0.55;
          r *= boost; g *= boost; b *= boost;
        }
        cut[q] = r > 255 ? 255 : r;
        cut[q + 1] = g > 255 ? 255 : g;
        cut[q + 2] = b > 255 ? 255 : b;
      }
    }
    return sharp(cut, { raw: { width: sw, height: sh, channels: 3 } })
      .resize(outW, outH, { fit: "fill" })
      .raw()
      .toBuffer();
  };

  /** Quellrechteck der editorischen Kamera – immer innerhalb des Bildes. */
  const camRect = (f) => {
    const zoom = Math.max(1, chain(ZOOM, f));
    // 16:9-cover im 2560×1440-Frame (bereits 16:9) → volle Breite bei zoom 1
    const sw = Math.round(CLIP_W / zoom);
    const sh = Math.round(CLIP_H / zoom);
    const sx = Math.round(clamp(chain(PAN_X, f) * CLIP_W - sw / 2, 0, CLIP_W - sw));
    const sy = Math.round(clamp(chain(PAN_Y, f) * CLIP_H - sh / 2, 0, CLIP_H - sh));
    return { sx, sy, sw, sh };
  };

  const renderFrame = async (n) => {
    const f = masterFor(n);
    // Szene-01-Override: Gewicht ist ab Frame 76 exakt 0 (siehe S01_MIX)
    const s01 = S01_MIX(f);
    const s02 = S02_MIX(f);
    let sigma = mix(chain(BLUR, f), chain(S01_BLUR, f), s01);
    let bright = mix(chain(BRIGHT, f), chain(S01_BRIGHT, f), s01);
    let deep = mix(chain(DEEP_TINT, f), chain(S01_DEEP, f), s01);
    let sat = mix(chain(SAT, f), chain(S01_SAT, f), s01);
    sigma = mix(sigma, chain(S02_BLUR, f), s02);
    bright = mix(bright, chain(S02_BRIGHT, f), s02);
    deep = mix(deep, chain(S02_DEEP, f), s02);
    sat = mix(sat, chain(S02_SAT, f), s02);
    const cream = chain(CREAM, f);
    const sweepX = chain(SWEEP_X, f);
    // Der Lichtschweif schweigt, solange echte Lichtbänder führen
    const sweepA = chain(SWEEP_A, f) * (1 - Math.max(s01, s02));

    // Montage: aktive Segmente sammeln und auf Summe 1 normieren
    const active = [];
    let total = 0;
    for (const seg of SEGMENTS) {
      const w = segmentWeight(seg, f);
      if (w > 0.001) {
        active.push({ seg, w });
        total += w;
      }
    }
    if (active.length === 0) throw new Error(`Kein Segment traegt Master-Frame ${f}`);
    const cam = camRect(f);
    const layers = await Promise.all(
      active.map(async ({ seg, w }) => ({
        data: seg.still
          ? await stillRaw(seg.still, f)
          : await clipRaw(seg.clip, clipFrameFor(seg, f), cam),
        w: w / total,
      })),
    );

    const px = blendFrame({
      outW, outH, layers, deep, cream, sweepA,
      sweepLeft: Math.round(sweepX * outW - outW * 0.45),
      bright, sat, sweep, vigMult,
      grainTile: grain[n % grain.length],
      gx: (n * 17) % GRAIN_TILE,
      gy: (n * 31) % GRAIN_TILE,
    });

    // Softfokus zuletzt: echtes Material bringt eigene Tiefenschärfe mit
    let pipe = sharp(px, { raw: { width: outW, height: outH, channels: 3 } });
    if (sigma > 0.3) pipe = pipe.blur(sigma);
    const out = await pipe.webp({ quality: 62 }).toBuffer();
    await writeFile(join(outDir, `frame_${String(n).padStart(4, "0")}.webp`), out);
  };

  /*
   * Sequenziell rendern: Der Frame-Cache lebt vom zeitlichen Zusammenhang
   * (benachbarte Master-Frames teilen Clip-Frames). Parallelität würde ihn
   * zerreissen und dieselben 4K-Bilder mehrfach dekodieren.
   */
  for (let n = 1; n <= frames; n++) {
    await renderFrame(n);
    if (n % 50 === 0) console.log(`  ${outDir.split("/").pop()}: ${n}/${frames}`);
  }
}

// ---------- Stetigkeitsprüfung + Gewicht ----------
async function verify(dir, frames) {
  const probe = async (n) =>
    sharp(join(dir, `frame_${String(n).padStart(4, "0")}.webp`))
      .resize(64, 36)
      .greyscale()
      .raw()
      .toBuffer();
  let worst = 0;
  let worstAt = 0;
  let prev = await probe(1);
  for (let n = 2; n <= frames; n++) {
    const cur = await probe(n);
    let sum = 0;
    for (let i = 0; i < cur.length; i++) sum += (cur[i] - prev[i]) ** 2;
    const rms = Math.sqrt(sum / cur.length);
    if (rms > worst) { worst = rms; worstAt = n; }
    if (rms > 26) throw new Error(`Sprung zwischen Frame ${n - 1} und ${n} (RMS ${rms.toFixed(1)})`);
    prev = cur;
  }
  let bytes = 0;
  for (const file of await readdir(dir)) bytes += (await stat(join(dir, file))).size;
  console.log(
    `  ${dir.split("/").pop()}: stetig (max RMS ${worst.toFixed(1)} bei ${worstAt}), ${(bytes / 1e6).toFixed(1)} MB`,
  );
}

for (const [name, still] of Object.entries(STILLS)) {
  if (!existsSync(still.src)) {
    console.error(`Still-Asset „${name}" fehlt: ${still.src}`);
    console.error("Erzeugen mit scripts/make-rezeption.mjs (siehe Dateikopf dort).");
    process.exit(1);
  }
}

for (const clip of ["A", "B", "C"]) {
  if (!existsSync(join(CLIP_ROOT, clip, "f_0001.jpg"))) {
    console.error(`Clip-Frames fehlen: ${join(CLIP_ROOT, clip)}`);
    console.error("Siehe Kommentar oben (ffmpeg-Aufruf) oder CLIP_FRAMES setzen.");
    process.exit(1);
  }
}

console.log("Backe Desktop-Film (500 × 1600×900) aus echtem Bewegtmaterial …");
await bake({ outDir: OUT_DESKTOP, outW: 1600, outH: 900, frames: 500, masterFor: (n) => n });
await verify(OUT_DESKTOP, 500);

console.log("Backe Mobil-Film (250 × 960×540) …");
await bake({ outDir: OUT_MOBILE, outW: 960, outH: 540, frames: 250, masterFor: (n) => 1 + ((n - 1) * 499) / 249 });
await verify(OUT_MOBILE, 250);

console.log("Fertig.");
