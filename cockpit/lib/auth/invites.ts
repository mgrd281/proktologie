import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { audit } from "../audit.ts";
import { getDb } from "../db/client.ts";
import { invites, user as userTable } from "../db/schema.ts";
import { COCKPIT_URL, ROLES, auth, type Role } from "./auth.ts";

/**
 * Konten entstehen NUR über Einladungen. Der Einladende erhält einen Link,
 * dessen Token im URL-Fragment steht (#…): Es erreicht weder Server-Logs
 * noch Referrer. Gespeichert wird nur der SHA-256 des Tokens.
 * Es werden keine Namen vorgegeben – die eingeladene Person trägt ihren
 * eigenen Namen bei der Annahme ein.
 */
export const INVITE_TTL_HOURS = 72;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvite(input: { email: string; role: Role; actorId: string }) {
  if (!ROLES.includes(input.role)) throw new Error("Unbekannte Rolle");
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email));
  if (existing) throw new Error("Für diese E-Mail-Adresse existiert bereits ein Konto.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
  const [row] = await db
    .insert(invites)
    .values({ email, role: input.role, tokenHash: hashToken(token), invitedBy: input.actorId, expiresAt })
    .returning({ id: invites.id });
  await audit({ actorId: input.actorId, action: "invite.create", entity: "invite", entityId: row!.id, meta: { role: input.role } });
  return { id: row!.id, link: `${COCKPIT_URL}/einladung#${token}`, expiresAt };
}

export async function listOpenInvites() {
  const db = await getDb();
  return db
    .select({ id: invites.id, email: invites.email, role: invites.role, expiresAt: invites.expiresAt, createdAt: invites.createdAt })
    .from(invites)
    .where(and(isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .orderBy(invites.createdAt);
}

export async function revokeInvite(id: string, actorId: string) {
  const db = await getDb();
  await db.delete(invites).where(and(eq(invites.id, id), isNull(invites.acceptedAt)));
  await audit({ actorId, action: "invite.revoke", entity: "invite", entityId: id });
}

export async function peekInvite(token: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: invites.id, email: invites.email, role: invites.role })
    .from(invites)
    .where(and(eq(invites.tokenHash, hashToken(token)), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())));
  return row ?? null;
}

/**
 * Annahme: Konto anlegen (Admin-Plugin, serverseitig – öffentlicher Sign-up
 * bleibt aus), Einladung als angenommen markieren, Sitzung starten.
 */
export async function acceptInvite(input: { token: string; name: string; password: string; headers: Headers }) {
  const inv = await peekInvite(input.token);
  if (!inv) throw new Error("Diese Einladung ist ungültig oder abgelaufen.");
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Bitte den vollständigen Namen eingeben.");
  if (input.password.length < 12) throw new Error("Das Passwort braucht mindestens 12 Zeichen.");

  await auth.api.createUser({
    body: { email: inv.email, password: input.password, name, role: inv.role as "admin" },
  });
  const db = await getDb();
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inv.id));
  await audit({ action: "invite.accept", entity: "invite", entityId: inv.id, meta: { role: inv.role } });

  await auth.api.signInEmail({
    body: { email: inv.email, password: input.password },
    headers: input.headers,
  });
}
