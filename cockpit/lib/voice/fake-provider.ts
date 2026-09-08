/**
 * Ein Sprachanbieter, der nicht zuhört.
 *
 * Vorbild ist `e2e/fake-llm.mjs`: Das gestellte Modell dort erfindet
 * nichts, es gibt zurück, was der Test ihm vorher gesagt hat. Genauso
 * hier. Dieser Anbieter erkennt keine Sprache – er bekommt vom Test eine
 * Liste von Sätzen und gibt den nächsten aus, sobald genug stimmhaftes
 * Audio und danach genug Stille eingetroffen ist.
 *
 * Das klingt nach wenig und ist der Kern der Prüfbarkeit: Damit stehen
 * **die echte Stimmerkennung, die echte Regel „galt das mir?" und der
 * echte Gesprächsverlauf** unter Test, während der Test nur einen Sinus
 * und Nullen erzeugen muss. Kein Schlüssel, kein Netz, kein Ton, der den
 * Rechner verlässt – und keine Zeile Sonderbehandlung im Produktivcode.
 *
 * Ausführen:  node --test lib/voice/fake-provider.test.mjs
 */

import { DEFAULT_VAD, feed, initialVad, type VadState } from "./audio/vad.ts";
import type { Pcm, SpeakOptions, SpeechProvider, SttOptions, SttSession } from "./provider.ts";

export type FakeMode =
  /** Alles normal. */
  | "ok"
  /** Erkennung antwortet spät – prüft die Denk-Zeitüberschreitung. */
  | "slow"
  /** Die Sitzung bricht mitten im Gespräch ab. */
  | "drop"
  /** Unsinn statt Text – prüft, dass daraus nichts gebucht wird. */
  | "garbage"
  /** Die Sprachausgabe liefert nichts – prüft, dass es nicht still endet. */
  | "mute";

export interface FakeOptions {
  /** Die Sätze, die der Reihe nach „erkannt" werden. */
  script?: string[];
  mode?: FakeMode;
  /** Verzögerung bis zum erkannten Satz, in Millisekunden. */
  latencyMs?: number;
  /** Zeitgeber – im Test gestellt, damit nichts wirklich wartet. */
  sleep?: (ms: number) => Promise<void>;
}

export interface FakeCall {
  kind: "listen" | "speak";
  at: number;
  text?: string;
  lang: string;
}

/**
 * Der gestellte Anbieter. Er merkt sich, was von ihm verlangt wurde –
 * ein Test kann damit belegen, dass in einem Nebengespräch **kein**
 * einziger Aufruf entstanden ist.
 */
export class FakeSpeechProvider implements SpeechProvider {
  readonly name = "fake";
  calls: FakeCall[] = [];
  aborted = 0;
  private script: string[];
  private cursor = 0;
  private mode: FakeMode;
  private latencyMs: number;
  private sleep: (ms: number) => Promise<void>;
  private now = 0;

