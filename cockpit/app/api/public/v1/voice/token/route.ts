import { apiError, clientIp, json, preflight, readJson } from "@/lib/api/http";
import { getDb } from "@/lib/db/client";
import { hit } from "@/lib/ratelimit";
import { mintListenSecret, voiceConfigured } from "@/lib/voice/openai";
import { t } from "@/lib/chat/texts";
import * as repo from "@/lib/booking/repo";
import { z } from "zod";

/**
 * Der Ausweis fürs Zuhören.
 *
 * Der Browser bekommt hier ein kurzlebiges Geheimnis und spricht damit
 * direkt mit dem Anbieter. Das ist kein Umweg, sondern der Punkt: Der
 * echte Schlüssel bleibt auf dem Server, und zwischen Mikrofon und
 * Erkennung sitzt kein zusätzlicher Rechner, der mithören könnte.
 *
 * Dieselben Riegel wie im Chat: erst die Datenbank, dann das Limit je
 * Sitzung und je IP, dann der Abschalter der Praxis. Wer den Chat
 * abgeschaltet hat, hat auch das Mikrofon abgeschaltet.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const schema = z.object({
  v: z.literal(1),
  sessionId: z.string().uuid(),
  lang: z.enum(["de", "en"]).default("de"),
});

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  const { sessionId, lang } = parsed.data;
  const T = t(lang);

  if (!voiceConfigured()) return apiError(req, 503, "voice_disabled", T.disabled);

  await getDb();
  const ip = clientIp(req);
  // Zuhören kostet Geld je Minute. Das Limit ist deshalb enger als im Chat.
  const [session, address] = await Promise.all([
    hit("voice.session", sessionId, { limit: 8, windowSec: 3600 }),
    hit("voice.ip", ip, { limit: 30, windowSec: 3600 }),
  ]);
  if (!session.ok || !address.ok) return apiError(req, 429, "rate_limited", T.rateLimited);

  const settings = await repo.getSettings();
  if (!settings.chatEnabled) return apiError(req, 503, "chat_disabled", T.disabled);

  try {
    const secret = await mintListenSecret(lang);
    // Kein Cache, nirgends: Ein Ausweis gehört genau einer Sitzung.
    return json(req, { v: 1, ...secret }, { cache: "no-store" });
  } catch {
    return apiError(req, 502, "voice_unavailable", T.llmDown);
  }
}
