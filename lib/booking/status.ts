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

export interface CockpitStatus {
  bookingLive: boolean;
  bookingPaused: boolean;
  /** Hinweistext der Praxis (getrimmt), sonst null. */
  banner: string | null;
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

function parseStatus(body: unknown): CockpitStatus | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.bookingLive !== "boolean" || typeof b.bookingPaused !== "boolean") return null;
  const banner = typeof b.banner === "string" ? b.banner.trim() : "";
  return { bookingLive: b.bookingLive, bookingPaused: b.bookingPaused, banner: banner || null };
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
