/**
 * Wer spricht, wann, und wem gilt es.
 *
 * Am Bildschirm ist das trivial: Wer tippt und auf Enter drückt, meint
 * uns. Am Telefon nicht. Da redet jemand dazwischen, überlegt laut,
 * ruft seiner Frau etwas zu, hustet, oder sagt „Moment" und legt den
 * Hörer weg. Dieses Modul entscheidet daraus, was der Assistent tut:
 * sofort verstummen, weiter zuhören, oder den Satz an den
 * Gesprächsautomaten geben.
 *
 * Drei Zusagen, die hier eingelöst werden:
 *
 *  1. **Unterbrechen gilt.** Sobald der Patient spricht, hört der
 *     Assistent auf zu reden – ohne Rückfrage, ohne Verzögerung.
 *  2. **Im Zweifel schweigen.** Ein Satz, der zu nichts passt und kurz
 *     ist, war vermutlich nicht an uns gerichtet. Dann passiert nichts:
 *     kein „Das habe ich nicht verstanden", kein Fehlgriff. Weiter zuhören.
 *  3. **Ein Termin wird nie aus Versehen gebucht.** Ein „ja", das
 *     jemandem im Raum gilt, darf keine verbindliche Buchung auslösen.
 *     In der Bestätigungsphase verlangt die Stimme deshalb eine klare
 *     Zusage – sonst wird einmal zurückgefragt.
 *
 * Reine Logik: kein Anbieter, kein Netz, kein Audio. Damit gilt sie für
 * jede Spracherkennung, die wir anschließen, und lässt sich ohne Mikrofon
 * prüfen.
 *
 * Ausführen:  node --test lib/voice/turn.test.mjs
 */

export type Lang = "de" | "en";

/** Was der Assistent gerade tut. */
export type Phase =
  /** Nichts los – der Anruf läuft, niemand spricht. */
  | "idle"
  /** Der Patient spricht gerade. */
  | "hearing"
  /** Der Patient hat aufgehört; wir warten, ob noch etwas kommt. */
  | "settling"
  /** Der Satz ist unterwegs zum Gesprächsautomaten. */
  | "thinking"
  /** Der Assistent spricht. */
  | "speaking";

/**
 * Ereignisse, wie sie ein Sprachanbieter liefert – bewusst in unserer
 * eigenen Sprache formuliert. Die Anbindung übersetzt die Ereignisnamen
 * des jeweiligen Anbieters hierher; dieses Modul kennt keinen Anbieter.
 */
export type VoiceEvent =
  | { kind: "speech_started"; at: number }
  | { kind: "speech_stopped"; at: number }
  | { kind: "partial"; at: number; text: string }
  | { kind: "final"; at: number; text: string; confidence?: number }
  /** Der Anbieter meldet ein inhaltliches Ende der Äußerung. */
  | { kind: "turn_end"; at: number }
  | { kind: "speech_out_started"; at: number }
  | { kind: "speech_out_finished"; at: number }
  | { kind: "tick"; at: number };

/** Was der Kanal daraufhin tun soll. */
export type VoiceAction =
  /** Wiedergabe sofort abbrechen – der Patient spricht. */
  | { do: "stop_output"; reason: "barge_in" }
  /** Diesen Text an POST /api/public/v1/chat geben. */
  | { do: "send"; text: string }
  /** Bewusst nichts tun; der Satz galt nicht uns. */
  | { do: "ignore"; text: string; reason: IgnoreReason }
  /** Einmal nachfragen, ohne etwas zu buchen. */
  | { do: "say"; text: string; reason: "reconfirm" | "still_there" }
  /** Der Anrufer schweigt zu lange – an den Empfang übergeben. */
  | { do: "handover"; reason: "silence" | "max_turns" };

