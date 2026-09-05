import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client.ts";
import { passkey as passkeyTable } from "../db/schema.ts";
import { ABSOLUTE_SECONDS, FRESH_SECONDS, ROLES, auth, type Role } from "./auth.ts";

/**
 * Der handelnde Mensch hinter einer Anfrage – Sitzung, Rolle, Frische.
 * Jede Server Action und jede Seite geht über diese Funktionen; nirgends
 * sonst wird eine Sitzung gelesen.
 */
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionId: string;
  sessionCreatedAt: Date;
  twoFactorEnabled: boolean;
}

export class ActorError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden" | "stale" | "setup",
    message: string,
  ) {
    super(message);
  }
}

function asRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "empfang";
}

export async function getActor(): Promise<Actor | null> {
  await getDb();
  const h = await headers();
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  const created = new Date(s.session.createdAt);
  // Absolute Obergrenze: nach 12 h ist Schluss, egal wie aktiv
  if (Date.now() - created.getTime() > ABSOLUTE_SECONDS * 1000) {
    await auth.api.signOut({ headers: h });
    return null;
  }
  return {
    id: s.user.id,
    email: s.user.email,
    name: s.user.name,
    role: asRole((s.user as { role?: string }).role),
    sessionId: s.session.id,
    sessionCreatedAt: created,
    twoFactorEnabled: Boolean((s.user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
  };
}

export async function passkeyCount(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(passkeyTable).where(eq(passkeyTable.userId, userId));
  return row?.n ?? 0;
}

/** Sicherheits-Einrichtung abgeschlossen: mindestens ein Passkey UND TOTP aktiv. */
export async function securityComplete(actor: Actor): Promise<boolean> {
  return actor.twoFactorEnabled && (await passkeyCount(actor.id)) > 0;
}

export function isFresh(actor: Actor): boolean {
  return Date.now() - actor.sessionCreatedAt.getTime() < FRESH_SECONDS * 1000;
}

interface Requirement {
  roles?: Role[];
  /** Schritt-hoch: Sitzung darf höchstens FRESH_SECONDS alt sein. */
  fresh?: boolean;
  /** Seiten der Einrichtung dürfen ohne abgeschlossene Einrichtung laden. */
  allowIncompleteSetup?: boolean;
}

/** Für Server Actions: wirft ActorError. */
export async function requireActor(req: Requirement = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new ActorError("unauthenticated", "Bitte anmelden.");
  if (!req.allowIncompleteSetup && !(await securityComplete(actor))) {
    throw new ActorError("setup", "Bitte zuerst die Sicherheits-Einrichtung abschließen.");
  }
  if (req.roles && !req.roles.includes(actor.role) && actor.role !== "admin") {
    throw new ActorError("forbidden", "Dafür fehlt die Berechtigung.");
  }
  if (req.fresh && !isFresh(actor)) {
    throw new ActorError("stale", "Bitte erneut anmelden, um diese Aktion auszuführen.");
  }
  return actor;
}

/** Für Seiten: leitet um statt zu werfen. */
export async function requireActorOrRedirect(req: Requirement = {}): Promise<Actor> {
  try {
    return await requireActor(req);
  } catch (e) {
    if (e instanceof ActorError) {
      if (e.code === "unauthenticated") redirect("/login");
      if (e.code === "setup") redirect("/sicherheit/einrichten");
      if (e.code === "forbidden") redirect("/?fehler=berechtigung");
      if (e.code === "stale") redirect("/login?grund=frisch");
    }
    throw e;
  }
}
