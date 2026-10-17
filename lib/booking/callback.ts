/**
 * Rückrufbitte „Kein passender Termin dabei?“ – wohin sie geht und wie.
 * Reine Logik ohne DOM und ohne Bundler-Alias, prüfbar mit
 *
 *   node --experimental-strip-types --test lib/booking/callback.test.mjs
 *
 * Betreibt die Praxis die Online-Buchung im Cockpit (live, auch pausiert –
 * der Posteingang läuft weiter), landet die Bitte dort unter „Anfragen“, die
 * Praxis bekommt eine kurze Hinweis-Mail. Sonst bleibt es beim vorbereiteten
 * E-Mail-Entwurf (mailto), wie bisher. Übertragen werden nur Name, Telefon
 * und Wunschzeit – nie ein Grund oder Beschwerden.
 */
import type { CockpitStatus } from "./status.ts";

export type CallbackChannel = "cockpit" | "mailto";

export function callbackChannel(status: CockpitStatus | null): CallbackChannel {
  return status?.bookingLive ? "cockpit" : "mailto";
}

export type PreferredTime = "egal" | "vormittags" | "nachmittags";

export interface CallbackInput {
  firstName: string;
  lastName: string;
  phone: string;
  preferredTime: PreferredTime;
  consent: boolean;
  /** Honigtopf – für Menschen unsichtbar, bleibt leer. */
  hp: string;
}

export type CallbackResult = { ok: true; ref: string } | { ok: false; code: string; message: string | null };

/** Mindestalter des Formular-Tokens (Server: drei Sekunden) – mit etwas Luft. */
export const MIN_TOKEN_AGE_MS = 3200;
const MAX_TOKEN_AGE_MS = 25 * 60_000;

export interface FormToken {
  value: string;
  issuedAt: number;
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchImpl = (input, init) => fetch(input, init);

export async function fetchCallbackToken(
  apiBase: string,
  fetchImpl: FetchImpl = defaultFetch,
  now: () => number = Date.now,
): Promise<FormToken | null> {
  try {
    const res = await fetchImpl(`${apiBase}/api/public/v1/requests`, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    const body = (await res.json().catch(() => null)) as { formToken?: unknown } | null;
    if (!res.ok || typeof body?.formToken !== "string") return null;
    return { value: body.formToken, issuedAt: now() };
  } catch {
    return null;
  }
}

async function post(apiBase: string, input: CallbackInput, token: string, fetchImpl: FetchImpl): Promise<CallbackResult> {
  try {
    const res = await fetchImpl(`${apiBase}/api/public/v1/requests`, {
      method: "POST",
      credentials: "omit",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "rueckruf",
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        preferredTime: input.preferredTime,
        consent: input.consent,
        formToken: token,
        hp: input.hp,
      }),
    });
    const body = (await res.json().catch(() => null)) as { ref?: unknown; error?: { code?: unknown; message?: unknown } } | null;
    if (res.ok && typeof body?.ref === "string") return { ok: true, ref: body.ref };
    const code = typeof body?.error?.code === "string" ? body.error.code : "http";
    const message = typeof body?.error?.message === "string" ? body.error.message : null;
    return { ok: false, code, message };
  } catch {
    return { ok: false, code: "network", message: null };
  }
}

/**
 * Absenden: frisches Token sicherstellen, notfalls kurz warten (ein Mensch
 * ist selten schneller als drei Sekunden), bei verworfenem Token einmal neu.
 */
export async function sendCallback(
  apiBase: string,
  input: CallbackInput,
  token: FormToken | null,
  options: { fetchImpl?: FetchImpl; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<CallbackResult> {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const ready = async (t: FormToken | null) => {
    const fresh = t && now() - t.issuedAt < MAX_TOKEN_AGE_MS ? t : await fetchCallbackToken(apiBase, fetchImpl, now);
    if (!fresh) return null;
    const wait = MIN_TOKEN_AGE_MS - (now() - fresh.issuedAt);
    if (wait > 0) await sleep(wait);
    return fresh;
  };
  const first = await ready(token);
  if (!first) return { ok: false, code: "network", message: null };
  const result = await post(apiBase, input, first.value, fetchImpl);
  if (result.ok || result.code !== "form_token") return result;
  const second = await ready(null);
  if (!second) return { ok: false, code: "network", message: null };
  return post(apiBase, input, second.value, fetchImpl);
}
