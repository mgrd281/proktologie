/**
 * Ein Sprachgespräch, ohne Transport.
 *
 * Hier laufen die Teile zusammen: Audio hinein, Stimmerkennung, die Frage
 * „galt das mir?", der Gesprächsverlauf, der Aufruf des vorhandenen
 * Automaten, und die Antwort als Ton hinaus. Was hier **nicht** steht,
 * ist genauso wichtig: kein WebSocket, kein HTTP-Server, kein Telefon,
 * kein Anbieter. Die kommen darum herum – dieses Modul lässt sich damit
 * vollständig prüfen, ohne dass ein einziger Ton den Rechner verlässt.
 *
 * Der wichtigste Entwurfssatz: **Dieses Modul entscheidet nichts über
 * Termine.** Es trägt den `ChatState` unverändert weiter und ersetzt ihn
 * vollständig durch das, was `POST /api/public/v1/chat` zurückgibt. Damit
 * erbt der Sprachkanal jede geprüfte Regel des Textkanals – Notfallpfad,
 * Blockliste, Buchungsgrenze, Nachprüfung der Modellantwort – statt sie
 * ein zweites Mal zu formulieren und ein zweites Mal falsch zu machen.
 *
 * Ausführen:  node --test lib/voice/session.test.mjs
 */

import { toSpeech, optionsSpoken } from "../chat/speech.ts";
import { breached, newUsage, DEFAULT_LIMITS, type SessionLimits, type SpeechProvider, type SttSession, type UsageCounter } from "./provider.ts";
import { DEFAULT_CONFIG, initialState, step, type Addressing, type Stage, type TurnConfig, type TurnState, type VoiceEvent } from "./turn.ts";

export type Lang = "de" | "en";

/** Die Antwort des Gesprächsautomaten, so weit sie hier gebraucht wird. */
export interface ChatAnswer {
  reply: string;
  lang: Lang;
  state: unknown;
  quick?: Array<{ id: string; label: string }>;
  form?: { id: string } | null;
  flags?: { emergency?: true; handover?: true; booked?: { ref: string } };
}

export interface SessionDeps {
  provider: SpeechProvider;
  /** Genau der Aufruf, den auch das Chat-Fenster macht. */
  chat: (body: { v: 1; sessionId: string; state: unknown; message?: string; lang?: Lang }) => Promise<ChatAnswer>;
  /** Uhr – im Test gestellt. */
  now: () => number;
  /** Protokoll ohne Wortlaut: nur Ereignisname und Schlüssel. */
  audit?: (event: string, data?: Record<string, unknown>) => void;
  /** Erkennt der Automat in diesem Text eine Absicht? Siehe addressee.ts. */
  hasIntent: (text: string) => boolean;
  /** Notfallerkennung – dieselbe wie im Textkanal. */
  isEmergency: (text: string) => boolean;
}

export interface SessionOptions {
  sessionId: string;
  lang?: Lang;
  /** Telefon oder Browser – entscheidet über die gesprochene Fassung. */
  channel?: "phone" | "web";
  limits?: SessionLimits;
  turn?: TurnConfig;
}

/**
 * Was hinausgeht. Bewusst als Strom und nicht als fertiger Block: Wer
 * erst den ganzen Satz erzeugt und dann sendet, kann ihn nicht mehr
 * unterbrechen – und genau das ist die wichtigste Zusage dieses Kanals.
 */
export type Outbound =
  /** Ab jetzt wird dieser Satz gesprochen. */
  | { kind: "say"; text: string }
  /** Ein Stück Ton, sofort abspielen. */
  | { kind: "audio"; frame: Int16Array }
  /** Der Satz ist zu Ende gesprochen worden. */
  | { kind: "spoken"; text: string }
  /** Wiedergabe sofort abbrechen und Gepuffertes verwerfen. */
  | { kind: "stop"; reason: "barge_in" }
  /** An den Empfang übergeben und auflegen. */
  | { kind: "handover"; reason: string; text: string }
  /** Das Gespräch ist zu Ende. */
  | { kind: "end"; reason: string };

const HANDOVER_TEXT: Record<Lang, string> = {
  de: "Ich verbinde Sie mit dem Team. Einen Moment bitte.",
  en: "I am putting you through to the team. One moment please.",
};

const LIMIT_TEXT: Record<Lang, string> = {
  de: "Ich muss das Gespräch hier beenden. Bitte rufen Sie uns an: 040 490 80 21.",
  en: "I have to end the call here. Please call us: 040 490 80 21.",
};

