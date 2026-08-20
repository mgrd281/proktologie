/**
 * Backt den Film der Startseite: 500 echte webp-Frames aus den REALEN
 * Praxis-Assets (Untersuchungsraum-Foto, Empfangs-Textur) – eine
 * durchgehende Kamerafahrt mit Fokusziehen, Licht, Filmkorn und
 * Markengrading. Kamerabewegung, keine erfundenen Menschen.
 *
 * Ausführen (sharp wird lokal benötigt, ist bewusst KEINE Repo-Dependency):
 *   npm i --no-save sharp
 *   node scripts/bake-film.mjs
 *
 * Ausgabe:
 *   public/sequence/desktop/frame_0001.webp … frame_0500.webp  (1600×900)
 *   public/sequence/mobile/frame_0001.webp  … frame_0250.webp  (960×540)
 *
 * Jeder Frame ist eine reine Funktion seiner Nummer (dieselben
 * smoothstep-Ketten wie die Engine) – dadurch ist der Film stetig und
 * exakt umkehrbar. Nach dem Rendern prüft das Skript die Differenz
 * benachbarter Frames (kein Schnitt) und meldet das Gesamtgewicht.
 *
 * WICHTIG: Alle Ebenen-Deckkräfte werden in JS auf Rohpuffern gemischt.
 * sharps ensureAlpha(t) setzt in der hier verwendeten Version KEINE
 * verlässliche Deckkraft (gemessen ≈ konstant 0.65 unabhängig von t) –
 * composite-basierte Teildeckkraft wäre deshalb unstetig. sharp macht
 * nur Dekodieren/Blur/Crop/Resize/Enkodieren; die Mischung selbst ist
 * exakte Mathematik pro Pixel.
 *
 * Dramaturgie (Frames = Master-Timeline aus lib/cinema/frames.ts):
 *   001–055  aus tiefer Unschärfe ankommen (Bokeh des echten Raums, dunkel)
 *   056–175  Bokeh wandert, Blende öffnet langsam (Arzt/Tafeln sind DOM)
 *   176–235  Fokusfahrt: Klarheit naht
 *   236–290  Fokus DA: der echte Untersuchungsraum, weite Einstellung
 *   291–345  dieselbe Einstellung weitergefahren: Dolly zur grünen Liege
 *   346–430  Rückzug: Pullback, Defokus, Aufhellung Richtung Empfang
 *   431–470  helles Empfangs-Ambiente, ruhiger Drift
 *   471–500  Beruhigung Richtung Cream (der DOM-Release vollendet)
 */

import { createRequire } from "node:module";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
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
const SRC_EXAM = join(ROOT, "public/images/untersuchungsraum-1536.webp");
const SRC_RECEPTION = join(ROOT, "public/images/praxis-raum-soft-1600.webp");
const OUT_DESKTOP = join(ROOT, "public/sequence/desktop");
const OUT_MOBILE = join(ROOT, "public/sequence/mobile");

const TOTAL = 500;
const SW = 1536; // Quellbreite des Untersuchungsraum-Fotos
const SH = 1024;
const COVER_H = Math.round((SW / 16) * 9); // 864 – 16:9-cover im Quellbild
const GRAIN_TILE = 512;
/** Korn-Amplitude: Rauschwerte 96–160 um 128 → ±32·0.35 ≈ ±11 Stufen. */
const GRAIN_K = 0.35;

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

