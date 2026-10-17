"use client";

import { cn } from "@/lib/cn";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

interface RevealProps {
  children: ReactNode;
  /** Verzögerung in ms für gestaffelte Einblendungen */
  delay?: number;
  /**
   * Karte einer Wischreihe: auf dem Handy sofort sichtbar. Seitlich
   * liegende Karten kämen sonst erst beim Wischen leer herein und blendeten
   * dann verspätet ein.
   */
  swipe?: boolean;
  className?: string;
}

/**
 * Sanfte Einblendung beim Scrollen (IntersectionObserver, einmalig).
 * Ohne JS oder bei Reduced Motion bleibt der Inhalt schlicht sichtbar –
 * die Ausblendung passiert erst clientseitig nach dem Mount.
 */
export function Reveal({ children, delay = 0, swipe = false, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (swipe && window.matchMedia("(max-width: 47.99rem)").matches) return;
    // Bereits im Viewport liegende Inhalte nicht erst verstecken
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [swipe]);

  return (
    <div
      ref={ref}
      className={cn(
        state === "hidden" && "reveal-init",
        state === "shown" && "reveal-init reveal-in",
        className,
      )}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
