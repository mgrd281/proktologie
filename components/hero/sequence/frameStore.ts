/**
 * Lädt und verwaltet die Frames EINER Bildsequenz-Quelle.
 *
 * – Alle Frames werden als komprimierte Blobs vorgeladen
 *   (fetch, begrenzte Parallelität; ~20–40 KB pro WebP).
 * – Dekodiert wird über createImageBitmap in zwei Stufen:
 *   Grob-Leiter (dauerhaft, halbe Auflösung) + Voll-Auflösungs-Fenster
 *   um den Playhead (LRU).
 * – nearest() liefert immer den nächstgelegenen bereits dekodierten
 *   Frame, wenn der exakt angefragte noch nicht verfügbar ist.
 *
 * Seit der Frame-Timeline-Engine ist der Store QUELLEN-NEUTRAL: Die
 * Konfiguration kommt in den Konstruktor (Pfadschema, Anzahl, Fenster),
 * sodass der Compositor mehrere Sequenzen gleichzeitig halten kann.
 * pause()/resume() stoppen ferne Quellen, ohne die Leiter zu verlieren.
 */

export interface FrameStoreConfig {
  count: number;
  path: (index: number) => string;
  /** Jeder n-te Frame bleibt dauerhaft dekodiert (halbe Auflösung). */
  ladderStep: number;
  ladderWidth: number;
  /** Voll aufgelöstes Gleitfenster ±radius um den Playhead. */
  windowRadius: number;
  windowCapacity: number;
  fetchConcurrency: number;
  decodeConcurrency: number;
}

/**
 * Speicher-Deckel: WINDOW_RADIUS 28 hält die Voll-Bitmaps der
 * Hauptsequenz unter ~240 MB – Reserve für die Still-Quellen daneben.
 */
export const DEFAULT_STORE_CONFIG: Omit<FrameStoreConfig, "count" | "path"> = {
  ladderStep: 8,
  ladderWidth: 640,
  windowRadius: 28,
  windowCapacity: 2 * 28 + 16,
  fetchConcurrency: 8,
  decodeConcurrency: 4,
};

export class FrameStore {
  private readonly cfg: FrameStoreConfig;
  private blobs = new Map<number, Blob>();
  private ladder = new Map<number, ImageBitmap>();
  private window = new Map<number, ImageBitmap>();
  private windowOrder: number[] = [];
  private decodeQueue: number[] = [];
  private decoding = new Set<number>();
  private activeDecodes = 0;
  private aborter = new AbortController();
  private destroyed = false;
  private paused = false;
  private fetchQueue: number[] = [];
  private fetchWorkers = 0;
  private playhead = 1;
  private direction: 1 | -1 = 1;

  /** Wird gerufen, sobald ein neuer Frame gezeichnet werden kann. */
  onFrameReady?: () => void;

  loadedBlobs = 0;

  constructor(config: FrameStoreConfig) {
    this.cfg = config;
  }

  /** Startet das Vorladen; Leiter-Frames zuerst, dann der Rest. */
  start(): void {
    const ladderFirst: number[] = [];
    const rest: number[] = [];
    for (let i = 1; i <= this.cfg.count; i++) {
      (this.isLadderIndex(i) ? ladderFirst : rest).push(i);
    }
    this.fetchQueue = [...ladderFirst, ...rest];
    this.spawnFetchWorkers();
  }

  private spawnFetchWorkers(): void {
    while (
      this.fetchWorkers < this.cfg.fetchConcurrency &&
      this.fetchQueue.length > 0
    ) {
      this.fetchWorkers++;
      void this.fetchWorker();
    }
  }

  private isLadderIndex(i: number): boolean {
    return (i - 1) % this.cfg.ladderStep === 0 || i === this.cfg.count;
  }

  private async fetchWorker(): Promise<void> {
    try {
      while (this.fetchQueue.length > 0 && !this.destroyed && !this.paused) {
        const i = this.fetchQueue.shift();
        if (i === undefined) return;
        try {
          const res = await fetch(this.cfg.path(i), {
            signal: this.aborter.signal,
          });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (this.destroyed) return;
          this.blobs.set(i, blob);
          this.loadedBlobs++;
          if (this.isLadderIndex(i)) {
            void this.decodeLadder(i, blob);
          } else if (Math.abs(i - this.playhead) <= this.cfg.windowRadius) {
            this.requestFull(i);
          }
        } catch {
          // abgebrochen oder Netzfehler – nearest() überbrückt Lücken
        }
      }
    } finally {
      this.fetchWorkers--;
    }
  }

  private async decodeLadder(i: number, blob: Blob): Promise<void> {
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: this.cfg.ladderWidth,
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
    this.playhead = Math.max(1, Math.min(this.cfg.count, frame));
    this.direction = direction;
    if (this.paused) return;
    const ahead = this.cfg.windowRadius;
    const behind = 12;
    for (let d = 0; d <= ahead; d++) {
      this.requestFull(this.playhead + d * this.direction);
      if (d <= behind) this.requestFull(this.playhead - d * this.direction);
    }
    this.pumpDecodes();
  }

  /**
   * Ferne Quelle stilllegen: keine neuen fetches/Decodes, Fenster leeren.
   * Die Grob-Leiter bleibt – beim resume() ist sofort etwas zeichenbar.
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.decodeQueue.length = 0;
    for (const i of [...this.windowOrder]) {
      this.window.get(i)?.close();
      this.window.delete(i);
    }
    this.windowOrder.length = 0;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.spawnFetchWorkers();
    this.setPlayhead(this.playhead, this.direction);
  }

  private requestFull(i: number): void {
    if (i < 1 || i > this.cfg.count) return;
    if (this.window.has(i) || this.decoding.has(i)) return;
    if (!this.blobs.has(i)) return;
    if (!this.decodeQueue.includes(i)) this.decodeQueue.push(i);
  }

  private pumpDecodes(): void {
    // Nah am Playhead zuerst
    this.decodeQueue.sort(
      (a, b) => Math.abs(a - this.playhead) - Math.abs(b - this.playhead),
    );
    while (this.activeDecodes < this.cfg.decodeConcurrency) {
      const i = this.decodeQueue.shift();
      if (i === undefined) return;
      if (this.window.has(i) || this.decoding.has(i)) continue;
      const blob = this.blobs.get(i);
      if (!blob) continue;
      this.decoding.add(i);
      this.activeDecodes++;
      void createImageBitmap(blob)
        .then((bitmap) => {
          if (this.destroyed || this.paused) {
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
          if (!this.paused) this.pumpDecodes();
        });
    }
  }

  private evict(): void {
    while (this.windowOrder.length > this.cfg.windowCapacity) {
      // Ältesten Eintrag entfernen, der außerhalb des Fensters liegt
      const idx = this.windowOrder.findIndex(
        (i) => Math.abs(i - this.playhead) > this.cfg.windowRadius,
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
    for (let d = 1; d <= this.cfg.count; d++) {
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
    this.fetchQueue.length = 0;
  }
}
