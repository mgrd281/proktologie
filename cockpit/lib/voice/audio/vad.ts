/**
 * Wann spricht jemand?
 *
 * Diese Frage entscheidet dreierlei, und deshalb steht sie in einem
 * eigenen, prüfbaren Modul:
 *
 *  1. **Unterbrechen.** Der Assistent muss verstummen, sobald der Patient
 *     spricht. Auf ein Transkript zu warten wäre viel zu spät – das
 *     dauert eine knappe Sekunde. Der Auslöser ist Energie, nicht Text.
 *  2. **Kosten.** Abgerechnet wird nach Audiodauer. Wer Stille überträgt,
 *     bezahlt Stille. Ein offener Browser-Tab über einen Arbeitstag wäre
 *     sonst ein dreistelliger Betrag im Monat.
 *  3. **Datenschutz.** Was hier nicht durchgelassen wird, verlässt das
 *     Gerät nie. Ein Gespräch im Wartezimmer, das gar nicht erst gesendet
 *     wird, ist die einzige wirklich sichere Form der Nichtübertragung.
 *
 * Bewusst kein Modell, keine Bibliothek: Energie über einem Rauschboden,
 * der sich der Umgebung anpasst, mit Vorlauf und Nachlauf. Das ist
 * berechenbar, schnell genug für 20-Millisekunden-Rahmen und lässt sich
 * ohne Mikrofon prüfen.
 *
 * Ausführen:  node --test lib/voice/audio/vad.test.mjs
 */

export interface VadConfig {
  /** Länge eines Rahmens in Millisekunden. */
  frameMs: number;
  /** So viel lauter als der Rauschboden gilt als Stimme (in Dezibel). */
  openDb: number;
  /**
   * So viel lauter muss es sein, solange der Assistent selbst spricht.
   * Höher angesetzt, damit die eigene Stimme aus dem Lautsprecher das
   * Gespräch nicht zerlegt.
   */
  openDbWhileSpeaking: number;
  /** So viele stimmhafte Rahmen hintereinander, dann gilt es als Sprache. */
  onFrames: number;
  /** So lange nach dem letzten stimmhaften Rahmen bleibt es offen. */
  hangoverMs: number;
  /** Wie schnell sich der Rauschboden nach oben anpasst (0..1 je Rahmen). */
  riseRate: number;
  /** Wie schnell er nach unten folgt – schneller, damit Stille erkannt wird. */
  fallRate: number;
  /**
   * Absolute Untergrenze als Notnagel. Sie soll nur pathologische Fälle
   * abfangen; die eigentliche Entscheidung trifft der Abstand zum
   * Rauschboden. Zu hoch angesetzt würde sie die relativen Schwellen
   * überstimmen und damit unwirksam machen.
   */
  floorDb: number;
  /**
   * Am Anfang jeder Sitzung wird nur gemessen, nicht ausgelöst. Ohne das
   * hält der Kaltstart jedes Raumgeräusch für den ersten Satz – die
   * ersten Rahmen liegen zwangsläufig über einem Rauschboden, den noch
   * niemand kennt.
   */
  calibrateMs: number;
}

export const DEFAULT_VAD: VadConfig = {
  frameMs: 20,
  openDb: 6,
  openDbWhileSpeaking: 11,
  onFrames: 3,
  hangoverMs: 400,
  riseRate: 0.02,
  fallRate: 0.2,
  floorDb: -65,
  calibrateMs: 250,
};

export interface VadState {
  /** Geschätzter Rauschboden in Dezibel. */
  noiseDb: number;
  /** Aufeinanderfolgende stimmhafte Rahmen. */
  run: number;
  /** Läuft gerade eine Äußerung? */
  open: boolean;
  /** Millisekunden seit dem letzten stimmhaften Rahmen. */
  quietMs: number;
  /** Gesamtdauer der laufenden Äußerung. */
  voicedMs: number;
  /** Lautester Pegel der laufenden Äußerung – Grundlage für „abgewandt". */
  peakDb: number;
  /** Summe der Pegel und Anzahl, für den Median-Ersatz (Mittelwert). */
  sumDb: number;
  frames: number;
  /** Gleitender Sprechpegel über die ganze Sitzung. */
  speechDb: number | null;
  /** Wie lange diese Sitzung schon läuft – für die Einmessung. */
  elapsedMs: number;
}

