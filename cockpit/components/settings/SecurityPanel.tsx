"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Card, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

interface PasskeyRow {
  id: string;
  name: string | null;
  createdAt: string | null;
  deviceType: string;
  backedUp: boolean;
}

export function SecurityPanel({ passkeys, twoFactor, sessionStartedAt, chain, name }: { passkeys: PasskeyRow[]; twoFactor: boolean; sessionStartedAt: string; chain: { length: number; broken: number[] } | null; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    const r = await authClient.passkey.addPasskey({ name: `${name} · ${new Date().toLocaleDateString("de-DE")}` });
    setBusy(false);
    if (r?.error) {
      toast({ title: "Passkey nicht angelegt", tone: "danger" });
      return;
    }
    toast({ title: "Passkey angelegt", tone: "ok" });
    router.refresh();
  };

  const remove = async (p: PasskeyRow) => {
    if (passkeys.length <= 1) {
      toast({ title: "Der letzte Passkey bleibt", description: "Erst einen weiteren anlegen, dann diesen entfernen.", tone: "warn" });
      return;
    }
    setBusy(true);
    const r = await authClient.passkey.deletePasskey({ id: p.id });
    setBusy(false);
    toast(r?.error ? { title: "Nicht entfernt", tone: "danger" } : { title: "Passkey entfernt", tone: "ok" });
    router.refresh();
  };

  const started = new Date(sessionStartedAt);
  const ageMin = Math.round((Date.now() - started.getTime()) / 60000);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Passkeys</Eyebrow>
            <p className="mt-1 text-[13px] text-text-muted">Phishing-sichere Anmeldung per Gerät. Ein Passkey je Gerät, das Sie nutzen.</p>
          </div>
          <Button size="sm" variant="secondary" icon="key" onClick={add} loading={busy}>Hinzufügen</Button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <Icon name="key" size={16} className="text-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{p.name ?? "Passkey"}</p>
                <p className="text-[12px] text-text-muted">
                  {p.deviceType === "multiDevice" ? "synchronisiert" : "an dieses Gerät gebunden"}
                  {p.createdAt ? ` · seit ${new Date(p.createdAt).toLocaleDateString("de-DE")}` : ""}
                </p>
              </div>
              <IconButton label="Passkey entfernen" icon="trash" size={32} onClick={() => remove(p)} disabled={busy} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Eyebrow>Zweiter Faktor</Eyebrow>
        <p className={`mt-3 flex items-center gap-2 text-[14px] font-medium ${twoFactor ? "text-ok" : "text-warn"}`}>
          <Icon name={twoFactor ? "shield" : "alert"} size={18} />
          {twoFactor ? "Authenticator-App ist aktiv" : "Noch nicht eingerichtet"}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">Wird bei der Passwort-Anmeldung verlangt; Passkeys gelten bereits als zwei Faktoren. Backup-Codes wurden bei der Einrichtung einmalig angezeigt.</p>
        <div className="mt-5 border-t border-line pt-4">
          <Eyebrow>Diese Sitzung</Eyebrow>
          <p className="tnum mt-2 text-[13px] text-text-muted">
            Angemeldet seit {started.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr ({ageMin} min). Nach 60 Minuten ohne Aktivität und spätestens nach 12 Stunden endet die Sitzung automatisch. Nutzerverwaltung und Löschungen verlangen eine Anmeldung, die jünger als 10 Minuten ist.
          </p>
        </div>
      </Card>

      {chain && (
        <Card className="lg:col-span-2">
          <Eyebrow>Audit-Log</Eyebrow>
          {chain.broken.length === 0 ? (
            <Notice tone="ok">
              <span className="tnum">{chain.length}</span> Einträge, Hash-Kette lückenlos. Die Datenbank verweigert jede Änderung oder Löschung im Protokoll.
            </Notice>
          ) : (
            <Notice tone="danger">Kette gebrochen an Position(en) {chain.broken.join(", ")} – bitte umgehend prüfen.</Notice>
          )}
        </Card>
      )}
    </div>
  );
}
