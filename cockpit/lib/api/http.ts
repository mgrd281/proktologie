import { NextResponse } from "next/server";

/**
 * Gemeinsame Antworten der öffentlichen API. CORS nur für die konfigurierten
 * Website-Ursprünge (SITE_ORIGINS, kommagetrennt); Standard sind die
 * bekannten Adressen der Praxis-Website plus localhost für die Entwicklung.
 */
const DEFAULT_ORIGINS = [
  "https://proktologie.vercel.app",
  "https://www.proktologie-eimsbuettel.de",
  "https://proktologie-eimsbuettel.de",
  "http://localhost:3000",
];

export function allowedOrigins(): string[] {
  const raw = process.env.SITE_ORIGINS;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allow = origin && allowedOrigins().includes(origin) ? origin : null;
  const h: Record<string, string> = {
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (allow) {
    h["Access-Control-Allow-Origin"] = allow;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

export function json(req: Request, data: unknown, init: { status?: number; cache?: string } = {}) {
  const headers = corsHeaders(req);
  if (init.cache) headers["Cache-Control"] = init.cache;
  return NextResponse.json(data, { status: init.status ?? 200, headers });
}

export type ApiErrorCode =
  | "not_live"
  | "paused"
  | "rate_limited"
  | "form_token"
  | "validation"
  | "unknown_type"
  | "slot_taken"
  | "too_many"
  | "not_found"
  | "conflict"
  | "unsupported";

export function apiError(req: Request, status: number, code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
  return json(req, { error: { code, message, ...extra } }, { status });
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Client-IP hinter Vercel/Proxies – nie geloggt, nur gehasht für das Rate-Limit. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
