import { eq } from "drizzle-orm";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { verifyChain } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { passkey as passkeyTable } from "@/lib/db/schema";
import { SecurityPanel } from "@/components/settings/SecurityPanel";

export const metadata = { title: "Sicherheit" };

export default async function SecurityPage() {
  const actor = await requireActorOrRedirect();
  const db = await getDb();
  const passkeys = await db
    .select({ id: passkeyTable.id, name: passkeyTable.name, createdAt: passkeyTable.createdAt, deviceType: passkeyTable.deviceType, backedUp: passkeyTable.backedUp })
    .from(passkeyTable)
    .where(eq(passkeyTable.userId, actor.id));
  const chain = actor.role === "admin" ? await verifyChain() : null;
  return (
    <SecurityPanel
      passkeys={passkeys.map((p) => ({ ...p, createdAt: p.createdAt?.toISOString() ?? null }))}
      twoFactor={actor.twoFactorEnabled}
      sessionStartedAt={actor.sessionCreatedAt.toISOString()}
      chain={chain}
      name={actor.name}
    />
  );
}
