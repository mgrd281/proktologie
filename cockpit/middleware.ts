import { NextResponse, type NextRequest } from "next/server";

/**
 * Grobfilter am Rand: ohne Sitzungs-Cookie geht es nicht ins Cockpit.
 * Die eigentliche Prüfung (Gültigkeit, Rolle, absolute Sitzungsdauer,
 * Sicherheits-Einrichtung) macht lib/auth/actor.ts auf dem Server –
 * Middleware sieht bewusst keine Datenbank.
 */
// /api/internal sichert sich selbst über Geheimnisse (CRON_SECRET, E2E_SECRET)
const PUBLIC_PREFIXES = ["/login", "/einladung", "/api/auth", "/api/public", "/api/internal", "/t", "/_next", "/favicon", "/icon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Cookie-Namen von Better Auth (cookiePrefix "cockpit", mit/ohne __Secure-)
  const cookie = request.cookies.get("cockpit.session_token") ?? request.cookies.get("__Secure-cockpit.session_token");
  if (!cookie?.value) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("weiter", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
