"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Bits";

/**
 * Fehler auf einer Seite des Cockpits: ehrlich sagen, „Erneut versuchen“
 * anbieten (lädt nur diesen Teil neu, Seitenleiste und Eingaben anderswo
 * bleiben), sonst zurück zu „Heute“. Technische Details stehen im Server-
 * Protokoll (digest), nicht auf dem Bildschirm.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[cockpit] Fehler abgefangen:", error.digest ?? error.message);
  }, [error]);
  return (
    <div role="alert" className="rounded-2xl bg-surface-raised ring-1 ring-line">
      <EmptyState
        icon="alert"
        title="Hier ist etwas schiefgelaufen."
        text="Die Seite konnte gerade nicht geladen werden – meist hilft ein neuer Versuch. Gespeichertes ist nicht verloren."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon="refresh" onClick={() => retry()}>
              Erneut versuchen
            </Button>
            <Button variant="secondary" href="/">
              Zu „Heute“
            </Button>
          </div>
        }
      />
    </div>
  );
}
