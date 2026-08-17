"use client";

import { HeroCinematic } from "@/components/hero/HeroCinematic";
import { HeroStatic } from "@/components/hero/HeroStatic";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

/**
 * Hero-Weiche:
 * – Desktop (ab lg): cinematische Scroll-Erzählung
 * – Mobile/Tablet: statische Variante (per CSS umgeschaltet – kein
 *   Hydration-Mismatch, beide Varianten stehen im statischen HTML)
 * – prefers-reduced-motion: statische Variante auf allen Viewports
 */
export function Hero() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section id="hero" aria-label="Einführung">
      {reducedMotion ? (
        <HeroStatic />
      ) : (
        <>
          <div className="hidden lg:block">
            <HeroCinematic />
          </div>
          <div className="lg:hidden">
            <HeroStatic />
          </div>
        </>
      )}
    </section>
  );
}
