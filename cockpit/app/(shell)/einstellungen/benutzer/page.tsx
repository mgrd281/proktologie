import { headers } from "next/headers";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { auth } from "@/lib/auth/auth";
import { listOpenInvites } from "@/lib/auth/invites";
import { UsersManager, type UserRow } from "@/components/settings/UsersManager";

export const metadata = { title: "Benutzer" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ einladen?: string }> }) {
  const actor = await requireActorOrRedirect();
  const sp = await searchParams;
  let users: UserRow[] = [];
  if (actor.role === "admin") {
    const r = await auth.api.listUsers({ query: { limit: 200, sortBy: "createdAt" }, headers: await headers() });
    users = r.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: ((u as { role?: string }).role ?? "empfang") as UserRow["role"],
      banned: Boolean((u as { banned?: boolean }).banned),
      twoFactor: Boolean((u as { twoFactorEnabled?: boolean }).twoFactorEnabled),
      createdAt: new Date(u.createdAt).toISOString(),
    }));
  }
  const invites = actor.role === "admin" ? await listOpenInvites() : [];
  return (
    <UsersManager
      me={actor.id}
      isAdmin={actor.role === "admin"}
      users={users}
      invites={invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
      openInvite={sp.einladen === "1"}
    />
  );
}
