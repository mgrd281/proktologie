"use server";

import { and, eq, like } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { ActorError, requireActor } from "@/lib/auth/actor";
import { auth, ROLES } from "@/lib/auth/auth";
import { acceptInvite, createInvite, revokeInvite } from "@/lib/auth/invites";
import { getDb } from "@/lib/db/client";
import { passkey, twoFactor, user, verification } from "@/lib/db/schema";
import type { ActionResult } from "./appointments";

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActorError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Unbekannter Fehler" };
  }
}

const inviteSchema = z.object({
  email: z.string().trim().email("E-Mail ungültig"),
  role: z.enum(ROLES),
});

export async function createInviteAction(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["admin"], fresh: true });
    const v = inviteSchema.parse(input);
    const r = await createInvite({ email: v.email, role: v.role, actorId: actor.id });
    revalidatePath("/einstellungen/benutzer");
    return { link: r.link, expiresAt: r.expiresAt.toISOString() };
  });
}

export async function revokeInviteAction(id: string): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["admin"] });
    await revokeInvite(z.string().min(1).parse(id), actor.id);
    revalidatePath("/einstellungen/benutzer");
    return null;
  });
}

const acceptSchema = z.object({
  token: z.string().min(20),
  name: z.string().trim().min(2, "Bitte den vollständigen Namen eingeben").max(120),
  password: z.string().min(12, "Mindestens 12 Zeichen").max(256),
});

/** Öffentlich (kein Actor): Einladung annehmen und Sitzung starten. */
export async function acceptInviteAction(input: z.input<typeof acceptSchema>): Promise<ActionResult<null>> {
  return guard(async () => {
    const v = acceptSchema.parse(input);
    await acceptInvite({ ...v, headers: await headers() });
    return null;
  });
}

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(ROLES) });

export async function setRoleAction(input: z.input<typeof roleSchema>): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["admin"], fresh: true });
    const v = roleSchema.parse(input);
    if (v.userId === actor.id) throw new Error("Die eigene Rolle lässt sich nicht ändern.");
    await auth.api.setRole({ body: { userId: v.userId, role: v.role as "admin" }, headers: await headers() });
    await audit({ actorId: actor.id, action: "user.role", entity: "user", entityId: v.userId, meta: { role: v.role } });
    revalidatePath("/einstellungen/benutzer");
    return null;
  });
}

const banSchema = z.object({ userId: z.string().min(1), disabled: z.boolean() });

export async function setDisabledAction(input: z.input<typeof banSchema>): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["admin"], fresh: true });
    const v = banSchema.parse(input);
    if (v.userId === actor.id) throw new Error("Das eigene Konto lässt sich nicht deaktivieren.");
    const h = await headers();
    if (v.disabled) {
      await auth.api.banUser({ body: { userId: v.userId, banReason: "Deaktiviert durch Administration" }, headers: h });
      await auth.api.revokeUserSessions({ body: { userId: v.userId }, headers: h });
    } else {
      await auth.api.unbanUser({ body: { userId: v.userId }, headers: h });
    }
    await audit({ actorId: actor.id, action: v.disabled ? "user.disable" : "user.enable", entity: "user", entityId: v.userId });
    revalidatePath("/einstellungen/benutzer");
    return null;
  });
}

const resetSchema = z.object({ userId: z.string().min(1) });

/**
 * Zugang verloren (Handy weg, Gerät defekt): Passkeys, Authenticator-App und
 * „vertraute Geräte“ der Person entfernen und alle ihre Sitzungen beenden.
 * Das Passwort bleibt; bei der nächsten Anmeldung verlangt das Cockpit die
 * Einrichtung neu (lib/auth/actor.ts, securityComplete).
 */
export async function resetSecurityAction(input: z.input<typeof resetSchema>): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["admin"], fresh: true });
    const v = resetSchema.parse(input);
    if (v.userId === actor.id) throw new Error("Die eigene Sicherheit verwalten Sie unter Einstellungen → Sicherheit.");
    const db = await getDb();
    const removed = await db.transaction(async (tx) => {
      const [target] = await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, v.userId)).returning({ id: user.id });
      if (!target) throw new Error("Dieses Konto gibt es nicht mehr.");
      const keys = await tx.delete(passkey).where(eq(passkey.userId, v.userId)).returning({ id: passkey.id });
      const app = await tx.delete(twoFactor).where(eq(twoFactor.userId, v.userId)).returning({ id: twoFactor.id });
      // Better Auth merkt sich vertraute Geräte als „trust-device-…“ mit der Konto-ID – sonst übersprängen sie später den Code
      const trusted = await tx
        .delete(verification)
        .where(and(eq(verification.value, v.userId), like(verification.identifier, "trust-device-%")))
        .returning({ id: verification.id });
      return { passkeys: keys.length, authenticator: app.length > 0, trustedDevices: trusted.length };
    });
    await auth.api.revokeUserSessions({ body: { userId: v.userId }, headers: await headers() });
    await audit({ actorId: actor.id, action: "user.security_reset", entity: "user", entityId: v.userId, meta: removed });
    revalidatePath("/einstellungen/benutzer");
    return null;
  });
}
