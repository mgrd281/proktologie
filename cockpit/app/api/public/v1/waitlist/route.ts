import { apiError, clientIp, json, preflight, readJson } from "@/lib/api/http";
import { PublicError, joinWaitlist } from "@/lib/booking/public";
import { getDb } from "@/lib/db/client";
import { maybeTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  await getDb();
  const body = await readJson<unknown>(req);
  if (!body) return apiError(req, 400, "validation", "Ungültige Anfrage.");
  try {
    const r = await joinWaitlist(body, clientIp(req));
    try {
      const { after } = await import("next/server");
      after(() => maybeTick());
    } catch {
      void maybeTick();
    }
    return json(req, r, { status: 201 });
  } catch (e) {
    if (e instanceof PublicError) return apiError(req, e.status, e.code, e.message, e.extra);
    throw e;
  }
}
