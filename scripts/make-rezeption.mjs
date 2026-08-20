/**
 * Baut das Rezeptions-Asset für Szene 01 aus dem gelieferten Foto.
 *
 * Das Originalbild (IMG-2144.png) trägt an der Wand ein FREMDES Branding
 * („ato does hamburg elmbüttel" mit fremdem Logo). Die echte Marke ist
 * „Proktologie Eimsbüttel" – nachweisbar am Monitor im
 * Untersuchungsraum-Foto. Auf der Website einer echten Arztpraxis wäre
 * die fremde Schrift irreführende Werbung (§ 3 HWG, § 5 UWG), deshalb:
 *
 *   1. Fremdschrift durch weich maskierte Tiefenunschärfe ersetzen
 *      (liest sich als natürliche Schärfentiefe der hinteren Wand)
 *   2. Echtes Logo perspektivisch an dieselbe Stelle setzen – die
 *      LogoMark-Pfade sind identisch zu components/ui/Logo.tsx
 *   3. Auf 2400 px hochziehen: Die Quelle ist nur 1672 px breit, das
 *      Desktop-Ziel 1600 px. Ohne diesen Schritt wäre ein Dolly-in auf
 *      Zoom 1.045 begrenzt – unsichtbar.
 *
 * Ausführen:  node scripts/make-rezeption.mjs <quelle.png>
 * Ausgabe:    public/images/rezeption-2400.webp
 */

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = process.argv[2];
const OUT = join(ROOT, "public/images/rezeption-2400.webp");

if (!SRC) {
  console.error("Quelle fehlt:  node scripts/make-rezeption.mjs <bild.png>");
  process.exit(1);
}

/** Schriftfeld an der Wand, als Anteil der Bildmaße. */
const FIELD = { x: 0.075, y: 0.12, w: 0.30, h: 0.30 };

/**
 * Das echte Praxis-Monogramm (identisch zu components/ui/Logo.tsx) plus
 * Wortmarke. Gerendert auf transparentem Grund, damit die Wandtextur
 * darunter sichtbar bleibt.
 */
function logoSvg(w, h) {
  const mark = 0.34 * h;
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${w * 0.30} ${h * 0.04}) scale(${mark / 48})" fill="#86BC23">
      <path d="M6 12c0-3.3 2.7-6 6-6h14c3.3 0 6 2.7 6 6v4c0 3.3-2.7 6-6 6H14v-4h11.4c1.1 0 2-.9 2-2v-3.6c0-1.1-.9-2-2-2H12.6c-1.1 0-2 .9-2 2V42H6V12Z"/>
      <path d="M42 36c0 3.3-2.7 6-6 6H22c-3.3 0-6-2.7-6-6v-4c0-3.3 2.7-6 6-6h12v4H22.6c-1.1 0-2 .9-2 2v3.6c0 1.1.9 2 2 2h12.8c1.1 0 2-.9 2-2V6H42v30Z"/>
    </g>
    <text x="${w * 0.5}" y="${h * 0.58}" text-anchor="middle"
      font-family="Helvetica, Arial, sans-serif" font-size="${h * 0.115}"
      letter-spacing="${h * 0.022}" fill="#3d4a3f" font-weight="600">PROKTOLOGIE</text>
    <text x="${w * 0.5}" y="${h * 0.75}" text-anchor="middle"
      font-family="Helvetica, Arial, sans-serif" font-size="${h * 0.115}"
      letter-spacing="${h * 0.022}" fill="#86BC23" font-weight="600">EIMSBÜTTEL</text>
  </svg>`);
}

const img = sharp(SRC);
const meta = await img.metadata();
const W = meta.width;
const H = meta.height;

const fx = Math.round(FIELD.x * W);
const fy = Math.round(FIELD.y * H);
const fw = Math.round(FIELD.w * W);
const fh = Math.round(FIELD.h * H);

// ---- 1. Fremdschrift ausblenden ----
/*
 * Entsättigen ist hier nicht kosmetisch: Das fremde Logo war kräftig grün
 * und hinterliesse sonst einen Grünschleier auf der Wand, der unter der
 * neuen Wortmarke als Geist sichtbar bleibt.
 */
const blurred = await sharp(SRC)
  .extract({ left: fx, top: fy, width: fw, height: fh })
  .blur(26)
  .modulate({ saturation: 0.12 })
  .toBuffer();
const feather = Buffer.from(`<svg width="${fw}" height="${fh}" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="m" cx="0.5" cy="0.5" r="0.62">
    <stop offset="0.55" stop-color="#fff" stop-opacity="1"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${fw}" height="${fh}" fill="url(#m)"/></svg>`);
const patch = await sharp(blurred).composite([{ input: feather, blend: "dest-in" }]).png().toBuffer();

// ---- 2. Echtes Logo perspektivisch setzen ----
const lw = Math.round(fw * 0.62);
const lh = Math.round(fh * 0.52);
/*
 * Die Wand flieht leicht nach links: eine Scherung nähert das an. sharp
 * kann nur affin (kein echter Perspektiv-Warp) – bei dieser flachen
 * Wandneigung ist der Unterschied nicht sichtbar.
 */
const logo = await sharp(logoSvg(lw, lh))
  .affine([1, 0, -0.09, 1], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const logoMeta = await sharp(logo).metadata();

const withLogo = await sharp(SRC)
  .composite([
    { input: patch, left: fx, top: fy },
    {
      input: logo,
      left: fx + Math.round((fw - logoMeta.width) / 2),
      top: fy + Math.round(fh * 0.16),
      // leicht durchscheinend: Wandschrift, nicht Aufkleber
      blend: "over",
    },
  ])
  .png()
  .toBuffer();

// ---- 3. Auf 2400 px hochziehen ----
await sharp(withLogo)
  .resize(2400, Math.round((2400 * H) / W), { kernel: "lanczos3" })
  .sharpen({ sigma: 0.8 })
  .webp({ quality: 90 })
  .toFile(OUT);

const out = await sharp(OUT).metadata();
console.log(`rezeption-2400.webp: ${out.width}x${out.height} (Quelle ${W}x${H})`);