const TROUBLE_TEXT: Record<Lang, string> = {
  de: "Das hat gerade nicht geklappt. Ich verbinde Sie mit dem Team.",
  en: "That did not work just now. I am putting you through to the team.",
};

/**
 * Ein Gespräch. Audio kommt über `feed`, alles Hörbare geht über den
 * `onOut`-Rückruf hinaus – so bleibt der Transport austauschbar.
 */
export class VoiceSession {
  private readonly deps: SessionDeps;
  private readonly options: Required<Pick<SessionOptions, "sessionId" | "channel">> & SessionOptions;
  private readonly onOut: (out: Outbound) => void;
  private readonly limits: SessionLimits;
  private readonly turnConfig: TurnConfig;
  private readonly startedAt: number;

  private stt: SttSession | null = null;
  private turnState: TurnState;
  private chatState: unknown = null;
  private stage: Stage = "idle";
  private quickLabels: string[] = [];
  private lang: Lang;
  private speaking: AbortController | null = null;
  private saying = "";
  private turns = 0;
  private closed = false;

  usage: UsageCounter = newUsage();

  constructor(deps: SessionDeps, options: SessionOptions, onOut: (out: Outbound) => void) {
    this.deps = deps;
    this.options = { channel: "phone", ...options, sessionId: options.sessionId };
    this.onOut = onOut;
    this.limits = options.limits ?? DEFAULT_LIMITS;
    this.turnConfig = options.turn ?? DEFAULT_CONFIG;
    this.lang = options.lang ?? "de";
    this.turnState = initialState(deps.now());
    this.startedAt = deps.now();
  }

  /** Die Erkennung öffnen. Erst ab hier entsteht überhaupt Aufwand. */
  async start(hints: string[] = []): Promise<void> {
    if (this.stt) return;
    this.stt = await this.deps.provider.listen({
      lang: this.lang,
      hints,
      onEvent: (event) => {
        void this.handle(event);
      },
    });
  }

  /** Einen Rahmen einspeisen. Nur was hier hereinkommt, wird abgerechnet. */
  feed(frame: Int16Array, frameMs = 20): void {
    if (this.closed || !this.stt?.open) return;
    this.usage.sttSeconds += frameMs / 1000;
    this.stt.write(frame);
  }

  get state(): { stage: Stage; lang: Lang; turns: number; speaking: boolean } {
    return { stage: this.stage, lang: this.lang, turns: this.turns, speaking: this.speaking !== null };
  }

