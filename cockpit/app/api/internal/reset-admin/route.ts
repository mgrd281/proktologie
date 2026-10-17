import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { bearerAuthorized } from "@/lib/api/bearer";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { account, session, user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * EINMALIG UND TEMPORÄR: Passwort des einzigen Administrators neu setzen,
 * weil es kein „Passwort vergessen" gibt und DATABASE_URL nur zur Laufzeit
 * der Vercel-Funktion lesbar ist. Diese Route wird direkt nach dem Gebrauch
 * wieder gelöscht.
 *
 * Aufruf: POST mit `Authorization: Bearer <MIGRATE_SECRET>`. Das neue Passwort
 * kommt aus RESET_ADMIN_PASSWORD (nie über die Anfrage). Läuft nur, wenn
 * genau EIN Administrator existiert.
 */
export async function POST(req: Request) {
  if (!bearerAuthorized(req, process.env.MIGRATE_SECRET)) return new NextResponse(null, { status: 404 });
  const password = process.env.RESET_ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    return NextResponse.json({ error: "RESET_ADMIN_PASSWORD fehlt oder ist kürzer als 16 Zeichen." }, { status: 400 });
  }
  try {
    const db = await getDb();
    const admins = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.role, "admin"));
    const admin = admins[0];
    if (admins.length !== 1 || !admin) {
      return NextResponse.json({ error: `Erwartet genau einen Administrator, gefunden: ${admins.length}.` }, { status: 409 });
    }
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    const updated = await db
      .update(account)
      .set({ password: hash })
      .where(and(eq(account.userId, admin.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (updated.length !== 1) {
      return NextResponse.json({ error: "Kein Passwort-Konto für den Administrator gefunden." }, { status: 409 });
    }
    await db.delete(session).where(eq(session.userId, admin.id));
    await audit({ action: "user.password_reset", entity: "user", entityId: admin.id, meta: { by: "operator-request" } });
    return NextResponse.json({ ok: true, email: admin.email });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…") }, { status: 500 });
  }
}