  constructor(options: FakeOptions = {}) {
    this.script = [...(options.script ?? [])];
    this.mode = options.mode ?? "ok";
    this.latencyMs = options.latencyMs ?? 0;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Das Drehbuch austauschen – wie `POST /__script` beim gestellten Modell. */
  setScript(lines: string[]): void {
    this.script = [...lines];
    this.cursor = 0;
  }

  setMode(mode: FakeMode): void {
    this.mode = mode;
  }

  reset(): void {
    this.calls = [];
    this.aborted = 0;
    this.cursor = 0;
    this.now = 0;
  }

  /** Was noch nicht ausgegeben wurde. */
  get remaining(): number {
    return Math.max(0, this.script.length - this.cursor);
  }

  async listen(options: SttOptions): Promise<SttSession> {
    this.calls.push({ kind: "listen", at: this.now, lang: options.lang });
    return new FakeSttSession(this, options);
  }

  async *speak(text: string, options: SpeakOptions): AsyncIterable<Pcm> {
    this.calls.push({ kind: "speak", at: this.now, text, lang: options.lang });
    if (this.mode === "mute") return;
    // Etwa 12 Zeichen je 100 ms – nah genug an gesprochenem Deutsch, um
    // Unterbrechungen an einer realistischen Stelle zu treffen.
    const chunks = Math.max(1, Math.ceil(text.length / 12));
    let finished = false;
    try {
      for (let i = 0; i < chunks; i++) {
        if (options.signal?.aborted) return;
        if (this.latencyMs > 0) await this.sleep(this.latencyMs);
        yield tone(2400, 0.2);
      }
      finished = true;
    } finally {
      // Abgebrochen wird auf zwei Wegen: Das Signal steht, oder der
      // Empfänger verlässt die Schleife und schließt den Erzeuger. Beides
      // heißt dasselbe – der Satz wurde nicht zu Ende gesprochen –, und
      // beides muss gezählt werden, sonst prüft ein Test etwas anderes,
      // als er behauptet.
      if (!finished) this.aborted += 1;
    }
  }

  /** Nur für die Sitzung: den nächsten Satz aus dem Drehbuch holen. */
  nextLine(): string | null {
    if (this.mode === "garbage") return "%%% ??? ###";
    if (this.cursor >= this.script.length) return null;
    const line = this.script[this.cursor] ?? null;
    this.cursor += 1;
    return line;
  }

  get currentMode(): FakeMode {
    return this.mode;
  }

  get latency(): number {
    return this.latencyMs;
  }

  get clock(): number {
    return this.now;
  }

  advance(ms: number): void {
    this.now += ms;
  }

  wait(ms: number): Promise<void> {
    return this.sleep(ms);
  }
}

/**
 * Eine gestellte Erkennungssitzung. Sie führt eine **echte**
 * Stimmerkennung über das eingespeiste Audio – nur der Text kommt aus
 * dem Drehbuch. Dadurch werden Unterbrechen und Turn-Erkennung an
 * echtem Verhalten geprüft und nicht an einem Zeitgeber.
 */
class FakeSttSession implements SttSession {
  open = true;
  private vad: VadState = initialVad();
  private frames = 0;

  // Keine Parameter-Properties: Node 22 entfernt Typen, erzeugt aber
  // keinen Code – eine Kurzschreibweise im Konstruktor liefe hier nicht.
  private readonly provider: FakeSpeechProvider;
  private readonly options: SttOptions;

  constructor(provider: FakeSpeechProvider, options: SttOptions) {
    this.provider = provider;
    this.options = options;
  }

  write(frame: Pcm): void {
    if (!this.open) return;
    this.frames += 1;
    this.provider.advance(DEFAULT_VAD.frameMs);
    const at = this.provider.clock;

    if (this.provider.currentMode === "drop" && this.frames > 50) {
      this.open = false;
      return;
    }

    const { state, result } = feed(this.vad, frame);
    this.vad = state;

    if (result.edge === "start") {
      this.options.onEvent({ kind: "speech_started", at });
      return;
    }
    if (result.edge === "end") {
      this.options.onEvent({ kind: "speech_stopped", at });
      const line = this.provider.nextLine();
      if (line === null) return;
      const emit = () => {
        if (!this.open) return;
        this.options.onEvent({
          kind: "final",
          at: this.provider.clock,
          text: line,
          durationMs: result.durationMs,
          relativeDb: result.relativeDb,
        });
        this.options.onEvent({ kind: "turn_end", at: this.provider.clock });
      };
      if (this.provider.currentMode === "slow" && this.provider.latency > 0) {
        void this.provider.wait(this.provider.latency).then(emit);
      } else {
        emit();
      }
    }
  }

  async close(): Promise<void> {
    this.open = false;
  }
}

/** Ein Rahmen Sinus – das einzige „Audio", das ein Test erzeugen muss. */
export function tone(hz = 220, amplitude = 0.3, rate = 24_000, ms = DEFAULT_VAD.frameMs): Int16Array {
  const n = Math.round((rate * ms) / 1000);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * amplitude * 32767);
  return out;
}

/** Ein Rahmen sehr leises Rauschen – Stille, aber keine mathematische Null. */
export function room(amplitude = 0.001, rate = 24_000, ms = DEFAULT_VAD.frameMs, seedStart = 1): Int16Array {
  const n = Math.round((rate * ms) / 1000);
  const out = new Int16Array(n);
  let seed = seedStart;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = Math.round(((seed / 0xffffffff) * 2 - 1) * amplitude * 32767);
  }
  return out;
}
