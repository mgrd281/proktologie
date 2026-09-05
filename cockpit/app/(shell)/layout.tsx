import type { ReactNode } from "react";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { countDemo } from "@/lib/booking/repo";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const actor = await requireActorOrRedirect();
  const demoCount = await countDemo();
  return (
    <AppShell user={{ name: actor.name, email: actor.email, role: actor.role }} demoCount={demoCount}>
      {children}
    </AppShell>
  );
}
