"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Alle 90 Sekunden – und beim Zurückkehren zum Tab, wenn der letzte Stand älter ist als 15 Sekunden. */
const EVERY_MS = 90_000;
const STALE_MS = 15_000;

/**
 * Immer aktuell: Was Website, Chat und Kolleg:innen inzwischen gebucht oder
 * geschickt haben, steht ohne Neuladen da. Neu geladen wird nur, wenn der
 * Tab sichtbar ist, keine Ebene (Drawer, Dialog) offen ist und niemand
 * gerade in ein Feld tippt; die Einstellungen bleiben außen vor.
 *
 * Das Neuladen verlängert die Anmeldung nicht: Seitenaufrufe lesen die
 * Sitzung ohne Auffrischen (lib/auth/actor.ts), nur echte Aktionen
 * verlängern sie – ein unbeaufsichtigter PC meldet sich weiter nach
 * 60 Minuten ab.
 */
export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/einstellungen")) return;
    let last = Date.now();
    const calm = () => {
      if (document.visibilityState !== "visible") return false;
      if (document.getElementById("cockpit-shell")?.inert) return false;
      const active = document.activeElement as HTMLElement | null;
      return !(active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable));
    };
    const refresh = () => {
      if (!calm()) return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > STALE_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  return null;
}
