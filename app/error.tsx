"use client";

import { useEffect } from "react";
import { CinemaStatic } from "@/components/cinema/CinemaStatic";

/**
 * Fehlerauffangstelle der Seiten. Ohne sie ließ ein einziger Fehler im
 * Browser zehn Bildschirmhöhen mit einem starren Bild und ohne Text
 * zurück. Jetzt steht die ruhige, vollständige Fassung da.
 */
export default function Error({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[seite] Fehler abgefangen, ruhige Fassung gezeigt:", error);
  }, [error]);
  return <CinemaStatic />;
}
