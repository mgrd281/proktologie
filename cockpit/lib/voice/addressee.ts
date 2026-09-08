/**
 * Galt das mir?
 *
 * Am Telefon kommt ein einziger gemischter Kanal an. Wer im Wartezimmer
 * sitzt und seiner Frau zuruft „sag mal, wo ist der Kalender", klingt für
 * die Erkennung genauso wie jemand, der mit uns spricht. Kein Modell im
 * Programm von OpenAI liefert im Livebetrieb eine Sprecheridentität – das
 * einzige, das Sprecher unterscheiden könnte, ist weder echtzeitfähig noch
 * für die EU-Verarbeitung zugelassen. Diese Anforderung wird deshalb nicht
 * gelöst, sondern **angenähert**, und das gehört so gesagt.
 *
 * Angenähert wird sie mit einem Punktesystem aus Merkmalen, die wir
 * tatsächlich haben: ob die vorhandenen Parser etwas erkennen, wie laut
 * die Äußerung relativ zum Sprechen dieser Sitzung war, ob typische
 * Wendungen an Dritte vorkommen, wie lang sie war, und ob sie in unsere
 * eigene Ausgabe hineinfiel.
 *
 * Die Richtung des Fehlers ist festgelegt und nicht verhandelbar:
 *
 *  - Im Zweifel **schweigen**, nie raten.
 *  - Ein Notfall ist **niemals** ein Nebengespräch.
 *  - Aus einem Zweifel entsteht **keine Buchung**.
 *
 * Reine Funktion, kein Audio, kein Netz.
 *
 * Ausführen:  node --test lib/voice/addressee.test.mjs
 */

export type Lang = "de" | "en";

/** Dieselben Stufen wie im Gesprächsautomaten. */
export type Stage = "idle" | "type" | "date" | "time" | "contact" | "confirm" | "callback" | "done";

/** Stufen, in denen der Assistent gerade eine Antwort erwartet. */
const ASKING: Stage[] = ["type", "date", "time", "contact", "confirm"];

export interface Utterance {
  text: string;
  /** Länge der Äußerung in Millisekunden, falls der Kanal sie kennt. */
  durationMs?: number;
  /**
   * Lautstärke dieser Äußerung relativ zum bisherigen Sprechpegel dieser
   * Sitzung, in Dezibel. Negativ heißt leiser als sonst – typisch, wenn
   * jemand den Kopf wegdreht.
   */
  relativeDb?: number;
  /** Fiel die Äußerung in die laufende Ausgabe des Assistenten? */
  duringOutput?: boolean;
  /** Der Satz, den der Assistent gerade gesprochen hat – zum Echo-Vergleich. */
  assistantSaying?: string | null;
}

export interface Expectation {
  stage: Stage;
  /** Erkennt einer der vorhandenen Parser eine Absicht in dem Satz? */
  hasIntent: boolean;
  /** Trifft die Äußerung eine angebotene Schaltfläche eindeutig? */
  matchesQuick?: boolean;
  /** Hat die Notfallerkennung angeschlagen? */
  isEmergency: boolean;
  lang: Lang;
}

export type Verdict =
  /** Der Satz galt uns. */
  | "me"
  /** Unklar – höchstens nachfragen, nichts tun. */
  | "unsure"
  /** Der Satz galt jemand anderem – schweigen. */
  | "aside";

export interface AddresseeResult {
  verdict: Verdict;
  score: number;
  /** Was den Ausschlag gab – für Protokoll und Fehlersuche, ohne Wortlaut. */
  reasons: string[];
}

export interface AddresseeConfig {
  /** Ab diesem Punktestand gilt die Äußerung als nicht an uns gerichtet. */
  asideAt: number;
  /** Ab diesem Punktestand wird nur nachgefragt. */
  unsureAt: number;
  /** So viel leiser als der Sprechpegel gilt als abgewandt. */
  quietDb: number;
  /** Kürzer als das ist kein Satz. */
  minMs: number;
  /** Länger als das ist meist ein Gespräch im Raum. */
  maxMs: number;
}

export const DEFAULT_ADDRESSEE: AddresseeConfig = {
  asideAt: 3,
  unsureAt: 1,
  quietDb: -9,
  minMs: 400,
  maxMs: 12_000,
};

/**
 * Wendungen, die sich fast nie an einen Automaten richten. Bewusst kurz:
 * Eine lange Liste erzeugt Fehlalarme, und der eigentliche Schutz ist,
 * dass mehrere Merkmale zusammenkommen müssen.
 */
const THIRD_PARTY_RE =
  /(?<!\p{L})(?:sag (?:mal|ihm|ihr|ihnen)(?!\s+sie)|guck mal|schau mal|hol (?:mir|mal|du)|gib mir mal|mach mal|bring mir|komm mal|warte(?:t)? (?:mal|kurz)|nicht (?:jetzt|mit dir)|nein du|er sagt|sie sagt|ich telefonier|ich bin am telefon|schatz|mama|papa|mutti|vati|oma|opa|liebling|hey du)(?!\p{L})/iu;

/**
 * Anrede in der zweiten Person Höflichkeitsform und Wunschformeln: Wer so
 * spricht, meint den Gesprächspartner am anderen Ende – also uns.
 */