export type IgnoreReason =
  /** Passt zu keiner Absicht und war zu kurz, um an uns gerichtet zu sein. */
  | "not_addressed"
  /** Der Patient hat um einen Moment gebeten. */
  | "asked_to_wait"
  /** Die Erkennung war zu unsicher. */
  | "low_confidence"
  /** Nur Füllwörter oder Geräusch. */
  | "no_content";

export interface TurnConfig {
  /** Wie lange nach dem Verstummen noch gewartet wird, bevor der Satz gilt. */
  settleMs: number;
  /** Ab wann Schweigen als „niemand mehr da" gilt. */
  silenceHandoverMs: number;
  /** So viele nicht zuordenbare Äußerungen, dann einmal nachfragen. */
  unmatchedBeforePrompt: number;
  /** Unter dieser Sicherheit wird nichts weitergegeben. */
  minConfidence: number;
  /**
   * Äußerungen bis zu dieser Länge ohne erkennbare Absicht gelten als
   * nicht an uns gerichtet. Der Wert ist eine Abwägung: höher gesetzt
   * fängt er mehr Nebenrede ab, lässt aber eine echte, ungewöhnlich
   * formulierte Frage einmal ins Leere laufen – aufgefangen von der
   * Nachfrage nach `unmatchedBeforePrompt`. Am Telefon wiegt eine
   * unpassende Antwort in den Raum schwerer als ein Takt Stille.
   */
  shortWords: number;
  /** In der Bestätigungsphase ein bloßes „ja" nicht als Buchung werten. */
  requireStrongConfirm: boolean;
  /** Nach so vielen Zügen wird an den Empfang übergeben. */
  maxTurns: number;
}

export const DEFAULT_CONFIG: TurnConfig = {
  settleMs: 700,
  silenceHandoverMs: 20_000,
  unmatchedBeforePrompt: 2,
  minConfidence: 0.5,
  shortWords: 6,
  requireStrongConfirm: true,
  maxTurns: 40,
};

export interface TurnState {
  phase: Phase;
  /** Der zuletzt vollständig erkannte Satz, der noch nicht abgeschickt ist. */
  pending: string;
  /** Zeitpunkt des letzten erkannten Satzes. */
  lastFinalAt: number;
  /** Zeitpunkt der letzten Aktivität überhaupt. */
  lastActivityAt: number;
  /** Wie oft hintereinander nichts zuzuordnen war. */
  unmatched: number;
  /** Wurde nach einem knappen „ja" schon einmal zurückgefragt? */
  reconfirmAsked: boolean;
  /** Wartet der Patient uns ausdrücklich ab („Moment")? */
  waiting: boolean;
  turns: number;
}

export function initialState(now = 0): TurnState {
  return {
    phase: "idle",
    pending: "",
    lastFinalAt: 0,
    lastActivityAt: now,
    unmatched: 0,
    reconfirmAsked: false,
    waiting: false,
    turns: 0,
  };
}

// ------------------------------------------------------------- Sprache

/** „Moment", „ich frage kurz" – der Patient bittet ausdrücklich um Geduld. */
const WAIT_RE =
  /(?<!\p{L})(?:moment(?:chen)?|einen? moment|augenblick|sekunde|sekündchen|kurz warten|warten sie (?:kurz|mal|bitte)|warte (?:mal|kurz)|ich (?:frage|frag|schaue|schau|guck|gucke|hole|hol) (?:mal |kurz |eben )?(?:nach)?|bleiben sie dran|einen augenblick bitte|one (?:moment|second)|just a (?:moment|second|sec)|hold on|hang on|let me check)(?!\p{L})/iu;

/** Reine Füllwörter und Geräusche – daraus lässt sich nichts ableiten. */
const FILLER_RE = /^(?:[\s.,!?-]|ähm?|öhm?|hm+|mhm+|äh|eh|oh|ach|also|ja ja|uhm?|um|uh|er|hmm)+$/iu;

