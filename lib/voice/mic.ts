/**
 * Der Mikrofonknopf, als Logik.
 *
 * Alles, was der Browser dazu braucht, steckt hinter einer kleinen
 * Schnittstelle: Mikrofon anfordern, Rahmen entgegennehmen, senden,
 * aufhören. Damit lässt sich das Verhalten ohne Browser prüfen – und
 * genau das ist nötig, weil hier die Regeln stehen, die Geld und
 * Vertrauen kosten, wenn sie fehlen:
 *
 *  - **Nie beim Seitenaufruf öffnen.** Nur ein Knopfdruck öffnet das
 *    Mikrofon. Ein Sprachdienst rechnet nach Audiodauer ab; eine Seite,
 *    die beim Laden lauscht, ist ein laufender Zähler.
 *  - **Tab weg heißt Schluss.** Wechselt der Patient den Tab oder legt
 *    das Telefon weg, wird sofort geschlossen. Ein über Nacht offener
 *    Tab wäre die größte Position auf der Rechnung.
 *  - **Kein Ton ohne Erlaubnis.** Wird die Freigabe verweigert, sagt die
 *    Oberfläche das ehrlich, statt so zu tun, als höre sie zu.
 *
 * Ausführen:  node --experimental-strip-types --test lib/voice/mic.test.mjs
 */

import { prepareFrame, levelDb, TARGET_RATE } from "./pcm.ts";

export type MicState =
  /** Nichts läuft; das Mikrofon ist zu. */
  | "idle"
  /** Der Browser fragt gerade nach der Erlaubnis. */
  | "asking"
  /** Es wird zugehört. */
  | "listening"
  /** Der Assistent spricht gerade. */
  | "speaking"
  /** Die Erlaubnis fehlt. */
  | "denied"
  /** Etwas ist schiefgegangen. */
  | "error";

export interface MicPorts {
  /** Mikrofon anfordern; wirft, wenn der Patient ablehnt. */
  open: () => Promise<{ sampleRate: number }>;
  /** Mikrofon schließen. Muss mehrfach aufrufbar sein. */
  close: () => Promise<void>;
  /** Einen fertigen Rahmen zur Leitung geben. */
  send: (frame: Int16Array) => void;
  /** Der Zustand hat sich geändert – die Oberfläche zeichnet neu. */
  onState: (state: MicState, detail?: { reason?: string }) => void;
  /** Aussteuerung, damit ein stummes Mikrofon sofort auffällt. */
  onLevel?: (db: number) => void;
}

export interface MicLimits {
  /** So viele Sekunden Audio je Sitzung, dann ist Schluss. */
  maxSeconds: number;
  /** So lange ohne jeden Rahmen gilt die Leitung als tot. */
  idleMs: number;
}

export const DEFAULT_MIC_LIMITS: MicLimits = {
  maxSeconds: 6 * 60,
  idleMs: 30_000,
};

/**
 * Die Steuerung des Mikrofons. Sie hält keinen Ton, sie entscheidet nur,
 * wann welcher fließt.
 */
export class MicController {
  private readonly ports: MicPorts;
  private readonly limits: MicLimits;
  private state: MicState = "idle";
  private sourceRate = TARGET_RATE;
  private seconds = 0;
  private lastFrameAt = 0;
  private stopping = false;

  constructor(ports: MicPorts, limits: MicLimits = DEFAULT_MIC_LIMITS) {
    this.ports = ports;
    this.limits = limits;
  }

  get current(): MicState {
    return this.state;
  }

  /** Wie viel Audio diese Sitzung schon gesendet hat. */
  get sentSeconds(): number {
    return this.seconds;
  }

  private set(state: MicState, detail?: { reason?: string }): void {
    if (this.state === state) return;
    this.state = state;
    this.ports.onState(state, detail);
  }

  /** Auf Knopfdruck – und nur so. */
  async start(now = 0): Promise<void> {
    if (this.state === "listening" || this.state === "asking") return;
    this.stopping = false;
    this.set("asking");
    try {
      const { sampleRate } = await this.ports.open();
      if (this.stopping) {
        // Zwischendurch abgebrochen: Das Mikrofon darf nicht offen bleiben.
        await this.ports.close();
        this.set("idle");
        return;
      }
      this.sourceRate = sampleRate > 0 ? sampleRate : TARGET_RATE;
      this.seconds = 0;
      this.lastFrameAt = now;
      this.set("listening");
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unknown";
      this.set(reason === "NotAllowedError" || reason === "SecurityError" ? "denied" : "error", { reason });
      await this.ports.close().catch(() => {});
    }
  }

  /** Ein Rahmen aus dem Worklet. */
  push(frame: Float32Array, now = 0): void {
    if (this.state !== "listening" && this.state !== "speaking") return;
    this.lastFrameAt = now;
    this.ports.onLevel?.(levelDb(frame));

    const seconds = frame.length / this.sourceRate;
    this.seconds += seconds;
    if (this.seconds >= this.limits.maxSeconds) {
      void this.stop("limit");
      return;
    }
    this.ports.send(prepareFrame(frame, this.sourceRate));
  }

  /** Der Assistent hat zu sprechen begonnen. Das Mikrofon bleibt offen. */
  speaking(on: boolean): void {
    if (this.state !== "listening" && this.state !== "speaking") return;
    this.set(on ? "speaking" : "listening");
  }

  /** Regelmäßiger Herzschlag: erkennt eine tote Leitung. */
  tick(now: number): void {
    if (this.state !== "listening" && this.state !== "speaking") return;
    if (now - this.lastFrameAt >= this.limits.idleMs) void this.stop("idle");
  }

  /** Tab gewechselt, Seite verlassen, Knopf noch einmal gedrückt. */
  async stop(reason = "user"): Promise<void> {
    this.stopping = true;
    if (this.state === "idle") return;
    await this.ports.close().catch(() => {});
    this.state = "idle";
    this.ports.onState("idle", { reason });
  }
}
