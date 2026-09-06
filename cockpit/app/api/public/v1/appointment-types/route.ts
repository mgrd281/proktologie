import { json, preflight } from "@/lib/api/http";
import { publicTypes } from "@/lib/booking/public";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  await getDb();
  return json(req, { types: await publicTypes() }, { cache: "public, s-maxage=300, stale-while-revalidate=600" });
}