/**
 * Wendungen, die typischerweise jemandem im Raum gelten. Bewusst kurz
 * gehalten: Eine lange Liste erzeugt Fehlalarme, und der eigentliche
 * Schutz ist ohnehin die Regel „passt zu nichts und ist kurz → schweigen".
 */
const SIDE_TALK_RE =
  /(?<!\p{L})(?:sag (?:mal|ihm|ihr) |guck mal|schau mal|hol (?:mir|mal) |gib mir mal|mach mal|wo hast du|hast du (?:mal )?(?:den|die|das) |bring mir|komm mal|lass mich|nicht jetzt|halt kurz)/iu;

/**
 * Eine eindeutige Zusage. „Ja" allein reicht am Telefon nicht: Es könnte
 * jemandem im Raum gegolten haben, und am Ende steht eine verbindliche
 * Buchung.
 */
const STRONG_YES_RE =
  /(?<!\p{L})(?:ja(?:,)? (?:bitte|gern(?:e)?|buchen|machen sie das|genau|richtig|verbindlich|passt)|bitte buchen|buchen sie|verbindlich buchen|ich bestätige|das ist richtig|yes(?:,)? (?:please|book|go ahead|correct)|please book|go ahead and book|that is correct)/iu;

const BARE_YES_RE = /^(?:ja|jawohl|jo|jup|ok|okay|genau|passt|richtig|stimmt|yes|yeah|yep|sure|correct|right)[.!\s]*$/iu;

/**
 * Woran erkennen wir, dass ein Satz uns gilt? Nicht an einer Wortliste
 * für „an uns gerichtet" – die gibt es nicht –, sondern daran, dass der
 * Satz zu etwas passt, das der Assistent kann. Diese Prüfung liefert der
 * Aufrufer, damit dieses Modul das Wissen des Gesprächsautomaten nutzt,
 * statt es zu verdoppeln.
 */
export interface Addressing {
  /** Ergibt der Satz für den Gesprächsautomaten eine Absicht? */
  hasIntent: (text: string) => boolean;
  /** Steht der Gesprächsautomat gerade auf der Bestätigungsfrage? */
  awaitingConfirmation: boolean;
  lang: Lang;
}

export interface Decision {
  state: TurnState;
  actions: VoiceAction[];
}

const RECONFIRM: Record<Lang, string> = {
  de: "Zur Sicherheit, weil es verbindlich ist: Soll ich den Termin so buchen? Bitte sagen Sie „ja, bitte buchen“.",
  en: "Just to be sure, because this is binding: shall I book this appointment? Please say “yes, please book”.",
};

const STILL_THERE: Record<Lang, string> = {
  de: "Sind Sie noch dran? Sagen Sie einfach: Termin, Öffnungszeiten oder Anfahrt.",
  en: "Are you still there? Just say: appointment, opening hours or directions.",
};

/**
 * Ein Ereignis verarbeiten. Der Rückgabewert ist der neue Zustand und
 * eine Liste von Anweisungen an den Kanal – nie eine Nebenwirkung.
 */