const ADDRESSING_RE =
  /(?<!\p{L})(?:können sie|könnten sie|koennen sie|sagen sie|haben sie|hätten sie|ich möchte|ich moechte|ich hätte|ich haette|ich brauche|ich würde|ich wuerde|ich wollte|geht (?:es|das) (?:bei ihnen|auch)|bei ihnen|ihnen|ihre praxis|bitte|entschuldigung|guten (?:tag|morgen|abend)|hallo|can you|could you|i would like|i need|i want|please|excuse me|hello)(?!\p{L})/iu;

/** Rückkanal: zeigt Zuhören an, ist aber keine Antwort. */
const BACKCHANNEL_RE = /^(?:mhm|hm+|ja ja|jaja|joa|aha|achso|ach so|verstehe|alles klar|okay|ok|gut|genau|mm+|uh huh|i see|right)[.!\s]*$/iu;

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Wie ähnlich sind zwei Sätze? 1 heißt gleich, 0 heißt nichts gemeinsam. */
function similarity(a: string, b: string): number {
  const norm = (s: string) => (s.toLowerCase().match(WORD_RE) ?? []).join(" ");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (y.startsWith(x) || x.startsWith(y)) return 1;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  return long.includes(short) ? short.length / long.length : 0;
}

/**
 * Das Urteil. Der Punktestand ist absichtlich nachvollziehbar: Jede Regel
 * trägt einen benannten Grund bei, damit im Protokoll steht, warum
 * geschwiegen wurde – ohne den Wortlaut zu speichern.
 */
export function judge(u: Utterance, e: Expectation, config: AddresseeConfig = DEFAULT_ADDRESSEE): AddresseeResult {
  const reasons: string[] = [];
  let score = 0;
  const text = u.text.trim();

  // Ein Notfall wird nie unterdrückt – kein Merkmal darf das aufwiegen.
  if (e.isEmergency) {
    return { verdict: "me", score: -99, reasons: ["emergency"] };
  }

  // Eine eindeutig getroffene Schaltfläche ist so klar wie ein Klick.
  if (e.matchesQuick) {
    reasons.push("quick_match");
    score -= 3;
  }

  if (e.hasIntent) {
    // Dass die vorhandenen Parser etwas erkennen, ist selbst ein Hinweis
    // darauf, dass der Satz uns galt – nicht nur die Abwesenheit eines
    // Verdachts. Sonst kippt ein einzelnes schwaches Merkmal jede
    // verstandene Äußerung in die Rückfrage.
    reasons.push("intent");
    score -= 1;
  } else {
    reasons.push("no_intent");
    score += 2;
  }

  if (THIRD_PARTY_RE.test(text)) {
    reasons.push("third_party_marker");
    score += 2;
  }

  if (ADDRESSING_RE.test(text)) {
    reasons.push("addressing_marker");
    score -= 2;
  }

  if (typeof u.relativeDb === "number" && u.relativeDb < config.quietDb) {
    reasons.push("turned_away");
    score += 2;
  }

  if (ASKING.includes(e.stage) && !e.hasIntent) {
    reasons.push("no_answer_to_question");
    score += 1;
  }

  if (typeof u.durationMs === "number" && (u.durationMs < config.minMs || u.durationMs > config.maxMs)) {
    reasons.push("odd_length");
    score += 1;
  }

  // In die eigene Ausgabe hineingesprochen und dabei dem eigenen Satz
  // ähnlich: das ist der Lautsprecher, nicht der Patient.
  if (u.duringOutput && u.assistantSaying && similarity(text, u.assistantSaying) >= 0.75) {
    // Das stärkste Einzelmerkmal überhaupt: Was wir gerade selbst gesagt
    // haben, kommt nicht vom Patienten. Es wiegt schwerer als eine
    // erkannte Absicht, denn die erkennt der Parser im Echo genauso.
    reasons.push("echo");
    score += 4;
  }

  // „Mhm" ist Zuhören, keine Antwort – außer der Automat wartet gerade auf
  // ein Ja, dann ist es eine echte Äußerung und wird streng behandelt.
  if (BACKCHANNEL_RE.test(text) && e.stage !== "confirm") {
    reasons.push("backchannel");
    score += 2;
  }

  const verdict: Verdict = score >= config.asideAt ? "aside" : score >= config.unsureAt ? "unsure" : "me";
  return { verdict, score, reasons };
}

/**
 * Die eine Regel, die unabhängig vom Punktestand gilt: Gebucht wird nur aus
 * der Bestätigungsfrage heraus, nur bei einer Ganzäußerung aus einer
 * geschlossenen Liste, und nur wenn der Satz eindeutig uns galt. Ein „ja"
 * mitten in einem längeren Satz bucht nichts.
 */
const CLOSED_YES = new Set([
  "ja", "ja bitte", "ja gerne", "ja gern", "ja genau", "ja richtig", "ja passt", "ja buchen", "ja bitte buchen",
  "bitte buchen", "buchen", "genau", "richtig", "passt", "verbindlich buchen", "ja verbindlich",
  "yes", "yes please", "please book", "book it", "correct", "that is correct", "go ahead",
]);

export function isBindingYes(text: string, verdict: Verdict, stage: Stage): boolean {
  if (stage !== "confirm") return false;
  if (verdict !== "me") return false;
  const norm = (text.toLowerCase().match(WORD_RE) ?? []).join(" ");
  return CLOSED_YES.has(norm);
}
