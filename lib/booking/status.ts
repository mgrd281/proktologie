/**
 * Zustand der Online-Buchung aus dem Praxis-Cockpit und die daraus
 * abgeleitete Provider-Wahl – reine Logik ohne DOM und ohne Bundler-Alias,
 * damit sie sich ohne Browser prüfen lässt:
 *
 *   node --experimental-strip-types --test lib/booking/status.test.mjs
 *
 * Die Terminkarte fragt den Zustand genau einmal beim Laden ab. Nur „live
 * und nicht pausiert“ schaltet auf den verbindlichen Provider. Alles andere
 * – nicht live, pausiert, keine oder kaputte Antwort, Zeitablauf – lässt die
 * Website beim Wunschtermin, wie sie ihn schon immer angeboten hat: still,
 * ohne Fehlermeldung und ohne ein Versprechen, das das Cockpit gerade nicht
 * halten kann.
 */

/** Sprechzeit heute und nächste Öffnung, wie das Cockpit sie kennt (Urlaub, Feiertage eingerechnet). */
export interface HoursInfo {
  /** Tag, für den `today` gilt ("YYYY-MM-DD", Berlin) */
  date: string;
  today: Array<{ from: string; to: string }>;
  next: { date: string; from: string } | null;
}

export interface CockpitStatus {
  bookingLive: boolean;
  bookingPaused: boolean;
  /** Hinweistext der Praxis (getrimmt), sonst null. */
  banner: string | null;
  /**
   * Chat-Assistent auf der Website sichtbar. Fehlt das Feld – etwa weil
   * das Cockpit noch älter ist als das Widget –, gilt „an“: Der Chat kann
   * ohnehin nichts anrichten, er ruft dieselbe Route auf, die ihn selbst
   * abschaltet.
   */
  chatEnabled: boolean;
  /**
   * Mikrofon im Chatfenster. Fehlt das Feld oder ist kein Sprachanbieter
   * eingerichtet, gilt „aus“ – hier gilt die umgekehrte Vorsicht als beim
   * Chat: Ein Knopf, hinter dem nichts passiert, ist schlimmer als kein
   * Knopf, und Zuhören kostet je Minute.
   */
  voice: boolean;
  /** Fehlt bei älteren Cockpits – dann gibt es keine „Jetzt geöffnet“-Zeile. */
  hours: HoursInfo | null;
}

export type ProviderChoice = {
  kind: "cockpit" | "request";
  /** Hinweis für die Terminkarte – nur, wenn die Praxis pausiert hat. */
  notice?: string;
};

/** Antwortfrist des Status-Aufrufs – danach bleibt es still beim Wunschtermin. */
export const STATUS_TIMEOUT_MS = 4000;

export function chooseProvider(status: CockpitStatus | null, pausedNotice: string): ProviderChoice {
  // Nicht live oder unbekannt: Die Website verhält sich wie ohne Cockpit – ohne Hinweis.
  if (!status || !status.bookingLive) return { kind: "request" };
  // Pausiert: Wunschtermin bleibt möglich, die Praxis sagt dazu, warum.
  if (status.bookingPaused) return { kind: "request", notice: status.banner ?? pausedNotice };
  return { kind: "cockpit" };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function parseHours(raw: unknown): HoursInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  if (typeof h.date !== "string" || !DATE.test(h.date) || !Array.isArray(h.today)) return null;
  const today = h.today.filter(
    (w): w is { from: string; to: string } =>
      !!w && typeof w === "object" && TIME.test(String((w as { from?: unknown }).from)) && TIME.test(String((w as { to?: unknown }).to)),
  );
  const n = h.next as { date?: unknown; from?: unknown } | null | undefined;
  const next = n && typeof n.date === "string" && DATE.test(n.date) && typeof n.from === "string" && TIME.test(n.from) ? { date: n.date, from: n.from } : null;
  return { date: h.date, today: today.map((w) => ({ from: w.from, to: w.to })), next };
}

function parseStatus(body: unknown): CockpitStatus | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.bookingLive !== "boolean" || typeof b.bookingPaused !== "boolean") return null;
  const banner = typeof b.banner === "string" ? b.banner.trim() : "";
  return {
    bookingLive: b.bookingLive,
    bookingPaused: b.bookingPaused,
    banner: banner || null,
    chatEnabled: typeof b.chatEnabled === "boolean" ? b.chatEnabled : true,
    voice: b.voice === true,
    hours: parseHours(b.hours),
  };
}

/**
 * GET /api/public/v1/status – ohne Cookies, ohne Browser-Cache, mit Frist.
 * Jede Störung ergibt `null`; die Entscheidung darüber trifft chooseProvider.
 */
export async function fetchCockpitStatus(
  apiBase: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<CockpitStatus | null> {
  const base = apiBase.replace(/\/+$/, "");
  if (!base) return null;
  const timeoutMs = options.timeoutMs ?? STATUS_TIMEOUT_MS;
  // Als Pfeil gebunden, damit fetch nicht mit fremdem `this` aufgerufen wird
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}/api/public/v1/status`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return parseStatus(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let shared: { base: string; promise: Promise<CockpitStatus | null> } | null = null;

/**
 * Ein Abruf je Seitenaufruf, geteilt von Terminkarte, Chat und der
 * Sprechzeit-Zeile – statt dreimal dasselbe zu fragen.
 */
export function sharedCockpitStatus(apiBase: string): Promise<CockpitStatus | null> {
  if (!shared || shared.base !== apiBase) shared = { base: apiBase, promise: fetchCockpitStatus(apiBase) };
  return shared.promise;
}
