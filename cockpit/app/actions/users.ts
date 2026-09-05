"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { ActorError, requireActor } from "@/lib/auth/actor";
import { auth, ROLES } from "@/lib/auth/auth";
import { acceptInvite, createInvite, revokeInvite } from "@/lib/auth/invites";
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
