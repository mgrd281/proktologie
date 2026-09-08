/**
 * Die eine Stelle, an der ein Sprachanbieter steht.
 *
 * Der Betreiber hat OpenAI gewählt. Diese Schnittstelle ist trotzdem da –
 * nicht aus Unentschlossenheit, sondern weil die Entscheidung an einer
 * Freigabe hängt, die niemand von uns kontrolliert: Ohne die Zusage zur
 * Verarbeitung in der EU darf kein Patientenaudio zu OpenAI. Fällt diese
 * Zusage aus oder besteht die deutsche Sprachausgabe den Hörtest nicht,
 * wird eine Datei ausgetauscht und nicht ein System umgebaut.
 *
 * Ebenso wichtig: Gegen diese Schnittstelle lässt sich ein gestellter
 * Anbieter schreiben. Damit sind Unterbrechen, Zuhören und der ganze
 * Gesprächsverlauf prüfbar, **bevor** ein Schlüssel existiert – und im
 * Testlauf verlässt kein Ton den Rechner.
 *
 * Die Schnittstelle kennt bewusst kein OpenAI-Vokabular: keine
 * Ereignisnamen, keine Modellnamen, keine Sitzungsobjekte. Was ein
 * Anbieter meldet, übersetzt seine Anbindung in `VoiceEvent` aus
 * `turn.ts`.
 */

import type { VoiceEvent } from "./turn.ts";

export type Lang = "de" | "en";

/** Ein Rahmen linearen Audios, PCM16 bei 24 kHz, mono. */
export type Pcm = Int16Array;

export interface SttOptions {
  lang: Lang;
  /**
   * Begriffe, die in dieser Praxis vorkommen und die eine allgemeine
   * Erkennung sonst verstümmelt: Fachwörter, Straßennamen, der Name des
   * Arztes. Anbieter, die das nicht können, ignorieren es.
   */
  hints?: string[];
  /** Wird gerufen, sobald der Anbieter etwas meldet. */
  onEvent: (event: VoiceEvent) => void;
}

/**
 * Eine laufende Erkennungssitzung. Sie nimmt Audio entgegen und meldet
 * Ereignisse; sie antwortet nicht und entscheidet nichts.
 */
export interface SttSession {
  /** Einen Rahmen einspeisen. Darf nach `close` nichts mehr tun. */
  write(frame: Pcm): void;
  /** Beenden. Muss mehrfach aufrufbar sein, ohne zu werfen. */
  close(): Promise<void>;
  /** Läuft die Sitzung noch? */
  readonly open: boolean;
}

export interface SpeakOptions {
  lang: Lang;
  /**
   * Bricht die Ausgabe ab. Der Patient hat zu sprechen begonnen, und das
   * hat Vorrang vor allem, was der Assistent gerade sagen wollte.
   */
  signal?: AbortSignal;
}

/**
 * Ein Sprachanbieter: Ohren und Mund, sonst nichts. Kein Denken, keine
 * Gesprächsführung, kein Zustand über eine Sitzung hinaus.
 */
export interface SpeechProvider {
  /** Name für Protokoll und Kostenzähler, nie für Verzweigungen im Code. */
  readonly name: string;
  /** Eine Erkennungssitzung öffnen. */
  listen(options: SttOptions): Promise<SttSession>;
  /**
   * Text sprechen. Liefert die Rahmen, sobald sie da sind – nicht erst am
   * Ende, sonst entsteht eine hörbare Pause vor jeder Antwort.
   */
  speak(text: string, options: SpeakOptions): AsyncIterable<Pcm>;
}

/**
 * Was eine Sitzung gekostet hat. Wird mitgezählt, weil die Abrechnung
 * nach Audiodauer erfolgt und ein vergessener Browser-Tab sonst
 * unbemerkt Geld verbraucht.
 */
export interface UsageCounter {
  /** Gesendete Audiosekunden – nur das, was die Stimmerkennung durchgelassen hat. */
  sttSeconds: number;
  /** Gesprochene Zeichen. */
  ttsChars: number;
}

export function newUsage(): UsageCounter {
  return { sttSeconds: 0, ttsChars: 0 };
}

/**
 * Harte Grenzen je Sitzung. Sie sind kein Feinschliff: Ohne sie kann ein
 * einziger offener Browser-Tab die Monatsrechnung bestimmen, und ein
 * Anrufer, der nichts sagt, bindet eine Leitung.
 */
export interface SessionLimits {
  /** Länge der ganzen Sitzung. */
  maxSessionMs: number;
  /** Tatsächlich übertragene Audiosekunden. */
  maxSttSeconds: number;
  /** Gesprochene Zeichen. */
  maxTtsChars: number;
  /** Gesprächszüge. */
  maxTurns: number;
}

export const DEFAULT_LIMITS: SessionLimits = {
  maxSessionMs: 10 * 60_000,
  maxSttSeconds: 6 * 60,
  maxTtsChars: 20_000,
  maxTurns: 40,
};

export type LimitBreach = "session_time" | "stt_seconds" | "tts_chars" | "turns" | null;

/**
 * Welche Grenze ist überschritten? Der Aufrufer sagt es dem Patienten und
 * gibt die Praxisnummer – eine Grenze endet nie in Stille.
 */
export function breached(usage: UsageCounter, elapsedMs: number, turns: number, limits: SessionLimits = DEFAULT_LIMITS): LimitBreach {
  if (elapsedMs >= limits.maxSessionMs) return "session_time";
  if (usage.sttSeconds >= limits.maxSttSeconds) return "stt_seconds";
  if (usage.ttsChars >= limits.maxTtsChars) return "tts_chars";
  if (turns >= limits.maxTurns) return "turns";
  return null;
}
