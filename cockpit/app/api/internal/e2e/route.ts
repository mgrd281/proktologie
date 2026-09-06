import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { createInvite } from "@/lib/auth/invites";
import * as repo from "@/lib/booking/repo";
import { getDb } from "@/lib/db/client";
import { appointments, user as userTable } from "@/lib/db/schema";
import { runTick } from "@/lib/jobs/tick";

/**
 * Test-Einstieg für die Browser-Suite – existiert NUR, wenn E2E_SECRET
 * gesetzt ist und die App nicht produktiv läuft (sonst 404).
 * - ohne action: ersten Administrator anlegen (falls keiner) + Einladung
 * - "golive":       denselben Weg wie die Praxis gehen – erst Demo-Daten
 *                   löschen, dann über updateSettings live schalten (die
 *                   Sperre „kein Live-Betrieb mit Demo-Daten“ gilt also auch hier)
 * - "tick":         den Herzschlag synchron ausführen, Bericht zurück
 * - "state":        Jobs und Warteliste als Diagnose bei fehlgeschlagenen Erwartungen
 * - "expire-holds": alle laufenden Wartelisten-Reservierungen sofort ablaufen lassen
 */
type Body = {
  secret?: string;
  action?: "bootstrap" | "seed-demo" | "golive" | "tick" | "state" | "expire-holds";
  inviteEmail?: string;
  role?: "arzt" | "empfang" | "admin";
};

export async function POST(req: Request) {
  const secret = process.env.E2E_SECRET;
  if (!secret || process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  if (body?.secret !== secret) return new NextResponse(null, { status: 404 });

  const db = await getDb();

  if (body.action === "seed-demo") {
    const { seedDemo } = await import("@/lib/demo/seed");
    const r = await seedDemo("e2e");
    return NextResponse.json(r);
  }
  if (body.action === "golive") {
    // Erst der echte Weg: Solange Demo-Zeilen existieren, muss updateSettings ablehnen.
    let blocked = false;
    try {
      await repo.updateSettings({ bookingLive: true }, "e2e");
    } catch {
      blocked = true;
    }
    const removed = await repo.purgeDemo("e2e");
    await repo.updateSettings({ bookingLive: true, bookingPaused: false }, "e2e");
    return NextResponse.json({ ok: true, blockedWhileDemo: blocked, demoRemoved: removed });
  }
  if (body.action === "tick") {
    return NextResponse.json(await runTick());
  }
  if (body.action === "state") {
    // Diagnose für die Browser-Suite: Warum ist ein Job nicht gelaufen?
    // pg liefert { rows }, PGlite ein Array – beides auf eine Liste bringen.
    const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? []));
    const [jobRows, waitRows] = await Promise.all([
      db.execute(sql`select kind, attempts, (done_at is not null) as done, left(coalesce(last_error,''), 120) as err from jobs order by created_at`),
      db.execute(sql`select ref, status, type_id, (email_hash is not null) as has_mail, window_from, window_to from waitlist order by created_at`),
    ]);
    return NextResponse.json({ jobs: rowsOf(jobRows), waitlist: rowsOf(waitRows) });
  }
  if (body.action === "expire-holds") {
    const rows = await db
      .update(appointments)
      .set({ holdUntil: new Date(Date.now() - 60_000) })
      .where(and(isNotNull(appointments.holdUntil), eq(appointments.status, "booked")))
      .returning({ id: appointments.id });
    return NextResponse.json({ updated: rows.length });
  }

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
