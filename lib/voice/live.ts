/**
 * Zuhören im Browser – ohne Zwischenrechner.
 *
 * Der Weg ist absichtlich kurz: Mikrofon → WebRTC → Anbieter → Text.
 * Zwischen der Stimme der Patientin und der Erkennung sitzt kein eigener
 * Server, der mithören könnte, und der Schlüssel des Anbieters ist hier nie
 * zu sehen. Der Browser holt sich beim Cockpit nur einen kurzlebigen
 * Ausweis und weist sich damit selbst aus.
 *
 * Was diese Datei bewusst **nicht** tut: antworten. Sie liefert erkannten
 * Text und sonst nichts. Die Antwort kommt aus demselben Automaten wie im
 * geschriebenen Chat – mit Notfallpfad, Gesundheitsfilter und echter
 * Verfügbarkeit. Deshalb wird auch eine reine Transkriptions-Sitzung
 * angefordert: Die kann strukturell nicht selbst reden.
 *
 * Reine Verdrahtung, ohne React. Prüfbar über `lib/voice/live.test.mjs`
 * gegen gestellte Bausteine.
 */

export type LiveState =
  /** Nichts läuft. */
  | "idle"
  /** Ausweis holen, Mikrofon anfordern, Verbindung aufbauen. */
  | "connecting"
  /** Es wird zugehört. */
  | "listening"
  /** Die Patientin spricht gerade. */
  | "hearing"
  /** Der Assistent denkt oder spricht. */
  | "answering"
  /** Die Erlaubnis fürs Mikrofon fehlt. */
  | "denied"
  /** Etwas ist schiefgegangen. */
  | "error";

export interface LiveSecret {
  value: string;
  expiresAt: number;
  sampleRate: number;
}

export interface LivePorts {
  /** Ausweis beim Cockpit holen. */
  token: () => Promise<LiveSecret>;
  /** Mikrofon anfordern; wirft, wenn abgelehnt. */
  microphone: () => Promise<MediaStream>;
  /** Eine Verbindung zum Anbieter aufbauen. */
  connect: (secret: LiveSecret, stream: MediaStream, on: LiveEvents) => Promise<LiveConnection>;
  /** Ein fertiger Satz ist erkannt worden. */
  onTranscript: (text: string) => void;
  /** Der Zustand hat sich geändert – die Oberfläche zeichnet neu. */
  onState: (state: LiveState, detail?: { reason?: string }) => void;
}

export interface LiveEvents {
  /** Die Patientin hat zu sprechen begonnen. */
  speechStart: () => void;
  /** Ein Satz ist fertig erkannt. */
  transcript: (text: string) => void;
  /** Die Verbindung ist weg. */
  closed: (reason: string) => void;
}

export interface LiveConnection {
  close: () => void;
}

/** So lange ohne ein einziges Wort wird von selbst aufgelegt. */
const IDLE_MS = 90_000;
/** Und so lange höchstens am Stück – Zuhören kostet je Minute. */
const MAX_MS = 6 * 60_000;

/**
 * Eine Zuhör-Sitzung. Sie öffnet das Mikrofon erst auf Knopfdruck und
 * schließt es bei jedem Zweifel: Tab weg, Stille, Zeitlimit, Fehler.
 * Ein Mikrofon, das versehentlich offen bleibt, ist die teuerste und die
 * unheimlichste Art von Fehler.
 */
export class LiveSession {
  private readonly ports: LivePorts;
  private state: LiveState = "idle";
  private conn: LiveConnection | null = null;
  private stream: MediaStream | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(ports: LivePorts) {
    this.ports = ports;
  }

  get current(): LiveState {
    return this.state;
  }

  private set(state: LiveState, detail?: { reason?: string }): void {
    if (this.state === state) return;
    this.state = state;
    this.ports.onState(state, detail);
  }

  private armIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => void this.stop("idle"), IDLE_MS);
  }

  /** Auf Knopfdruck – und nur so. */
  async start(): Promise<void> {
    if (this.state !== "idle" && this.state !== "denied" && this.state !== "error") return;
    this.stopping = false;
    this.set("connecting");
    let stream: MediaStream | null = null;
    try {
      const secret = await this.ports.token();
      stream = await this.ports.microphone();
      if (this.stopping) {
        stopTracks(stream);
        this.set("idle");
        return;
      }
      this.stream = stream;
      this.conn = await this.ports.connect(secret, stream, {
        speechStart: () => {
          this.armIdle();
          if (this.state === "listening" || this.state === "answering") this.set("hearing");
        },
        transcript: (text) => {
          this.armIdle();
          const clean = text.trim();
          if (!clean) {
            this.set("listening");
            return;
          }
          this.set("answering");
          this.ports.onTranscript(clean);
        },
        closed: (reason) => void this.stop(reason),
      });
      if (this.stopping) {
        this.conn.close();
        stopTracks(stream);
        this.conn = null;
        this.stream = null;
        this.set("idle");
        return;
      }
      this.armIdle();
      this.maxTimer = setTimeout(() => void this.stop("limit"), MAX_MS);
      this.set("listening");
    } catch (error) {
      if (stream) stopTracks(stream);
      this.stream = null;
      const name = error instanceof Error ? error.name : "unknown";
      const denied = name === "NotAllowedError" || name === "SecurityError";
      this.set(denied ? "denied" : "error", { reason: name });
    }
  }

  /** Die Antwort ist gesprochen – ab jetzt wird wieder zugehört. */
  answered(): void {
    if (this.state === "answering") this.set("listening");
  }

  /** Tab gewechselt, Knopf noch einmal gedrückt, Zeit abgelaufen. */
  async stop(reason = "user"): Promise<void> {
    this.stopping = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.idleTimer = null;
    this.maxTimer = null;
    this.conn?.close();
    this.conn = null;
    if (this.stream) stopTracks(this.stream);
    this.stream = null;
    if (this.state === "idle") return;
    this.state = "idle";
    this.ports.onState("idle", { reason });
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Ein Gerät, das sich nicht schließen lässt, darf den Rest nicht aufhalten.
    }
  }
}
