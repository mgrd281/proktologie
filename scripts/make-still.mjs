/**
 * Schneidet aus einem hochauflösenden Praxisfoto die Standbild-Quelle für
 * eine Filmszene zu.
 *
 * Ausführen:
 *   node scripts/make-still.mjs <foto.jpg> <name> <cx> <cw> <cy> <breite>
 *
 *   cx / cy   Mittelpunkt des Ausschnitts als Anteil (0…1)
 *   cw        Breite des Ausschnitts als Anteil der Originalbreite
 *   breite    Zielbreite der gespeicherten Datei in Pixeln
 *
 * Ausgabe: public/images/<name>.webp im Seitenverhältnis 4:3.
 *
 * Warum 4:3 und nicht 16:9: Der Still-Renderer im Bake schneidet pro
 * Frame ein 16:9-Fenster aus dieser Datei – die überschüssige Höhe ist
 * der vertikale Spielraum der Kamerafahrt. Und warum überhaupt ein
 * Vorab-Zuschnitt statt des vollen Fotos: Je enger der gespeicherte
 * Ausschnitt, desto mehr echte Vergrösserung liefert derselbe Zoomwert,
 * ohne je hochzuskalieren.
 *
 * Retuschiert wird hier NICHT. Was ins Bild kommt, stammt aus dem Foto.
 */

import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = new URL("..", import.meta.url).pathname;
const [src, name, cxArg, cwArg, cyArg, widthArg] = process.argv.slice(2);

if (!src || !name || [cxArg, cwArg, cyArg, widthArg].some((v) => !Number.isFinite(Number(v)))) {
  console.error("Aufruf:  node scripts/make-still.mjs <foto.jpg> <name> <cx> <cw> <cy> <breite>");
  process.exit(1);
}

const cx = Number(cxArg);
const cwFrac = Number(cwArg);
const cy = Number(cyArg);
const outW = Number(widthArg);

const meta = await sharp(src).metadata();
const cw = Math.round(meta.width * cwFrac);
const ch = Math.round((cw * 3) / 4);
const left = Math.max(0, Math.min(meta.width - cw, Math.round(cx * meta.width - cw / 2)));
const top = Math.max(0, Math.min(meta.height - ch, Math.round(cy * meta.height - ch / 2)));

const target = join(ROOT, `public/images/${name}.webp`);
await sharp(src)
  .extract({ left, top, width: cw, height: ch })
  .resize(outW, Math.round((outW * 3) / 4), { kernel: "lanczos3" })
  .webp({ quality: 90 })
  .toFile(target);

const out = await sharp(target).metadata();
console.log(
  `${name}.webp: ${out.width}x${out.height} — Ausschnitt ${cw}x${ch} bei (${left}, ${top}) aus ${meta.width}x${meta.height}`,
);