  async close(reason = "closed"): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.speaking?.abort();
    this.speaking = null;
    await this.stt?.close();
    this.onOut({ kind: "end", reason });
  }

  // ------------------------------------------------------- Ereignisse

  private addressing(): Addressing {
    return {
      hasIntent: this.deps.hasIntent,
      isEmergency: this.deps.isEmergency,
      stage: this.stage,
      lang: this.lang,
      matchesQuick: (text) => this.matchesQuick(text),
    };
  }

  /** Trifft der Satz eine angebotene Schaltfläche? Dann ist er so klar wie ein Klick. */
  private matchesQuick(text: string): boolean {
    const norm = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    if (!norm) return false;
    return this.quickLabels.some((label) => {
      const l = label.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
      return l.length > 0 && (norm === l || norm.includes(l));
    });
  }

  private async handle(event: VoiceEvent): Promise<void> {
    if (this.closed) return;
    const { state, actions } = step(this.turnState, event, this.addressing(), this.turnConfig);
    this.turnState = state;

    for (const action of actions) {
      if (this.closed) return;
      switch (action.do) {
        case "stop_output":
          // Der Patient spricht. Alles andere hat zu warten.
          this.speaking?.abort();
          this.speaking = null;
          this.deps.audit?.("voice.barge_in");
          this.onOut({ kind: "stop", reason: "barge_in" });
          break;

        case "ignore":
          // Bewusst still. Der Grund wird protokolliert, nicht der Satz.
          this.deps.audit?.("voice.ignored", { reason: action.reason });
          break;

        case "say":
          await this.say(action.text);
          break;

        case "handover":
          this.deps.audit?.("voice.handover", { reason: action.reason });
          this.onOut({ kind: "handover", reason: action.reason, text: this.spoken(HANDOVER_TEXT[this.lang]) });
          await this.close("handover");
          break;

        case "send":
          await this.send(action.text);
          break;

        default:
          break;
      }
    }
  }

  /** Einen Satz an den Gesprächsautomaten geben und die Antwort sprechen. */
  private async send(text: string): Promise<void> {
    const limit = breached(this.usage, this.deps.now() - this.startedAt, this.turns, this.limits);
    if (limit) {
      this.deps.audit?.("voice.limit", { limit });
      await this.say(LIMIT_TEXT[this.lang]);
      await this.close(`limit:${limit}`);
      return;
    }

    this.turns += 1;
    let answer: ChatAnswer;
    try {
      answer = await this.deps.chat({ v: 1, sessionId: this.options.sessionId, state: this.chatState, message: text, lang: this.lang });
    } catch {
      // Ein ausgefallener Automat darf nie in Stille enden – am Telefon
      // wäre das für den Anrufer nicht von einem Verbindungsabbruch zu
      // unterscheiden.
      this.deps.audit?.("voice.chat_failed");
      await this.say(TROUBLE_TEXT[this.lang]);
      this.onOut({ kind: "handover", reason: "chat_failed", text: this.spoken(HANDOVER_TEXT[this.lang]) });
      await this.close("chat_failed");
      return;
    }

    this.chatState = answer.state;
    this.lang = answer.lang;
    this.quickLabels = (answer.quick ?? []).map((q) => q.label);
    this.stage = readStage(answer.state);
    if (answer.flags?.booked) this.deps.audit?.("voice.booked");

    // Schaltflächen kann man nicht hören. Wo der Automat welche anbietet,
    // werden sie zu einem Satz – sonst weiß der Anrufer nicht, was geht.
    const options = this.quickLabels.length > 0 ? optionsSpoken(this.quickLabels, this.lang) : "";
    await this.say(options ? `${answer.reply} ${options}` : answer.reply);

    if (answer.flags?.handover) {
      this.onOut({ kind: "handover", reason: "handover", text: this.spoken(HANDOVER_TEXT[this.lang]) });
      await this.close("handover");
    }
  }

  private spoken(text: string): string {
    return toSpeech(text, this.lang, { channel: this.options.channel, phonetic: this.options.channel === "phone" });
  }

  /** Sprechen. Jeder Satz ist abbrechbar, sonst wäre Unterbrechen wirkungslos. */
  private async say(text: string): Promise<void> {
    const spoken = this.spoken(text);
    if (!spoken) return;
    this.usage.ttsChars += spoken.length;
    this.saying = spoken;

    const controller = new AbortController();
    this.speaking = controller;
    // Der Verlauf muss wissen, dass wir reden, **bevor** der erste Ton
    // geht: Nur dann gilt eine Äußerung dazwischen als Unterbrechung.
    await this.handleQuietly({ kind: "speech_out_started", at: this.deps.now(), text: spoken });
    this.onOut({ kind: "say", text: spoken });

    try {
      for await (const frame of this.deps.provider.speak(spoken, { lang: this.lang, signal: controller.signal })) {
        if (controller.signal.aborted) break;
        this.onOut({ kind: "audio", frame });
      }
    } catch {
      this.deps.audit?.("voice.tts_failed");
    }

    if (!controller.signal.aborted) {
      this.onOut({ kind: "spoken", text: spoken });
      await this.handleQuietly({ kind: "speech_out_finished", at: this.deps.now() });
    }
    if (this.speaking === controller) this.speaking = null;
    this.saying = "";
  }

  /** Ein eigenes Ereignis in den Verlauf geben, ohne erneute Rekursion. */
  private async handleQuietly(event: VoiceEvent): Promise<void> {
    const { state } = step(this.turnState, event, this.addressing(), this.turnConfig);
    this.turnState = state;
  }

  /** Nur für Tests und Protokoll: Was der Assistent gerade sagt. */
  get currentlySaying(): string {
    return this.saying;
  }
}

/**
 * Die Stufe aus dem Zustand lesen, den der Automat zurückgegeben hat –
 * ohne ihn zu verändern oder zu deuten. Was unbekannt ist, gilt als
 * `idle`; daraus wird nie gebucht.
 */
export function readStage(state: unknown): Stage {
  if (!state || typeof state !== "object") return "idle";
  const stage = (state as { stage?: unknown }).stage;
  const known: Stage[] = ["idle", "type", "date", "time", "contact", "confirm", "callback", "done"];
  return typeof stage === "string" && known.includes(stage as Stage) ? (stage as Stage) : "idle";
}
