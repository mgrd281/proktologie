import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { createInvite } from "@/lib/auth/invites";
import { getDb } from "@/lib/db/client";
import { user as userTable } from "@/lib/db/schema";

/**
 * Test-Einstieg für die Browser-Suite – existiert NUR, wenn E2E_SECRET
 * gesetzt ist und die App nicht produktiv läuft. Legt den ersten
 * Administrator an (falls keiner existiert) und erzeugt eine Einladung.
 * In Produktion antwortet die Route mit 404.
 */
export async function POST(req: Request) {
  const secret = process.env.E2E_SECRET;
  if (!secret || process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as { secret?: string; inviteEmail?: string; role?: "arzt" | "empfang" | "admin" } | null;
  if (body?.secret !== secret) return new NextResponse(null, { status: 404 });

  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(userTable);
  const n = row?.n ?? 0;
  const adminEmail = "admin@example.invalid";
  const adminPassword = "E2E-Admin-Passwort-2026!";
  let adminId: string | null = null;
  if (n === 0) {
    const created = await auth.api.createUser({ body: { email: adminEmail, password: adminPassword, name: "E2E Administration", role: "admin" } });
    adminId = created.user.id;
  }
  const invite = await createInvite({ email: body.inviteEmail ?? "empfang@example.invalid", role: body.role ?? "empfang", actorId: adminId ?? "e2e" });
  return NextResponse.json({ adminEmail, adminPassword, inviteLink: invite.link });
}
