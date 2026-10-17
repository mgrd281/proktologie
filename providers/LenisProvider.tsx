"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface LenisContextValue {
  /** Aktuelle Lenis-Instanz (null bei Reduced Motion oder vor dem Mount). */
  getLenis: () => Lenis | null;
  /**
   * Smooth-Scroll zu einem Ziel; fällt ohne Lenis auf natives Scrollen zurück.
   * Elemente landen unter dem festen Header: Den Abstand liefert
   * `scroll-padding-top` (app/globals.css), Lenis rechnet ihn selbst ein.
   * `offset`: zusätzlicher Abstand; `immediate`: springen statt fahren.
   */
  scrollTo: (target: number | string | HTMLElement, offset?: number, immediate?: boolean) => void;
  /** Scrollen sperren/freigeben (z. B. bei geöffnetem Mobilmenü). */
  stop: () => void;
  start: () => void;
}

const LenisContext = createContext<LenisContextValue | null>(null);

export function useLenis(): LenisContextValue {
  const ctx = useContext(LenisContext);
  if (!ctx) throw new Error("useLenis must be used within LenisProvider");
  return ctx;
}

export default function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  // Das gewichtete Scrollen gehört zur Kamerafahrt: nur auf der Startseite.
  // Impressum, Datenschutz & Co. scrollen nativ (scrollTo fällt darauf zurück).
  const home = usePathname() === "/";

  useEffect(() => {
    if (!home) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const create = () => {
      if (lenisRef.current || reduced.matches) return;
      // Lenis respektiert prefers-reduced-motion nicht selbst –
      // bei Reduced Motion wird es gar nicht erst instanziiert.
      const lenis = new Lenis({
        autoRaf: true,
        anchors: false,
        /*
         * Gewichtetes, nachlaufendes Scrollen: Das Rad setzt ein Ziel,
         * Lenis fährt es über 1,2 s mit exponentiellem Ausklang an. Die
         * Kamerafahrt (components/cinema) legt darüber noch eine eigene
         * Interpolation – zusammen ergibt das die schwere, ruhige Bewegung.
         */
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
      });
      lenisRef.current = lenis;
    };
    const destroy = () => {
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };

    create();
    const onChange = () => (reduced.matches ? destroy() : create());
    reduced.addEventListener("change", onChange);
    return () => {
      reduced.removeEventListener("change", onChange);
      destroy();
    };
  }, [home]);

  const value = useRef<LenisContextValue>({
    getLenis: () => lenisRef.current,
    scrollTo: (target, offset = 0, immediate = false) => {
      const lenis = lenisRef.current;
      if (lenis) {
        // force: sonst verwirft Lenis den Aufruf, solange es gestoppt ist
        // (z. B. im selben Klick, der das Mobilmenü gerade schließt)
        lenis.scrollTo(target, { offset, force: true, immediate });
        return;
      }
      // Fallback ohne Lenis (u. a. Reduced Motion): natives Springen
      const el =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : target instanceof HTMLElement
            ? target
            : null;
      if (el) {
        // Wie Lenis: Abstand unter dem Header aus scroll-padding-top
        const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const top = el.getBoundingClientRect().top + window.scrollY - padding + offset;
        window.scrollTo({ top, behavior: "auto" });
      } else if (typeof target === "number") {
        window.scrollTo({ top: target, behavior: "auto" });
      }
    },
    stop: () => lenisRef.current?.stop(),
    start: () => lenisRef.current?.start(),
  }).current;

  /*
   * Anker-Links (/#sektion) auf der Startseite: nahe Ziele sanft anfahren,
   * weite (mehr als zwei Bildschirmhöhen, etwa über die Kamerafahrt) sofort
   * anspringen. Eine Fahrt über zehn Bildschirmhöhen Film dauerte, erklärte
   * nichts und lud dabei Hunderte Filmbilder.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement).closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const match = href.match(/^\/?#([\w-]+)$/);
      if (!match) return;
      if (window.location.pathname !== "/" && !href.startsWith("#")) return;
      const el = document.getElementById(match[1]);
      if (!el) return;
      event.preventDefault();
      const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 2;
      value.scrollTo(el, 0, far);
      window.history.pushState(null, "", `#${match[1]}`);
      // Fokus mitnehmen (wie bei nativer Anker-Navigation) – wichtig für
      // Tastatur-Nutzer, insbesondere den Skip-Link (WCAG 2.4.1)
      if (!/^(a|button|input|select|textarea)$/i.test(el.tagName)) {
        el.tabIndex = -1;
      }
      el.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [value]);

  return <LenisContext.Provider value={value}>{children}</LenisContext.Provider>;
}
