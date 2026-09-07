import { verifyFormToken } from "@/lib/api/formToken";
import { apiError, clientIp, json, preflight, readJson } from "@/lib/api/http";
import { createCallbackRequest, RequestError } from "@/lib/booking/requests";
import { getDb } from "@/lib/db/client";
import { enqueue } from "@/lib/jobs/queue";
import { maybeTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";

/**
 * Rückrufbitte von der Website: „Kein passender Termin dabei?“ Es werden
 * nur Name, Telefon und eine Wunschzeit erfragt – nie ein Grund, nie
 * Beschwerden. Der Weg ist derselbe wie beim Chat; hier kommen zusätzlich
 * Formular-Token und Honigtopf dazu, weil ein Browserformular davorsteht.
 */
export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  await getDb();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  // Honigtopf: für Menschen unsichtbar; gefüllt → wie ein Validierungsfehler
  if (typeof body.hp === "string" && body.hp.length > 0) return apiError(req, 422, "validation", "Ungültige Anfrage.");
  const token = typeof body.formToken === "string" ? body.formToken : "";
  if (!verifyFormToken(token, Date.now()).ok) {
    return apiError(req, 400, "form_token", "Das Formular ist abgelaufen. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  }
  if (body.consent !== true) return apiError(req, 422, "validation", "Einwilligung fehlt");

  try {
    const r = await createCallbackRequest(body, { ip: clientIp(req), source: "web" });
    await enqueue({ kind: "mail.practice_notice", payload: { kind: "callback", requestId: r.id }, dedupeKey: `mail.practice_notice:${r.id}` });
    try {
      const { after } = await import("next/server");
      after(() => maybeTick());
    } catch {
      void maybeTick();
    }
    return json(req, { ref: r.ref }, { status: 201 });
  } catch (e) {
    if (e instanceof RequestError) return apiError(req, e.status, e.code, e.message);
    throw e;
  }
}
