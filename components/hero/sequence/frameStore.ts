import {
  DECODE_CONCURRENCY,
  FETCH_CONCURRENCY,
  FRAME_COUNT,
  framePath,
  LADDER_STEP,
  LADDER_WIDTH,
  WINDOW_CAPACITY,
  WINDOW_RADIUS,
} from "@/components/hero/sequence/config";

/**
 * Lädt und verwaltet die Frames der Hero-Sequenz.
 *
 * – Alle Frames werden als komprimierte Blobs vorgeladen
 *   (fetch, begrenzte Parallelität; ~20–40 KB pro WebP).
 * – Dekodiert wird über createImageBitmap in zwei Stufen:
 *   Grob-Leiter (dauerhaft, halbe Auflösung) + Voll-Auflösungs-Fenster
 *   um den Playhead (LRU) – siehe config.ts.
 * – nearest() liefert immer den nächstgelegenen bereits dekodierten
 *   Frame, wenn der exakt angefragte noch nicht verfügbar ist.
 */
export class FrameStore {
  private blobs = new Map<number, Blob>();
  private ladder = new Map<number, ImageBitmap>();
  private window = new Map<number, ImageBitmap>();
  private windowOrder: number[] = [];
  private decodeQueue: number[] = [];
  private decoding = new Set<number>();
  private activeDecodes = 0;
  private aborter = new AbortController();
  private destroyed = false;
  private playhead = 1;
  private direction: 1 | -1 = 1;

  /** Wird gerufen, sobald ein neuer Frame gezeichnet werden kann. */
  onFrameReady?: () => void;

  loadedBlobs = 0;

  /** Startet das Vorladen; Leiter-Frames zuerst, dann der Rest. */
  start(): void {
    const ladderFirst: number[] = [];
    const rest: number[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      (this.isLadderIndex(i) ? ladderFirst : rest).push(i);
    }
    const queue = [...ladderFirst, ...rest];
    for (let w = 0; w < FETCH_CONCURRENCY; w++) {
      void this.fetchWorker(queue);
    }
  }

  private isLadderIndex(i: number): boolean {
    return (i - 1) % LADDER_STEP === 0 || i === FRAME_COUNT;
  }

  private async fetchWorker(queue: number[]): Promise<void> {
    while (queue.length > 0 && !this.destroyed) {
      const i = queue.shift();
      if (i === undefined) return;
      try {
        const res = await fetch(framePath(i), { signal: this.aborter.signal });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (this.destroyed) return;
        this.blobs.set(i, blob);
        this.loadedBlobs++;
        if (this.isLadderIndex(i)) {
          void this.decodeLadder(i, blob);
        } else if (Math.abs(i - this.playhead) <= WINDOW_RADIUS) {
          this.requestFull(i);
        }
      } catch {
        // abgebrochen oder Netzfehler – nearest() überbrückt Lücken
      }
    }
  }

  private async decodeLadder(i: number, blob: Blob): Promise<void> {
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: LADDER_WIDTH,
      });
      if (this.destroyed) {
        bitmap.close();
        return;
      }
      this.ladder.set(i, bitmap);
      this.onFrameReady?.();
    } catch {
      /* Frame bleibt Lücke – nearest() überbrückt */
    }
  }

  /**
   * Aktualisiert den Playhead und plant Voll-Dekodierungen im Fenster,
   * in Scrollrichtung priorisiert.
   */
  setPlayhead(frame: number, direction: 1 | -1): void {
    this.playhead = Math.max(1, Math.min(FRAME_COUNT, frame));
    this.direction = direction;
    const ahead = WINDOW_RADIUS;
    const behind = 12;
    for (let d = 0; d <= ahead; d++) {
      this.requestFull(this.playhead + d * this.direction);
      if (d <= behind) this.requestFull(this.playhead - d * this.direction);
    }
    this.pumpDecodes();
  }

  private requestFull(i: number): void {
    if (i < 1 || i > FRAME_COUNT) return;
    if (this.window.has(i) || this.decoding.has(i)) return;
    if (!this.blobs.has(i)) return;
    if (!this.decodeQueue.includes(i)) this.decodeQueue.push(i);
  }

  private pumpDecodes(): void {
    // Nah am Playhead zuerst
    this.decodeQueue.sort(
      (a, b) => Math.abs(a - this.playhead) - Math.abs(b - this.playhead),
    );
    while (this.activeDecodes < DECODE_CONCURRENCY) {
      const i = this.decodeQueue.shift();
      if (i === undefined) return;
      if (this.window.has(i) || this.decoding.has(i)) continue;
      const blob = this.blobs.get(i);
      if (!blob) continue;
      this.decoding.add(i);
      this.activeDecodes++;
      void createImageBitmap(blob)
        .then((bitmap) => {
          if (this.destroyed) {
            bitmap.close();
            return;
          }
          this.window.set(i, bitmap);
          this.windowOrder.push(i);
          this.evict();
          this.onFrameReady?.();
        })
        .catch(() => undefined)
        .finally(() => {
          this.decoding.delete(i);
          this.activeDecodes--;
          this.pumpDecodes();
        });
    }
  }

  private evict(): void {
    while (this.windowOrder.length > WINDOW_CAPACITY) {
      // Ältesten Eintrag entfernen, der außerhalb des Fensters liegt
      const idx = this.windowOrder.findIndex(
        (i) => Math.abs(i - this.playhead) > WINDOW_RADIUS,
      );
      const victim =
        idx >= 0 ? this.windowOrder.splice(idx, 1)[0] : this.windowOrder.shift();
      if (victim === undefined) return;
      this.window.get(victim)?.close();
      this.window.delete(victim);
    }
  }

  /**
   * Exakter Frame, sonst der nächstgelegene dekodierte
   * (Voll-Fenster vor Leiter).
   */
  nearest(i: number): ImageBitmap | null {
    const exact = this.window.get(i);
    if (exact) return exact;
    const exactLadder = this.ladder.get(i);
    if (exactLadder) return exactLadder;
    for (let d = 1; d <= FRAME_COUNT; d++) {
      const lo = this.window.get(i - d);
      if (lo) return lo;
      const hi = this.window.get(i + d);
      if (hi) return hi;
      // Leiter parallel prüfen (grober, aber sofort verfügbar)
      const ladderLo = this.ladder.get(i - d);
      if (ladderLo) return ladderLo;
      const ladderHi = this.ladder.get(i + d);
      if (ladderHi) return ladderHi;
    }
    return this.ladder.get(i) ?? null;
  }

  destroy(): void {
    this.destroyed = true;
    this.aborter.abort();
    this.ladder.forEach((bitmap) => bitmap.close());
    this.window.forEach((bitmap) => bitmap.close());
    this.ladder.clear();
    this.window.clear();
    this.blobs.clear();
    this.decodeQueue.length = 0;
  }
}
