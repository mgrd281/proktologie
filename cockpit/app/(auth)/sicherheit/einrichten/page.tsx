import { redirect } from "next/navigation";
import { getActor, passkeyCount } from "@/lib/auth/actor";
import { SetupWizard } from "./SetupWizard";

export const metadata = { title: "Sicherheit einrichten" };

/**
 * Pflicht vor dem ersten Arbeiten: mindestens ein Passkey UND ein zweiter
 * Faktor (TOTP). Ohne beides bleibt jede Cockpit-Seite gesperrt
 * (lib/auth/actor.ts, requireActor).
 */
export default async function SetupPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const passkeys = await passkeyCount(actor.id);
  if (passkeys > 0 && actor.twoFactorEnabled) redirect("/");
  return <SetupWizard hasPasskey={passkeys > 0} hasTotp={actor.twoFactorEnabled} name={actor.name} />;
}
