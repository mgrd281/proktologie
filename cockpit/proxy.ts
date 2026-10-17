import { NextResponse, type NextRequest } from "next/server";
import { RETURN_HEADER, returnPath } from "@/lib/auth/next";

/**
 * Grobfilter am Rand: ohne Sitzungs-Cookie geht es nicht ins Cockpit.
 * Die eigentliche Prüfung (Gültigkeit, Rolle, absolute Sitzungsdauer,
 * Sicherheits-Einrichtung) macht lib/auth/actor.ts auf dem Server –
 * Der Proxy sieht bewusst keine Datenbank.
 */
// /api/internal sichert sich selbst über Geheimnisse (CRON_SECRET, E2E_SECRET)
const PUBLIC_PREFIXES = ["/login", "/einladung", "/api/auth", "/api/public", "/api/internal", "/t", "/_next", "/favicon", "/icon"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  // Nach der Anmeldung zurück an genau diese Stelle – samt Tag, Ansicht, Termin
  const here = returnPath(pathname, search);
  // Cookie-Namen von Better Auth (cookiePrefix "cockpit", mit/ohne __Secure-)
  const cookie = request.cookies.get("cockpit.session_token") ?? request.cookies.get("__Secure-cockpit.session_token");
  if (!cookie?.value) {
    const login = new URL("/login", request.url);
    if (here !== "/") login.searchParams.set("weiter", here);
    return NextResponse.redirect(login);
  }
  // Merkt erst der Server, dass die Sitzung abgelaufen ist (lib/auth/actor.ts), braucht er dieselbe Adresse
  const headers = new Headers(request.headers);
  headers.set(RETURN_HEADER, here);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
