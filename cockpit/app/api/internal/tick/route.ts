import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { runTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Externer Herzschlag: GitHub Actions (alle 15 Minuten) oder ein Cron-Dienst
 * ruft POST /api/internal/tick mit `Authorization: Bearer <CRON_SECRET>`.
 * Ohne konfiguriertes Geheimnis existiert die Route nach außen nicht (404).
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });
  await getDb();
  const report = await runTick();
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}

export const POST = handle;
export const GET = handle;
