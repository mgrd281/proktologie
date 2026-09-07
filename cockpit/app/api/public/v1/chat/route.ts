import { apiError, clientIp, json, preflight, readJson } from "@/lib/api/http";
import { audit } from "@/lib/audit";
import { PublicError, bookPublicSlot } from "@/lib/booking/public";
import { RequestError, createCallbackRequest } from "@/lib/booking/requests";
import {
  chatRequestSchema,
  emergencyReply,
  isEmergency,
  runTurn,
  stateFor,
  type BookOutcome,
  type CallbackOutcome,
  type ChatDeps,
} from "@/lib/chat/orchestrator";
import { complete } from "@/lib/chat/llm";
import { t } from "@/lib/chat/texts";
import { naechsterFreierTermin, praxisSprechzeiten, publicTypeList, verfuegbarkeitPruefen } from "@/lib/chat/tools";
import { emailHash, normalizeEmail, phoneHash } from "@/lib/crypto/blindIndex";
import { getDb } from "@/lib/db/client";
import { maybeTick } from "@/lib/jobs/tick";
import { sendAppointmentMail } from "@/lib/messaging/send";
import { hit } from "@/lib/ratelimit";
import * as repo from "@/lib/booking/repo";

/**
 * Die Chat-Route – zustandslos.
 *
 * Der Verlauf liegt im Browser; hier kommt je Zug ein kompakter Zustand an,
 * wird geprüft und geht verändert zurück. Auf dem Server bleibt davon
 * nichts liegen: Es gibt keine Chat-Tabelle und damit auch nichts zu
 * löschen. Gespeichert wird nur, was auch das Formular der Website
 * speichert – Buchungen und Rückrufbitten, verschlüsselt.
 *
 * Reihenfolge, und zwar in dieser:
 *   1. Notfall – ohne Datenbank, ohne Zählung, ohne Modell. Wer „ich
 *      bekomme keine Luft“ schreibt, bekommt 112, auch wenn der Chat
 *      abgeschaltet ist oder das Limit erreicht wurde.
 *   2. Rate-Limit je Sitzung und je IP. Die Sitzungs-Id wählt der Browser,
 *      der echte Riegel ist deshalb die IP.
 *   3. Abschalter der Praxis (chatEnabled) → 503.
 *   4. Der Gesprächsablauf mit den echten Abhängigkeiten.
 *
 * Diese Datei ist die einzige Stelle, an der die reinen Chat-Module auf
 * Datenbank, Mailversand und Sprachmodell treffen. Alles darüber ist ohne
 * Netz prüfbar; diese Verdrahtung prüft der Playwright-Lauf durch die
 * echte Route.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Wie lange der Chat auf die Bestätigungsmail wartet, bevor er ehrlich ist. */
const MAIL_RACE_MS = 5000;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const body = await readJson<unknown>(req);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  const chat = parsed.data;
  const state = stateFor(chat);
  const T = t(state.lang);

  // 1. Notfall vor allem anderen
  if (isEmergency(chat)) return json(req, emergencyReply(state));

  await getDb();
  const ip = clientIp(req);

  // 2. Zwei Fenster: die Sitzung gegen Endlosschleifen, die IP gegen Missbrauch
  const [session, address] = await Promise.all([
    hit("chat.session", chat.sessionId, { limit: 20, windowSec: 3600 }),
    hit("chat.ip", ip, { limit: 120, windowSec: 3600 }),
  ]);
  if (!session.ok || !address.ok) return apiError(req, 429, "rate_limited", T.rateLimited);

  // 3. Abschalter der Praxis
  const settings = await repo.getSettings();
  if (!settings.chatEnabled) return apiError(req, 503, "chat_disabled", T.disabled);

  const work = { touched: false };
  const answer = await runTurn(chat, realDeps(ip, work));

  if (work.touched) {
    try {
      const { after } = await import("next/server");
      after(() => maybeTick());
    } catch {
      void maybeTick();
    }
  }
  return json(req, answer);
}

// ------------------------------------------------------ Verdrahtung

