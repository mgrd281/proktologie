"use client";

import { useEffect } from "react";
import { NoticePage } from "@/components/layout/NoticePage";
import { Button } from "@/components/ui/Button";

/**
 * Fehlerauffangstelle der Seiten. Fehler in der Kamerafahrt fängt schon
 * deren eigene Grenze (CinemaBoundary) – hier landet nur, was die Seite
 * selbst nicht mehr tragen kann. Dann zählt: ehrlich sagen, neu laden
 * anbieten, das Telefon zeigen. Kopf und Fuß der Seite bleiben stehen.
 */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[seite] Fehler abgefangen:", error);
  }, [error]);
  return (
    <NoticePage title="Hier ist etwas schiefgelaufen.">
      {/* Bewusst ein voller Neuladevorgang: Häufigste Ursache ist ein
          veralteter Programmteil nach einer neuen Version. */}
      <Button type="button" onClick={() => window.location.reload()}>
        Seite neu laden
      </Button>
    </NoticePage>
  );
}
