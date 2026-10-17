import type { ReactNode } from "react";
import { after } from "next/server";
import { requireActorOrRedirect } from "@/lib/auth/actor";
import { ABSOLUTE_SECONDS } from "@/lib/auth/auth";
import { countDemo, countWaitlistOpen } from "@/lib/booking/repo";
import { countOpenRequests } from "@/lib/booking/requests";
import { maybeTick } from "@/lib/jobs/tick";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const actor = await requireActorOrRedirect();
  const [demoCount, requests, waitlist] = await Promise.all([countDemo(), countOpenRequests(), countWaitlistOpen()]);
  // Sicherheitsnetz der Automatik: nach der Antwort, gedrosselt auf alle 5 Minuten
  after(() => maybeTick());
  return (
    <AppShell user={{ name: actor.name, email: actor.email, role: actor.role }} demoCount={demoCount} counts={{ requests, waitlist }} absoluteSeconds={ABSOLUTE_SECONDS}>
      {children}
    </AppShell>
  );
}
