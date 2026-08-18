import { HeroCinematic } from "@/components/hero/HeroCinematic";
import { HeroStatic } from "@/components/hero/HeroStatic";

/**
 * Hero-Weiche – rein per CSS, ohne Hydration-Sprünge oder Layout-Shifts:
 * – Desktop (ab lg) mit erlaubter Bewegung: cinematische Scroll-Erzählung
 * – Mobile/Tablet ODER prefers-reduced-motion: statische Variante
 * – ohne JavaScript: immer die statische Variante (noscript-Override)
 */
export function Hero() {
  return (
    <section id="hero" aria-label="Einführung">
      <noscript>
        <style>{`.hero-cinematic{display:none !important}.hero-static-wrap{display:block !important}`}</style>
      </noscript>
      <div className="hero-cinematic hidden motion-safe:lg:block">
        <HeroCinematic />
      </div>
      <div className="hero-static-wrap motion-safe:lg:hidden">
        <HeroStatic />
      </div>
    </section>
  );
}
