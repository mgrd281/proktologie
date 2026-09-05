import { createHmac } from "node:crypto";

/**
 * Blind-Indizes: Suche nach E-Mail/Telefon/Name ohne Entschlüsselung.
 * HMAC-SHA256 mit INDEX_KEY über eine normalisierte Form – aus dem Hash
 * lässt sich der Klartext nicht rekonstruieren, gleiche Eingaben ergeben
 * aber denselben Index (exakte Treffer, keine Teilstring-Suche).
 */

function key(): Buffer {
  const raw = process.env.INDEX_KEY;
  if (!raw) throw new Error("INDEX_KEY fehlt");
  return Buffer.from(raw, "base64");
}

function hmac(scope: string, value: string): string {
  return createHmac("sha256", key()).update(`${scope} ${value}`).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Ziffern + führendes Plus; deutsche Nummern ohne Landesvorwahl → +49. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("0")) digits = `+49${digits.slice(1)}`;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return digits;
}

/** Kleinbuchstaben, ohne Diakritika und Mehrfach-Leerzeichen. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const emailHash = (email: string) => hmac("email", normalizeEmail(email));
export const phoneHash = (phone: string) => hmac("phone", normalizePhone(phone));
export const nameKey = (lastName: string, firstName: string) =>
  hmac("name", `${normalizeName(lastName)}|${normalizeName(firstName)}`);
