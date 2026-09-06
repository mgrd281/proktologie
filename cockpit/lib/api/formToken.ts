import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Formular-Token gegen automatisierte Buchungen: HMAC-signierter Zeitstempel
 * plus Nonce. Die Website holt ihn mit der Verfügbarkeit ab und schickt ihn
 * mit der Buchung zurück. Gültig zwischen MIN_AGE (ein Mensch braucht länger
 * als drei Sekunden vom Laden bis zum Absenden) und MAX_AGE (30 Minuten).
 * Es wird nichts gespeichert – der Server prüft nur die Signatur.
 */
export const MIN_AGE_MS = 3_000;
export const MAX_AGE_MS = 30 * 60_000;

function secret(): Buffer {
  const raw = process.env.FORM_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!raw) throw new Error("FORM_TOKEN_SECRET (oder BETTER_AUTH_SECRET) fehlt");
  return Buffer.from(raw, "utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueFormToken(now = Date.now()): string {
  const payload = `${now}.${randomBytes(8).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export type FormTokenCheck = { ok: true } | { ok: false; reason: "malformed" | "signature" | "too_young" | "expired" };

export function verifyFormToken(token: string | null | undefined, now = Date.now()): FormTokenCheck {
  if (!token) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [ts, nonce, sig] = parts as [string, string, string];
  if (!/^\d{10,16}$/.test(ts) || !nonce) return { ok: false, reason: "malformed" };
  const expected = sign(`${ts}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature" };
  const age = now - Number(ts);
  if (age < MIN_AGE_MS) return { ok: false, reason: "too_young" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}
