import { apiError, clientIp, corsHeaders, preflight, readJson } from "@/lib/api/http";
import { getDb } from "@/lib/db/client";
import { hit } from "@/lib/ratelimit";
import { MAX_SPEAK_CHARS, synthesize, voiceConfigured } from "@/lib/voice/openai";
import { toSpeech } from "@/lib/chat/speech";
import * as repo from "@/lib/booking/repo";
import { z } from "zod";

/**
 * Der Mund.
 *
 * Hier geht ausschließlich hinein, was der Automat selbst formuliert hat.
 * Vorher läuft der Satz noch durch `toSpeech`: „07:15" wird zu „sieben Uhr
 * fünfzehn", „PE-4F7K" wird buchstabiert, und aus einer Schaltflächenliste
 * wird ein Satz, den man hören kann.
 *
 * Der Text der Patientin kommt hier nie an. Er geht zum Erkennen an den
 * Anbieter und danach in den Automaten – vorgelesen wird nur die Antwort.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const schema = z.object({
  v: z.literal(1),
  sessionId: z.string().uuid(),
  lang: z.enum(["de", "en"]).default("de"),
  text: z.string().min(1).max(MAX_SPEAK_CHARS),
});

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  const { sessionId, lang, text } = parsed.data;

  if (!voiceConfigured()) return apiError(req, 503, "voice_disabled", "Sprache ist nicht eingerichtet.");

  await getDb();
  const ip = clientIp(req);
  const [session, address] = await Promise.all([
    hit("voice.speak.session", sessionId, { limit: 60, windowSec: 3600 }),
    hit("voice.speak.ip", ip, { limit: 200, windowSec: 3600 }),
  ]);
  if (!session.ok || !address.ok) return apiError(req, 429, "rate_limited", "Zu viele Anfragen.");

  // Derselbe Riegel wie beim Ausweis. Sonst spräche eine Sitzung, die vor
  // dem Abschalten geöffnet wurde, danach ungerührt weiter – wer den Chat
  // abschaltet, hat auch den Mund abgeschaltet.
  const settings = await repo.getSettings();
  if (!settings.chatEnabled) return apiError(req, 503, "chat_disabled", "Sprache ist gerade nicht verfügbar.");

  try {
    const audio = await synthesize(toSpeech(text, lang, { channel: "web" }), lang);
    const headers = new Headers(corsHeaders(req));
    headers.set("content-type", "audio/mpeg");
    return new Response(audio, { status: 200, headers });
  } catch (error) {
    console.error(`[voice] speak: ${error instanceof Error ? error.message : "unbekannt"}`);
    return apiError(req, 502, "voice_unavailable", "Die Sprachausgabe ist gerade nicht erreichbar.");
  }
}