function realDeps(ip: string, work: { touched: boolean }): ChatDeps {
  return {
    now: () => new Date(),
    types: () => publicTypeList(),
    availability: (args, ctx) => verfuegbarkeitPruefen(args, ctx),
    nextFree: (args, ctx) => naechsterFreierTermin(args, ctx),
    info: async (lang) => {
      const [hoursText, settings] = await Promise.all([praxisSprechzeiten(lang), repo.getSettings()]);
      return { hoursText, banner: settings.bannerText?.trim() || null };
    },
    classify: async (call) => {
      const r = await complete(call);
      logModel("classify", r);
      return r.ok ? r.text : null;
    },
    phrase: async (call) => {
      const r = await complete(call);
      logModel("phrase", r);
      return r.ok ? r.text : null;
    },
    book: async (input) => {
      const outcome = await bookSlot(input, ip);
      if (outcome.ok) work.touched = true;
      return outcome;
    },
    callback: async (input) => {
      const outcome = await saveCallback(input, ip);
      if (outcome.ok) work.touched = true;
      return outcome;
    },
    bookingsToday: async (email) => (await hit("chat.book", normalizeEmail(email), { limit: 3, windowSec: 86_400 })).ok,
    isBlocked,
    audit: (event, meta) => {
      // Ins revisionssichere Protokoll gehen nur Vorgänge, die jemanden
      // betreffen könnten. Der Rest ist eine Zeile im Log – ohne Inhalt.
      if (event === "chat.blocked" || event === "chat.daily_limit" || event === "chat.emergency") {
        void audit({ action: event, entity: "chat", meta: meta ?? {} }).catch(() => {});
      } else {
        console.log(`[chat] ${event}${meta ? ` ${JSON.stringify(meta)}` : ""}`);
      }
    },
  };
}

function logModel(task: string, r: Awaited<ReturnType<typeof complete>>) {
  // Nie Inhalte: nur wer geantwortet hat und wie lange es gedauert hat.
  if (r.ok) console.log(`[chat.llm] ${task} provider=${r.model.provider} model=${r.model.model} ms=${r.ms}`);
  else console.log(`[chat.llm] ${task} reason=${r.reason} tried=${r.tried.join(",")}`);
}

async function bookSlot(input: Parameters<ChatDeps["book"]>[0], ip: string): Promise<BookOutcome> {
  try {
    const r = await bookPublicSlot(
      {
        typeId: input.typeId,
        date: input.date,
        time: input.time,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        locale: input.locale,
      },
      { ip, source: "chat" },
    );
    return { ok: true, ref: r.ref, typeLabel: r.typeLabel, mail: await raceMail(r.appointmentId) };
  } catch (e) {
    if (e instanceof PublicError) {
      const known = ["slot_taken", "too_many", "rate_limited", "not_live", "paused"] as const;
      const code = (known as readonly string[]).includes(e.code) ? (e.code as (typeof known)[number]) : "error";
      const banner = typeof e.extra.banner === "string" ? e.extra.banner : e.code === "paused" ? e.message : null;
      return { ok: false, code, banner };
    }
    console.error("[chat] Buchung fehlgeschlagen", e);
    return { ok: false, code: "error" };
  }
}

/**
 * Die Bestätigungsmail steht ohnehin in der Warteschlange (`afterBooked`).
 * Hier wird kurz mitgewartet, damit der Chat nicht „ist unterwegs“ sagt,
 * wenn nichts unterwegs ist. Dauert es länger, gilt der ehrliche Satz –
 * der Job wiederholt es, der Dedupe-Schlüssel verhindert die zweite Mail.
 */
async function raceMail(appointmentId: string): Promise<"sent" | "failed"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"failed">((resolve) => {
    timer = setTimeout(() => resolve("failed"), MAIL_RACE_MS);
  });
  const send = sendAppointmentMail("confirmation", appointmentId)
    .then((o) => (o.sent || o.reason === "duplicate" ? ("sent" as const) : ("failed" as const)))
    .catch(() => "failed" as const);
  try {
    return await Promise.race([send, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function saveCallback(input: Parameters<ChatDeps["callback"]>[0], ip: string): Promise<CallbackOutcome> {
  try {
    const r = await createCallbackRequest(
      {
        kind: input.kind,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email ?? "",
        preferredTime: input.preferredTime,
        note: input.note ?? "",
        locale: input.locale,
      },
      { ip, source: "chat", isBlocked: (email, phone) => isBlocked(email ?? null, phone) },
    );
    return { ok: true, ref: r.ref };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, code: e.code };
    console.error("[chat] Rückruf fehlgeschlagen", e);
    return { ok: false, code: "validation" };
  }
}

/**
 * Sperrliste aus der Umgebung (`CHAT_BLOCKLIST`, kommagetrennt). Verglichen
 * wird über die Blindindizes – die Liste steht als Klartext in der
 * Konfiguration, im Speicher landen nur Hashes.
 */
function isBlocked(email: string | null, phone: string | null): boolean {
  const raw = process.env.CHAT_BLOCKLIST;
  if (!raw) return false;
  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return false;
  const mails = new Set<string>();
  const phones = new Set<string>();
  for (const entry of entries) {
    if (entry.includes("@")) mails.add(emailHash(entry));
    else phones.add(phoneHash(entry));
  }
  if (email && mails.has(emailHash(email))) return true;
  if (phone && phones.has(phoneHash(phone))) return true;
  return false;
}
