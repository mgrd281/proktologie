"use client";

import { useCallback, useState } from "react";
import { STALE_MESSAGE, freshLoginHref } from "@/lib/auth/next";
import { Dialog } from "./Overlay";

/**
 * Ein gemeinsamer Knopf „Jetzt neu anmelden“ für alles, was eine Anmeldung
 * der letzten 10 Minuten verlangt (Benutzer, Demo-Daten löschen):
 * - `ensure` fragt vorher, statt ein ausgefülltes Formular scheitern zu lassen.
 *   Die Restzeit kommt vom Server, eine falsch gehende Uhr am Gerät stört nicht.
 * - `handled` fängt die Ablehnung des Servers ab und zeigt dieselbe Frage.
 * Nach der Anmeldung geht es an dieselbe Stelle zurück.
 */
export function useFreshLogin(freshLeftMs: number) {
  const [deadline] = useState(() => Date.now() + freshLeftMs);
  const [open, setOpen] = useState(false);

  const ensure = useCallback(
    (run: () => void) => {
      // Etwas Luft: Zwischen Klick und Server vergehen ein paar Sekunden
      if (Date.now() > deadline - 15_000) setOpen(true);
      else run();
    },
    [deadline],
  );
  const handled = useCallback((error: string) => {
    if (error !== STALE_MESSAGE) return false;
    setOpen(true);
    return true;
  }, []);

  const dialog = (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Bitte kurz neu anmelden"
      confirmLabel="Jetzt neu anmelden"
      onConfirm={() => window.location.assign(freshLoginHref(window.location.pathname + window.location.search))}
    >
      Zum Schutz von Konten und Daten geht das nur mit einer Anmeldung aus den letzten 10 Minuten. Danach kommen Sie hierher zurück.
    </Dialog>
  );

  return { ensure, handled, dialog };
}