// ---------- Das Filmskript: alle Parameter als Funktion von f ----------
const CAM_X = [
  { at: 1, v: 0.5 }, { at: 115, v: 0.62 }, { at: 235, v: 0.46 },
  { at: 290, v: 0.58 }, { at: 345, v: 0.42 }, { at: 430, v: 0.5 }, { at: 500, v: 0.52 },
];
const CAM_Y = [
  { at: 1, v: 0.42 }, { at: 115, v: 0.4 }, { at: 235, v: 0.48 },
  { at: 290, v: 0.46 }, { at: 345, v: 0.6 }, { at: 430, v: 0.5 }, { at: 500, v: 0.46 },
];
const CAM_Z = [
  { at: 1, v: 1.1 }, { at: 115, v: 1.16 }, { at: 235, v: 1.05 }, { at: 263, v: 1.02 },
  { at: 290, v: 1.09 }, { at: 345, v: 1.2 }, { at: 430, v: 1.04 }, { at: 500, v: 1.0 },
];
/** Unschärfe (σ): tiefes Bokeh → scharf → sanfter Defokus im Rückzug. */
const BLUR = [
  { at: 1, v: 42 }, { at: 115, v: 34 }, { at: 176, v: 26 }, { at: 235, v: 9 },
  { at: 252, v: 0 }, { at: 345, v: 0 }, { at: 400, v: 12 }, { at: 470, v: 24 }, { at: 500, v: 30 },
];
/** Belichtung. */
const BRIGHT = [
  { at: 1, v: 0.52 }, { at: 115, v: 0.58 }, { at: 176, v: 0.66 }, { at: 235, v: 0.85 },
  { at: 263, v: 1.0 }, { at: 345, v: 1.0 }, { at: 430, v: 1.08 }, { at: 500, v: 1.1 },
];
/** Dunkelgrüner Marken-Schleier (Deep #17251B) – stark am Anfang. */
const DEEP_TINT = [
  { at: 1, v: 0.55 }, { at: 115, v: 0.48 }, { at: 176, v: 0.38 }, { at: 235, v: 0.16 },
  { at: 263, v: 0 }, { at: 345, v: 0 }, { at: 500, v: 0 },
];
/** Empfangs-Textur blendet im Rückzug ein. */
const RECEPTION = [
  { at: 1, v: 0 }, { at: 345, v: 0 }, { at: 400, v: 0.45 }, { at: 445, v: 0.7 }, { at: 500, v: 0.75 },
];
/** Cream-Beruhigung ganz am Ende. */
const CREAM = [
  { at: 1, v: 0 }, { at: 440, v: 0 }, { at: 470, v: 0.25 }, { at: 500, v: 0.6 },
];
/** Lichtschweif: Position (Anteil der Breite) und Stärke. */
const SWEEP_X = [
  { at: 1, v: -0.4 }, { at: 115, v: 0.25 }, { at: 235, v: 0.75 }, { at: 345, v: 1.1 }, { at: 500, v: 1.5 },
];
const SWEEP_A = [
  { at: 1, v: 0.32 }, { at: 176, v: 0.24 }, { at: 235, v: 0.12 }, { at: 263, v: 0 }, { at: 500, v: 0 },
];

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
 * m = (1−a) + a·C/255 mit C = #0b120d und a = 0 (Mitte) … 0.42 (Rand).
 */
async function makeVignetteMult(w, h) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="v" cx="0.5" cy="0.46" r="0.75">
      <stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#0b120d" stop-opacity="0.42"/>
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

/** Kachelbares Filmkorn – 8 Varianten (1 Kanal), pro Frame gewechselt + versetzt. */
function makeGrainTiles(size, count = 8) {
  const tiles = [];
  for (let t = 0; t < count; t++) {
    const raw = new Uint8Array(size * size);
    for (let i = 0; i < raw.length; i++) {
      // grobkörniges Gauß-artiges Rauschen um Mittelgrau
      const n = (Math.random() + Math.random() + Math.random()) / 3;
      raw[i] = Math.round(96 + n * 64);
    }
    tiles.push(raw);
  }
  return tiles;
}