export function step(state: TurnState, event: VoiceEvent, addressing: Addressing, config: TurnConfig = DEFAULT_CONFIG): Decision {
  const actions: VoiceAction[] = [];
  const s: TurnState = { ...state };

  switch (event.kind) {
    case "speech_out_started":
      s.phase = "speaking";
      s.lastActivityAt = event.at;
      return { state: s, actions };

    case "speech_out_finished":
      s.phase = "idle";
      s.lastActivityAt = event.at;
      return { state: s, actions };

    case "speech_started": {
      // Der wichtigste Fall des ganzen Moduls: Wer spricht, hat Vorrang.
      if (state.phase === "speaking") actions.push({ do: "stop_output", reason: "barge_in" });
      s.phase = "hearing";
      s.lastActivityAt = event.at;
      s.waiting = false;
      return { state: s, actions };
    }

    case "partial":
      s.phase = "hearing";
      s.lastActivityAt = event.at;
      return { state: s, actions };

    case "speech_stopped":
      s.phase = state.phase === "hearing" ? "settling" : state.phase;
      s.lastActivityAt = event.at;
      return { state: s, actions };

    case "final": {
      s.lastActivityAt = event.at;
      s.lastFinalAt = event.at;
      const text = event.text.trim();
      const confidence = event.confidence ?? 1;

      if (!text || FILLER_RE.test(text)) {
        s.phase = "idle";
        actions.push({ do: "ignore", text, reason: "no_content" });
        return { state: s, actions };
      }
      if (confidence < config.minConfidence) {
        s.phase = "idle";
        actions.push({ do: "ignore", text, reason: "low_confidence" });
        return { state: s, actions };
      }
      if (WAIT_RE.test(text)) {
        // „Moment" heißt: nicht antworten, nicht auflegen, einfach warten.
        s.phase = "idle";
        s.waiting = true;
        s.unmatched = 0;
        actions.push({ do: "ignore", text, reason: "asked_to_wait" });
        return { state: s, actions };
      }
      if (SIDE_TALK_RE.test(text) && !addressing.hasIntent(text)) {
        s.phase = "idle";
        actions.push({ do: "ignore", text, reason: "not_addressed" });
        return { state: s, actions };
      }

      const words = text.split(/\s+/u).filter(Boolean).length;
      const intent = addressing.hasIntent(text);

      // Eine knappe Zusage auf die Bestätigungsfrage ist der einzige Fall,
      // in dem ein Missverständnis Geld und einen Termin kostet.
      if (addressing.awaitingConfirmation && config.requireStrongConfirm && BARE_YES_RE.test(text) && !STRONG_YES_RE.test(text)) {
        if (!state.reconfirmAsked) {
          s.phase = "speaking";
          s.reconfirmAsked = true;
          actions.push({ do: "say", text: RECONFIRM[addressing.lang], reason: "reconfirm" });
          return { state: s, actions };
        }
        // Zweites knappes „ja" nach ausdrücklicher Rückfrage zählt.
        s.reconfirmAsked = false;
      }

      if (!intent && words <= config.shortWords) {
        // Kurz und zu nichts passend: vermutlich nicht an uns gerichtet.
        // Schweigen ist hier die richtige Antwort, nicht „nicht verstanden".
        s.phase = "idle";
        s.unmatched = state.unmatched + 1;
        if (s.unmatched >= config.unmatchedBeforePrompt) {
          s.unmatched = 0;
          s.phase = "speaking";
          actions.push({ do: "ignore", text, reason: "not_addressed" });
          actions.push({ do: "say", text: STILL_THERE[addressing.lang], reason: "still_there" });
          return { state: s, actions };
        }
        actions.push({ do: "ignore", text, reason: "not_addressed" });
        return { state: s, actions };
      }

      s.phase = "thinking";
      s.pending = "";
      s.unmatched = 0;
      s.waiting = false;
      s.turns = state.turns + 1;
      if (s.turns > config.maxTurns) {
        s.phase = "idle";
        actions.push({ do: "handover", reason: "max_turns" });
        return { state: s, actions };
      }
      actions.push({ do: "send", text });
      return { state: s, actions };
    }

    case "turn_end":
      s.lastActivityAt = event.at;
      if (state.phase === "hearing") s.phase = "settling";
      return { state: s, actions };

    case "tick": {
      const quiet = event.at - state.lastActivityAt;
      // Wer ausdrücklich um einen Moment gebeten hat, bekommt die doppelte Zeit.
      const limit = state.waiting ? config.silenceHandoverMs * 2 : config.silenceHandoverMs;
      if (state.phase !== "speaking" && state.phase !== "thinking" && quiet >= limit) {
        s.lastActivityAt = event.at;
        actions.push({ do: "handover", reason: "silence" });
      }
      return { state: s, actions };
    }

    default:
      return { state: s, actions };
  }
}
