/**
 * Der Gesprächsverlauf – ausschließlich im Browser.
 *
 * Auf dem Server gibt es keine Chat-Tabelle: Was hier liegt, liegt in
 * `sessionStorage` und ist mit dem Schließen des Tabs weg. Deshalb muss
 * niemand einen Verlauf löschen, und deshalb kann auch niemand ihn
 * herausgeben. Der Preis ist, dass ein Seitenwechsel den Verlauf nur
 * überlebt, solange der Tab offen bleibt – genau das ist gewollt.
 *
 * Reine Logik, ohne DOM-Zugriff im Modulrumpf, damit sie sich ohne
 * Browser prüfen lässt:
 *
 *   node --experimental-strip-types --test lib/chat/session.test.mjs
 */

import type { ChatForm, ChatQuick } from "./api.ts";

export type ChatRole = "user" | "assistant";

export interface StoredMessage {
  role: ChatRole;
  text: string;
  /** Millisekunden seit 1970 – nur für die Reihenfolge in der Anzeige. */
  at: number;
}

export interface StoredSession {
  v: 1;
  /** Zufällige Kennung, nur für das Rate-Limit. Kein Personenbezug. */
  sessionId: string;
  lang: "de" | "en";
  /** Der Zustand des Gesprächs, wie ihn das Cockpit zurückgegeben hat. */
  state: unknown;
  messages: StoredMessage[];
  open: boolean;
  /**
   * Auch die zuletzt angebotenen Schaltflächen und ein offenes Formular
   * gehören zum Gespräch: Wer mitten in einer Buchung die Seite wechselt,
   * soll dort weitermachen, wo er war – nicht von vorn anfangen.
   */
  quick?: ChatQuick[];
  form?: ChatForm | null;
  /** Ein einmal erkannter Notfall bleibt bestehen, auch nach einem Seitenwechsel. */
  emergency?: boolean;
}

export const STORAGE_KEY = "pe-chat-v1";
/** So viele Nachrichten bleiben stehen; ältere fallen vorne heraus. */
export const MAX_MESSAGES = 60;

export function newSession(lang: "de" | "en" = "de", id = randomId()): StoredSession {
  return { v: 1, sessionId: id, lang, state: null, messages: [], open: false, quick: [], form: null, emergency: false };
}

/** UUID v4, wenn der Browser sie anbietet – sonst ein einfacher Ersatz. */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Was nicht passt, wird verworfen – lieber ein neues Gespräch als ein kaputtes. */
export function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const s = data as Record<string, unknown>;
  if (s.v !== 1) return null;
  if (typeof s.sessionId !== "string" || !UUID_RE.test(s.sessionId)) return null;
  if (s.lang !== "de" && s.lang !== "en") return null;
  const messages = Array.isArray(s.messages)
    ? s.messages
        .filter((m): m is StoredMessage => {
          if (!m || typeof m !== "object") return false;
          const x = m as Record<string, unknown>;
          return (x.role === "user" || x.role === "assistant") && typeof x.text === "string" && typeof x.at === "number";
        })
        .slice(-MAX_MESSAGES)
    : [];
  return {
    v: 1,
    sessionId: s.sessionId,
    lang: s.lang,
    state: s.state ?? null,
    messages,
    open: s.open === true,
    quick: parseQuick(s.quick),
    form: parseForm(s.form),
    emergency: s.emergency === true,
  };
}

function parseQuick(v: unknown): ChatQuick[] {
  if (!Array.isArray(v)) return [];
  return v.filter((q): q is ChatQuick => Boolean(q) && typeof q === "object" && typeof (q as ChatQuick).id === "string" && typeof (q as ChatQuick).label === "string").slice(0, 12);
}

function parseForm(v: unknown): ChatForm | null {
  if (!v || typeof v !== "object") return null;
  const f = v as ChatForm;
  if (f.id !== "contact" && f.id !== "callback") return null;
  if (typeof f.title !== "string" || !Array.isArray(f.fields)) return null;
  return f;
}

export interface SessionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `sessionStorage`, sofern erreichbar – im privaten Modus kann es fehlen. */
export function browserStore(): SessionStore | null {
  try {
    const s = globalThis.sessionStorage;
    if (!s) return null;
    // Zugriff prüfen: In manchen Browsern wirft erst der Schreibversuch.
    s.setItem(`${STORAGE_KEY}-probe`, "1");
    s.removeItem(`${STORAGE_KEY}-probe`);
    return s;
  } catch {
    return null;
  }
}

export function load(store: SessionStore | null): StoredSession | null {
  if (!store) return null;
  try {
    return parseSession(store.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function save(store: SessionStore | null, session: StoredSession): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...session, messages: session.messages.slice(-MAX_MESSAGES) }));
  } catch {
    // Voller oder gesperrter Speicher darf das Gespräch nicht abbrechen.
  }
}

export function clear(store: SessionStore | null): void {
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // still
  }
}

export function append(session: StoredSession, role: ChatRole, text: string, at: number): StoredSession {
  return { ...session, messages: [...session.messages, { role, text, at }].slice(-MAX_MESSAGES) };
}

/** Dieselbe Prüfung wie im Buchungsformular der Website. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