export function initialVad(noiseDb = -60): VadState {
  return { noiseDb, run: 0, open: false, quietMs: 0, voicedMs: 0, peakDb: -Infinity, sumDb: 0, frames: 0, speechDb: null, elapsedMs: 0 };
}

export type VadEdge =
  /** Nichts Neues. */
  | { edge: "none"; db: number; voiced: boolean }
  /** Eine Äußerung beginnt. */
  | { edge: "start"; db: number; voiced: true }
  /** Eine Äußerung endet. */
  | {
      edge: "end";
      db: number;
      voiced: false;
      /** Wie lange gesprochen wurde. */
      durationMs: number;
      /** Mittlerer Pegel dieser Äußerung, relativ zum Sprechpegel der Sitzung. */
      relativeDb: number;
    };

/** Effektivwert eines Rahmens in Dezibel, bezogen auf Vollaussteuerung. */
export function frameDb(samples: Int16Array | number[]): number {
  let sum = 0;
  const n = samples.length;
  if (n === 0) return -Infinity;
  for (let i = 0; i < n; i++) {
    const v = (samples[i] ?? 0) / 32768;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Einen Rahmen verarbeiten. `speaking` sagt, ob der Assistent gerade
 * selbst redet – dann liegt die Schwelle höher, damit er sich nicht durch
 * den Lautsprecher selbst unterbricht.
 */
export function feed(state: VadState, samples: Int16Array | number[], speaking = false, config: VadConfig = DEFAULT_VAD): { state: VadState; result: VadEdge } {
  const s: VadState = { ...state };
  s.elapsedMs = state.elapsedMs + config.frameMs;
  const db = frameDb(samples);
  const finite = Number.isFinite(db) ? db : config.floorDb - 20;

  // Einmessen: Am Anfang wird der Rauschboden zügig auf die Umgebung
  // gezogen und nichts ausgelöst. Sonst gilt das Öffnen des Mikrofons
  // selbst als erster Satz.
  if (state.elapsedMs < config.calibrateMs) {
    s.noiseDb = s.noiseDb + (finite - s.noiseDb) * 0.5;
    s.run = 0;
    return { state: s, result: { edge: "none", db: finite, voiced: false } };
  }

  const threshold = s.noiseDb + (speaking ? config.openDbWhileSpeaking : config.openDb);
  const voiced = finite > threshold && finite > config.floorDb;

  if (voiced) {
    s.run += 1;
    s.quietMs = 0;
    s.voicedMs += config.frameMs;
    s.peakDb = Math.max(s.peakDb, finite);
    s.sumDb += finite;
    s.frames += 1;
    // Der Rauschboden darf während Sprache nicht mitwachsen, sonst
    // „gewöhnt" er sich an die Stimme und schaltet mitten im Satz ab.
  } else {
    s.run = 0;
    s.quietMs += config.frameMs;
    // Nach oben langsam, nach unten schnell: Ein kurzes Geräusch hebt den
    // Boden nicht dauerhaft an, eine ruhiger werdende Umgebung wird zügig
    // erkannt.
    const rate = finite > s.noiseDb ? config.riseRate : config.fallRate;
    s.noiseDb = s.noiseDb + (finite - s.noiseDb) * rate;
  }

  if (!state.open && s.run >= config.onFrames) {
    s.open = true;
    s.voicedMs = config.frameMs * config.onFrames;
    s.sumDb = finite * config.onFrames;
    s.frames = config.onFrames;
    s.peakDb = finite;
    return { state: s, result: { edge: "start", db: finite, voiced: true } };
  }

  if (state.open && !voiced && s.quietMs >= config.hangoverMs) {
    s.open = false;
    const mean = s.frames > 0 ? s.sumDb / s.frames : finite;
    // Der Sprechpegel der Sitzung ist der gleitende Mittelwert aller
    // Äußerungen – daran misst sich, ob jemand abgewandt gesprochen hat.
    s.speechDb = s.speechDb === null ? mean : s.speechDb * 0.7 + mean * 0.3;
    const relativeDb = state.speechDb === null ? 0 : mean - state.speechDb;
    const durationMs = s.voicedMs;
    s.voicedMs = 0;
    s.sumDb = 0;
    s.frames = 0;
    s.peakDb = -Infinity;
    return { state: s, result: { edge: "end", db: finite, voiced: false, durationMs, relativeDb } };
  }

  return { state: s, result: { edge: "none", db: finite, voiced } };
}