// ---------- Pixel-Mischung: die gesamte Ebenenmathe in EINEM Durchlauf ----------
function blendFrame(o) {
  const {
    outW, outH, rawLo, rawHi, t, rec, deep, cream, sweepA, sweepLeft,
    bright, sat, receptionRaw, sweep, vigMult, grainTile, gx, gy,
  } = o;
  const out = Buffer.allocUnsafe(outW * outH * 3);
  const hasHi = t > 0.001 && rawHi;
  const hasRec = rec > 0.001;
  const hasDeep = deep > 0.001;
  const hasCream = cream > 0.001;
  const hasSweep = sweepA > 0.001;
  let p = 0;
  for (let y = 0; y < outH; y++) {
    const grow = ((y + gy) % GRAIN_TILE) * GRAIN_TILE;
    for (let x = 0; x < outW; x++, p += 3) {
      let r = rawLo[p];
      let g = rawLo[p + 1];
      let b = rawLo[p + 2];
      // Fokus-Leiter: zwei Blur-Stufen linear gemischt
      if (hasHi) {
        r += (rawHi[p] - r) * t;
        g += (rawHi[p + 1] - g) * t;
        b += (rawHi[p + 2] - b) * t;
      }
      // Empfangs-Textur
      if (hasRec) {
        r += (receptionRaw[p] - r) * rec;
        g += (receptionRaw[p + 1] - g) * rec;
        b += (receptionRaw[p + 2] - b) * rec;
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

  /*
   * Blur-Leiter: sharp.blur ist teuer – die Stufen werden EINMAL auf dem
   * Quellbild gerendert (verlustfrei als PNG zwischengelagert), pro Frame
   * werden zwei Stufen linear gemischt (visuell stetige Fokusfahrt).
   */
  const SIGMAS = [0.3, 3, 7, 13, 21, 31, 43];
  const ladder = [];
  for (const s of SIGMAS) {
    ladder.push(await sharp(SRC_EXAM).blur(s).png().toBuffer());
  }
  const receptionRaw = await sharp(SRC_RECEPTION)
    .resize(outW, outH, { fit: "cover" })
    .blur(18)
    .modulate({ brightness: 1.1, saturation: 0.9 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const sweep = await makeLightSweep(Math.round(outW * 0.9), outH);
  const vigMult = await makeVignetteMult(outW, outH);
  const grain = makeGrainTiles(GRAIN_TILE);

  const ladderPair = (sigma) => {
    for (let i = 1; i < SIGMAS.length; i++) {
      if (sigma <= SIGMAS[i]) {
        return [i - 1, i, clamp((sigma - SIGMAS[i - 1]) / (SIGMAS[i] - SIGMAS[i - 1]))];
      }
    }
    return [SIGMAS.length - 1, SIGMAS.length - 1, 0];
  };

  /** Kamera-Crop einer Leiterstufe als RGB-Rohpuffer in Zielgröße. */
  const cropRaw = (png, extract) =>
    sharp(png).extract(extract).resize(outW, outH).removeAlpha().raw().toBuffer();

  const renderFrame = async (n) => {
    const f = masterFor(n);
    const x = chain(CAM_X, f);
    const y = chain(CAM_Y, f);
    const z = chain(CAM_Z, f);
    const sigma = chain(BLUR, f);
    const bright = chain(BRIGHT, f);
    const deep = chain(DEEP_TINT, f);
    const rec = chain(RECEPTION, f);
    const cream = chain(CREAM, f);
    const sweepX = chain(SWEEP_X, f);
    const sweepA = chain(SWEEP_A, f);
    const sat = mix(0.82, 1.0, smoothstep(200, 263, f));

    // Kamera: cover-Crop im Quellbild (16:9), Pan/Zoom geklemmt
    const sw = Math.round(SW / z);
    const sh = Math.round(COVER_H / z);
    const sx = Math.round(clamp(x * SW - sw / 2, 0, SW - sw));
    const sy = Math.round(clamp(y * SH - sh / 2, 0, SH - sh));
    const extract = { left: sx, top: sy, width: sw, height: sh };

    const [lo, hi, t] = ladderPair(sigma);
    const needHi = hi !== lo && t > 0.001;
    const [rawLo, rawHi] = await Promise.all([
      cropRaw(ladder[lo], extract),
      needHi ? cropRaw(ladder[hi], extract) : Promise.resolve(null),
    ]);

    const px = blendFrame({
      outW, outH, rawLo, rawHi, t: needHi ? t : 0, rec, deep, cream, sweepA,
      sweepLeft: Math.round(sweepX * outW - outW * 0.45),
      bright, sat, receptionRaw, sweep, vigMult,
      grainTile: grain[n % grain.length],
      gx: (n * 17) % GRAIN_TILE,
      gy: (n * 31) % GRAIN_TILE,
    });

    const out = await sharp(px, { raw: { width: outW, height: outH, channels: 3 } })
      .webp({ quality: 58 })
      .toBuffer();
    await writeFile(join(outDir, `frame_${String(n).padStart(4, "0")}.webp`), out);
  };

  // begrenzte Parallelität (libvips ist intern schon mehrfädig)
  const queue = Array.from({ length: frames }, (_, i) => i + 1);
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const n = queue.shift();
      if (n === undefined) return;
      await renderFrame(n);
      if (n % 50 === 0) console.log(`  ${outDir.split("/").pop()}: ${n}/${frames}`);
    }
  });
  await Promise.all(workers);
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
  let prev = await probe(1);
  for (let n = 2; n <= frames; n++) {
    const cur = await probe(n);
    let sum = 0;
    for (let i = 0; i < cur.length; i++) sum += (cur[i] - prev[i]) ** 2;
    const rms = Math.sqrt(sum / cur.length);
    if (rms > worst) worst = rms;
    if (rms > 26) throw new Error(`Sprung zwischen Frame ${n - 1} und ${n} (RMS ${rms.toFixed(1)})`);
    prev = cur;
  }
  let bytes = 0;
  for (const file of await readdir(dir)) bytes += (await stat(join(dir, file))).size;
  console.log(`  ${dir.split("/").pop()}: stetig (max RMS ${worst.toFixed(1)}), ${(bytes / 1e6).toFixed(1)} MB`);
}

console.log("Backe Desktop-Film (500 × 1600×900) …");
await bake({ outDir: OUT_DESKTOP, outW: 1600, outH: 900, frames: 500, masterFor: (n) => n });
await verify(OUT_DESKTOP, 500);

console.log("Backe Mobil-Film (250 × 960×540) …");
await bake({ outDir: OUT_MOBILE, outW: 960, outH: 540, frames: 250, masterFor: (n) => 1 + ((n - 1) * 499) / 249 });
await verify(OUT_MOBILE, 250);

console.log("Fertig.");
