"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Höchstens alle 90 Sekunden neu laden. */
const EVERY_MS = 90_000;
/** Nur, solange in diesen 3 Minuten jemand am Gerät war. */
const PRESENT_MS = 3 * 60_000;
/** Beim Zurückkehren zum Tab, wenn der letzte Stand älter ist als 15 Sekunden. */
const STALE_MS = 15_000;
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * Immer aktuell: Was Website, Chat und Kolleg:innen inzwischen gebucht oder
 * geschickt haben, steht ohne Neuladen da. Neu geladen wird nur, wenn der
 * Tab sichtbar ist, keine Ebene (Drawer, Dialog) offen ist und niemand
 * gerade in ein Feld tippt; die Einstellungen bleiben außen vor.
 *
 * Und nur, solange jemand am Gerät ist: Jedes Neuladen zählt als Aktion und
 * verlängert die Anmeldung (60 Minuten Ruhe, lib/auth/auth.ts). Ein
 * unbeaufsichtigter Praxis-PC soll sich trotzdem abmelden. Wer nach einer
 * Pause wieder Maus oder Tastatur benutzt, sieht sofort den neuen Stand.
 */
export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/einstellungen")) return;
    let lastRefresh = Date.now();
    let lastActivity = Date.now();
    const calm = () => {
      if (document.visibilityState !== "visible") return false;
      if (document.getElementById("cockpit-shell")?.inert) return false;
      const active = document.activeElement as HTMLElement | null;
      return !(active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable));
    };
    const refresh = () => {
      if (!calm()) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const onActivity = () => {
      const now = Date.now();
      // Zurück nach einer Pause: gleich den aktuellen Stand holen
      if (now - lastActivity > EVERY_MS && now - lastRefresh > EVERY_MS) refresh();
      lastActivity = now;
    };
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity < PRESENT_MS) refresh();
    }, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      lastActivity = Date.now();
      if (Date.now() - lastRefresh > STALE_MS) refresh();
    };
    for (const type of ACTIVITY) window.addEventListener(type, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  return null;
}
