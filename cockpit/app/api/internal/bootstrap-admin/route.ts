import { timingSafeEqual } from "node:crypto";
import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Ersten Administrator anlegen – aus demselben Grund eine Route statt nur
 * eines Skripts wie `scripts/bootstrap-admin.ts`: DATABASE_URL ist ein
 * "sensitive" Vercel-Geheimnis (Neon-Integration) und existiert nur zur
 * Laufzeit der Vercel-Funktion, niemals lokal. Läuft nur, wenn noch KEIN
 * Konto existiert – ein zweiter Aufruf ist dauerhaft folgenlos.
 *
 * Aufruf: POST mit `Authorization: Bearer <BOOTSTRAP_ADMIN_SECRET>` – kein
 * Anfrage-Body, E-Mail und Passwort kommen bewusst aus der Umgebung
 * (BOOTSTRAP_ADMIN_EMAIL/_SECRET), damit sie nie über die Anfrage selbst
 * laufen. Danach beide Variablen aus Vercel entfernen.
 */
function authorized(req: Request): boolean {
  const secret = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse(null, { status: 404 });

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!email || !password || password.length < 12) {
    return NextResponse.json({ error: "BOOTSTRAP_ADMIN_EMAIL fehlt, oder das Passwort hat weniger als 12 Zeichen." }, { status: 400 });
  }

  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(user);
  if ((row?.n ?? 0) > 0) {
    return NextResponse.json({ error: "Es existieren bereits Konten – Bootstrap verweigert. Weitere Konten nur per Einladung." }, { status: 409 });
  }

  const created = await auth.api.createUser({ body: { email, password, name: "Administrator", role: "admin" } });
  await audit({ action: "user.bootstrap", entity: "user", entityId: created.user.id, meta: { role: "admin" } });
  return NextResponse.json({ ok: true, email });
}
