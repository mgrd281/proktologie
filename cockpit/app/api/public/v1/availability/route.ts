import { apiError, clientIp, json, preflight } from "@/lib/api/http";
import { PublicError, publicAvailability } from "@/lib/booking/public";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** GET ?type=kontrolle&from=YYYY-MM-DD&to=YYYY-MM-DD → Tage mit freien Startzeiten + Formular-Token. */
export async function GET(req: Request) {
  await getDb();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  try {
    const r = await publicAvailability(type, url.searchParams.get("from"), url.searchParams.get("to"), clientIp(req));
    return json(req, r);
  } catch (e) {
    if (e instanceof PublicError) return apiError(req, e.status, e.code, e.message, e.extra);
    throw e;
  }
}
