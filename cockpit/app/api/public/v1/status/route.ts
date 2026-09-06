import { json, preflight } from "@/lib/api/http";
import { publicStatus } from "@/lib/booking/public";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Zustand der Online-Buchung – ohne Personenbezug, kurz cachebar am Edge. */
export async function GET(req: Request) {
  await getDb();
  const s = await publicStatus();
  return json(req, s, { cache: "public, s-maxage=60, stale-while-revalidate=300" });
}
