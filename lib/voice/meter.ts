/**
 * Die Aussteuerungsanzeige.
 *
 * Nur Browser: `AudioContext` und `AnalyserNode` gibt es in Node nicht,
 * darum steht das hier getrennt von `live.ts` und `pcm.ts`, die ohne
 * Browser prüfbar bleiben. Die Rechnung selbst – Effektivwert, Dezibel,
 * Balken – kommt aus `pcm.ts` und ist dort geprüft.
 *
 * Warum überhaupt: Wer spricht und nichts sieht, hat ein stummes Mikrofon –
 * und merkt es sofort statt nach einer Minute Warten.
 */

import { levelBar, levelDb } from "./pcm.ts";

/** Höchstens so oft wird gezeichnet – die Anzeige soll atmen, nicht flackern. */
const FRAME_MS = 80;

/** Pegel liefern, bis die zurückgegebene Funktion aufgerufen wird. */
export function startMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctx = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx || typeof requestAnimationFrame !== "function") return () => {};
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const frame = new Float32Array(analyser.fftSize);
  let raf = 0;
  let last = 0;
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    if (now - last >= FRAME_MS) {
      last = now;
      analyser.getFloatTimeDomainData(frame);
      onLevel(levelBar(levelDb(frame)));
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
    } catch {
      // schon getrennt
    }
    void ctx.close().catch(() => {});
    onLevel(0);
  };
}
