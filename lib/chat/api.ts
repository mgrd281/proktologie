/**
 * Der Aufruf der Chat-Route im Praxis-Cockpit – ohne Cookies, ohne
 * Browser-Cache, mit Frist. Jede Störung wird zu einem benannten Fehler,
 * damit das Fenster einen ehrlichen Satz zeigen kann statt einer
 * technischen Meldung.
 *
 * Vorbild und Nachbar: lib/booking/status.ts. Wie dort ist auch das hier
 * reine Logik, prüfbar ohne Browser:
 *
 *   node --experimental-strip-types --test lib/chat/api.test.mjs
 */

export const CHAT_TIMEOUT_MS = 30_000;

/** Bewusst hier deklariert statt aus content/chat importiert: Diese Datei
 *  bleibt ohne Bundler-Alias ladbar, damit sie ohne Browser prüfbar ist. */
export type ChatLang = "de" | "en";

export interface ChatQuick {
  id: string;
  label: string;
}

export interface ChatFormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "select" | "checkbox" | "textarea";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface ChatForm {
  id: "contact" | "callback";
  title: string;
  submit: string;
  fields: ChatFormField[];
}

export interface ChatAnswer {
  reply: string;
  lang: ChatLang;
  state: unknown;
  quick?: ChatQuick[];
  form?: ChatForm;
  links?: Array<{ label: string; href: string }>;
  flags: {
    emergency?: true;
    handover?: true;
    booked?: { ref: string; mail: "sent" | "failed" };
    /** Der Server hat die Sprache aus dem Text erkannt – nur dann folgt die Oberfläche `lang`. */
    langDetected?: true;
    /** Eine Sprache, die der Chat nicht spricht: die Antwort ist ein fester Satz in dieser Sprache. */
    foreign?: string;
    llm: "model" | "fallback" | "none";
  };
}

export type ChatFailure = { error: "network" | "rate_limited" | "chat_disabled" | "invalid" };
export type ChatResult = { ok: true; answer: ChatAnswer } | ({ ok: false } & ChatFailure);

export interface ChatSend {
  sessionId: string;
  state: unknown;
  /** Vom Patienten ausdrücklich gewählte Sprache – sie gewinnt gegen die Erkennung. */
  lang?: ChatLang;
  message?: string;
  action?: { kind: "quick"; id: string } | { kind: "form"; formId: "contact" | "callback"; values: Record<string, string> };
}

function parseAnswer(body: unknown): ChatAnswer | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.reply !== "string" || !b.reply) return null;
  if (b.lang !== "de" && b.lang !== "en") return null;
  const flags = (b.flags ?? {}) as Record<string, unknown>;
  const llm = flags.llm === "model" || flags.llm === "fallback" ? flags.llm : "none";
  return {
    reply: b.reply,
    lang: b.lang,
    state: b.state ?? null,
    quick: Array.isArray(b.quick) ? (b.quick as ChatQuick[]).filter((q) => q && typeof q.id === "string" && typeof q.label === "string") : undefined,
    form: isForm(b.form) ? b.form : undefined,
    links: Array.isArray(b.links) ? (b.links as ChatAnswer["links"]) : undefined,
    flags: {
      emergency: flags.emergency === true ? true : undefined,
      handover: flags.handover === true ? true : undefined,
      booked: isBooked(flags.booked) ? flags.booked : undefined,
      langDetected: flags.langDetected === true ? true : undefined,
      foreign: typeof flags.foreign === "string" ? flags.foreign : undefined,
      llm,
    },
  };
}

function isForm(v: unknown): v is ChatForm {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return (f.id === "contact" || f.id === "callback") && typeof f.title === "string" && Array.isArray(f.fields);
}

function isBooked(v: unknown): v is { ref: string; mail: "sent" | "failed" } {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return typeof b.ref === "string" && (b.mail === "sent" || b.mail === "failed");
}

function failureFor(status: number): ChatFailure["error"] {
  if (status === 429) return "rate_limited";
  if (status === 503) return "chat_disabled";
  return "invalid";
}

export async function sendChat(
  apiBase: string,
  body: ChatSend,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ChatResult> {
  const base = apiBase.replace(/\/+$/, "");
  if (!base) return { ok: false, error: "chat_disabled" };
  const timeoutMs = options.timeoutMs ?? CHAT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}/api/public/v1/chat`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ v: 1, ...body }),
    });
    if (!res.ok) return { ok: false, error: failureFor(res.status) };
    const answer = parseAnswer(await res.json());
    return answer ? { ok: true, answer } : { ok: false, error: "invalid" };
  } catch {
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
