import { timingSafeEqual } from "node:crypto";

/**
 * Träger-Geheimnis der Betriebsrouten (tick, migrate, bootstrap-admin,
 * settings): `Authorization: Bearer <secret>`, verglichen in konstanter Zeit.
 * Ohne konfiguriertes Geheimnis ist die Route nach außen nicht vorhanden –
 * die Aufrufer antworten dann mit 404, nicht mit 401, damit nichts verrät,
 * dass es hier etwas zu erraten gäbe.
 */
export function bearerAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
