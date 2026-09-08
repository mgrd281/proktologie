/**
 * Was zwischen Mikrofon und Leitung passiert.
 *
 * Der Browser liefert Fließkommazahlen mit der Abtastrate, die er gerade
 * für richtig hält – die gewünschte Rate ist eine Bitte, keine Zusage,
 * und Safari ignoriert sie regelmäßig. Hier wird daraus, was der
 * Sprachdienst erwartet: ganzzahlige Proben mit 24 kHz.
 *
 * Reine Funktionen, ohne `AudioContext` und ohne Fenster – damit prüfbar
 * ohne Browser:
 *
 *   node --experimental-strip-types --test lib/voice/pcm.test.mjs
 */

/** Die Rate, mit der alles oberhalb des Mikrofons rechnet. */
export const TARGET_RATE = 24_000;

/**
 * Fließkomma zu ganzzahligen Proben. Bewusst mit unterschiedlichen
 * Faktoren für positiv und negativ: Der Wertebereich ist nicht
 * symmetrisch, und wer das übersieht, klippt jede laute Stelle.
 */
export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = Math.round(v < 0 ? v * 32768 : v * 32767);
  }
  return out;
}

/** Und zurück – für die Wiedergabe im Browser. */
export function pcm16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = input[i] ?? 0;
    out[i] = v < 0 ? v / 32768 : v / 32767;
  }
  return out;
}

/**
 * Lineare Neuabtastung. Für Sprache ausreichend, für Musik nicht – hier
 * geht es um Sprache.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= 0 || toRate <= 0) throw new Error("Abtastrate muss positiv sein");
  if (fromRate === toRate || input.length === 0) return input.slice();
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLength);
  const step = (input.length - 1) / Math.max(1, outLength - 1);
  for (let i = 0; i < outLength; i++) {
    const pos = i * step;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = (input[left] ?? 0) * (1 - frac) + (input[right] ?? 0) * frac;
  }
  return out;
}

/** Der ganze Weg vom Worklet zur Leitung, in einem Schritt. */
export function prepareFrame(frame: Float32Array, sourceRate: number): Int16Array {
  return floatToPcm16(sourceRate === TARGET_RATE ? frame : resample(frame, sourceRate, TARGET_RATE));
}

/**
 * Effektivwert in Dezibel. Der Browser zeigt damit eine ehrliche
 * Aussteuerungsanzeige: Wer nichts sieht, während er spricht, hat ein
 * stummes Mikrofon – und merkt es sofort statt nach einer Minute.
 */
export function levelDb(frame: Float32Array | Int16Array): number {
  if (frame.length === 0) return -Infinity;
  const scale = frame instanceof Int16Array ? 32768 : 1;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = (frame[i] ?? 0) / scale;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / frame.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/** Von Dezibel zu einem Balken zwischen 0 und 1, wie ihn ein Mensch erwartet. */
export function levelBar(db: number, floorDb = -60): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - floorDb) / -floorDb));
}
