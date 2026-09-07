import { NextResponse } from "next/server";
import { bearerAuthorized } from "@/lib/api/bearer";
import { getDb } from "@/lib/db/client";
import { runTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Externer Herzschlag: Vercel Cron (täglich, vercel.json – schickt CRON_SECRET
 * von sich aus als Bearer und ruft per GET) und GitHub Actions (alle 15
 * Minuten, POST) rufen /api/internal/tick mit `Authorization: Bearer <CRON_SECRET>`.
 * Ohne konfiguriertes Geheimnis existiert die Route nach außen nicht (404).
 */
const authorized = (req: Request) => bearerAuthorized(req, process.env.CRON_SECRET);

async function handle(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  await getDb();
  const report = await runTick();
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}

export const POST = handle;
export const GET = handle;
