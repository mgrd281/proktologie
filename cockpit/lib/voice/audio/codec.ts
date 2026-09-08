/**
 * Die Kante zwischen Telefon und Rest der Welt.
 *
 * Ein Telefonanruf kommt als G.711 µ-law mit 8 kHz an: acht Bit je Probe,
 * logarithmisch gestaucht, seit 1972 unverändert. Alles oberhalb dieser
 * Kante rechnet mit linearem PCM16 bei 24 kHz – ein Format, ein
 * Rahmenmaß, eine Lautstärkeskala. Wer die Umrechnung überall verstreut,
 * hat am Ende an drei Stellen einen anderen Pegel und wundert sich über
 * die Erkennungsqualität.
 *
 * Zwei Warnungen, die im Code stehen und nicht im Kopf bleiben sollen:
 *
 *  - Beim Hochrechnen von 8 auf 24 kHz entsteht **keine** Information.
 *    Was das Telefon nicht überträgt, ist weg. Die Erkennung sieht
 *    Telefonqualität, egal welche Zahl im Format steht.
 *  - Lineare Interpolation ist für Sprache gut genug und für Musik nicht.
 *    Hier geht es um Sprache.
 *
 * Ausführen:  node --test lib/voice/audio/codec.test.mjs
 */

const BIAS = 0x84;
const CLIP = 32635;

/** Eine lineare 16-Bit-Probe in ein µ-law-Byte. */
export function encodeMulaw(sample: number): number {
  let s = Math.max(-32768, Math.min(32767, Math.round(sample)));
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s = s + BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent -= 1;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

/** Ein µ-law-Byte zurück in eine lineare 16-Bit-Probe. */
export function decodeMulaw(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  const value = sign ? -sample : sample;
  // Die negative Null von G.711 wird zur gewöhnlichen Null: Ein -0 sieht
  // überall gleich aus, verhält sich aber bei Object.is und in JSON
  // anders – ein Fehler, den man erst im Betrieb findet.
  return value === 0 ? 0 : value;
}

export function encodeMulawBuffer(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = encodeMulaw(pcm[i] ?? 0);
  return out;
}

export function decodeMulawBuffer(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = decodeMulaw(bytes[i] ?? 0);
  return out;
}

/**
 * Lineare Neuabtastung. Für ganzzahlige Verhältnisse (8 → 24, 48 → 24)
 * exakt genug; für Sprache generell.
 *
 * Bewusst ohne Tiefpass beim Herunterrechnen: Die Quellen, die hier
 * ankommen, sind entweder schon bandbegrenzt (Telefon) oder kommen aus
 * einem `AudioContext`, der bereits gefiltert hat. Ein eigener Filter
 * würde Rechenzeit kosten und im Zweifel mehr kaputt machen als heilen.
 */
export function resample(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate || input.length === 0) return input.slice();
  if (fromRate <= 0 || toRate <= 0) throw new Error("Abtastrate muss positiv sein");
  const ratio = toRate / fromRate;
  const outLength = Math.max(1, Math.round(input.length * ratio));
  const out = new Int16Array(outLength);
  const step = (input.length - 1) / Math.max(1, outLength - 1);
  for (let i = 0; i < outLength; i++) {
    const pos = i * step;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    const value = (input[left] ?? 0) * (1 - frac) + (input[right] ?? 0) * frac;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(value)));
  }
  return out;
}

/** Telefon herein: µ-law 8 kHz → PCM16 24 kHz. */
export function phoneToPcm24(bytes: Uint8Array): Int16Array {
  return resample(decodeMulawBuffer(bytes), 8000, 24_000);
}

/** Telefon hinaus: PCM16 24 kHz → µ-law 8 kHz. */
export function pcm24ToPhone(pcm: Int16Array): Uint8Array {
  return encodeMulawBuffer(resample(pcm, 24_000, 8000));
}

/** Kleine Hilfe für den Browser: Float32 aus dem Worklet zu PCM16. */
export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = Math.round(v < 0 ? v * 32768 : v * 32767);
  }
  return out;
}
