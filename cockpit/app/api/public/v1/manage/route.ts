import { apiError, clientIp, json, preflight, readJson } from "@/lib/api/http";
import { PublicError, manageAppointment, manageWaitlist } from "@/lib/booking/public";
import { getDb } from "@/lib/db/client";
import { maybeTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * Terminverwaltung durch Patient:innen. Das Token steht im Fragment des
 * Links (#…) und kommt ausschließlich im Body an – nie in URL oder Logs.
 * { token, action: view|confirm|cancel|reschedule, date?, time? }
 * { token, action: view|withdraw, scope: "waitlist" }
 */
export async function POST(req: Request) {
  await getDb();
  const body = await readJson<{ scope?: string }>(req);
  if (!body) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  try {
    const r = body.scope === "waitlist" ? await manageWaitlist(body, clientIp(req)) : await manageAppointment(body, clientIp(req));
    try {
      const { after } = await import("next/server");
      after(() => maybeTick());
    } catch {
      void maybeTick();
    }
    return json(req, r);
  } catch (e) {
    if (e instanceof PublicError) return apiError(req, e.status, e.code, e.message, e.extra);
    throw e;
  }
}
