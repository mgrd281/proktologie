"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { ctaHref, ctaLabel, navigation } from "@/content/navigation";
import { site } from "@/content/site";
import { useActiveSection } from "@/lib/hooks/useActiveSection";
import { useLenis } from "@/providers/LenisProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Fixer Header: über dem dunklen Hero transparent mit hellem Text,
 * danach deckend (Warm White + Blur) mit dunklem Text.
 * Auf Unterseiten (ohne #hero) immer deckend – schon im ausgelieferten
 * HTML, nicht erst, wenn das Script läuft.
 */
/** Abschnitte, die die Navigation markiert („Team“ liegt in der Kamerafahrt und zählt nicht). */
const SECTION_IDS = navigation.map((item) => item.href.split("#")[1] ?? "").filter((id) => id && id !== "team");

export function Header() {
  const pathname = usePathname();
  const [solid, setSolid] = useState(pathname !== "/");
  const [menuOpen, setMenuOpen] = useState(false);
  // Wo bin ich? Der gelesene Abschnitt ist in der Navigation markiert.
  const activeSection = useActiveSection(SECTION_IDS);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);
  const { stop, start } = useLenis();

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      setSolid(true);
      return;
    }

    /*
     * Die Kamerafahrt ist 1000vh lang (Handy: 500vh) und wird in ihrem letzten Drittel hell
     * (Empfangsraum). Erst am Ende der Sektion umzuschalten hieße: heller
     * Text auf hellem Grund. Die Fahrt hinterlegt deshalb am Track den
     * Fortschritt, ab dem der Header deckend sein soll. Ohne Fahrt
     * (reduzierte Bewegung) folgen auf den dunklen Eröffnungsblock helle
     * Abschnitte – dort zählt das Ende dieses Blocks (`data-header-dark`),
     * nicht das Ende der ganzen Sektion.
     */
    let threshold = 0;
    const measure = () => {
      const cinema = hero.querySelector<HTMLElement>("[data-header-solid]");
      const at = Number(cinema?.dataset.headerSolid);
      const dark = hero.querySelector<HTMLElement>("[data-header-dark]");
      if (cinema && cinema.offsetHeight > 0 && Number.isFinite(at)) {
        const top = cinema.getBoundingClientRect().top + window.scrollY;
        threshold = top + at * Math.max(1, cinema.offsetHeight - window.innerHeight);
      } else if (dark && dark.offsetHeight > 0) {
        const bottom = dark.getBoundingClientRect().bottom + window.scrollY;
        threshold = bottom - (headerRef.current?.offsetHeight ?? 80);
      } else {
        threshold = hero.offsetTop + hero.offsetHeight - 120;
      }
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      setSolid(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    update();
    // Wechsel der Systemeinstellung tauscht Fahrt und ruhige Fassung
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    reduced.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", onResize);
      cancelAnimationFrame(raf);
    };
    // Bei Routenwechsel neu auswerten (Header bleibt über Navigationen gemountet)
  }, [pathname]);

  // Geöffnetes Menü: Scroll sperren und Hintergrund inert schalten
  useEffect(() => {
    const background = [
      headerRef.current,
      document.getElementById("main"),
      document.getElementById("site-footer"),
      // Der Chat schwebt über der Seite; bei offenem Menü darf er weder
      // angeklickt noch mit der Tabulatortaste erreicht werden.
      document.getElementById("site-chat"),
    ].filter((el): el is HTMLElement => el !== null);

    if (menuOpen) {
      wasOpenRef.current = true;
      stop();
      document.documentElement.style.overflow = "hidden";
      background.forEach((el) => (el.inert = true));
    } else {
      start();
      document.documentElement.style.overflow = "";
      background.forEach((el) => (el.inert = false));
      // Fokus zurück zum Auslöser – erst NACH Aufheben von inert möglich
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        burgerRef.current?.focus();
      }
    }
    return () => {
      start();
      document.documentElement.style.overflow = "";
      background.forEach((el) => (el.inert = false));
    };
  }, [menuOpen, stop, start]);

  const closeMenu = () => {
    // Lenis sofort wieder starten, damit ein Anker-Klick im selben
    // Event-Durchlauf nicht von einem gestoppten Lenis verschluckt wird
    start();
    setMenuOpen(false);
  };

  return (
    <>
      {/*
        * Ohne JavaScript wird der Header nie deckend. Auf der Startseite
        * scrollt er deshalb mit dem dunklen Eröffnungsblock weg, statt mit
        * heller Schrift über den hellen Abschnitten stehen zu bleiben.
        */}
      <noscript>
        <style>{`#site-header[data-solid="false"]{position:absolute}`}</style>
      </noscript>
      <header
        ref={headerRef}
        id="site-header"
        data-solid={solid}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
          solid
            ? "border-b border-ink/8 bg-cream/97 backdrop-blur-md md:bg-cream/90"
            : "on-dark border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-20 md:px-8">
          <Link href="/" aria-label="Proktologie Eimsbüttel – zur Startseite" className="max-md:flex max-md:min-h-11 max-md:items-center">
            <LogoLockup onDark={!solid} />
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden xl:block">
            <ul className="flex items-center gap-7">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={item.href === `/#${activeSection}` ? "location" : undefined}
                    className={cn(
                      "group relative py-2 text-[13px] font-medium tracking-wide transition-colors",
                      solid
                        ? "text-ink/75 hover:text-ink aria-[current]:text-ink"
                        : "text-cream/80 hover:text-white aria-[current]:text-white",
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 group-aria-[current]:scale-x-100",
                        solid ? "bg-primary" : "bg-accent",
                      )}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            {/* Ab Tablet steht das Telefon in Reichweite – auf dem Handy übernimmt
                die Leiste unten. Neben der vollen Navigation (ab xl) ist nur Platz für
                das Symbol; die Nummer steht dann im Tooltip und für Screenreader. */}
            <a
              href={site.phoneHref}
              title={site.phone}
              className={cn(
                "hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-[13px] font-medium tracking-wide whitespace-nowrap transition-colors md:inline-flex",
                solid ? "text-ink/80 hover:text-primary-deep" : "text-cream/85 hover:text-white",
              )}
            >
              <Icon name="phone" size={16} className={solid ? "text-primary" : "text-accent"} />
              <span className="xl:sr-only">
                <span className="sr-only">Anrufen: </span>
                {site.phone}
              </span>
            </a>
            <span className="hidden md:block">
              <Button
                href={ctaHref}
                withArrow
                className="!px-5 !py-2.5 !text-[13px]"
              >
                {ctaLabel}
              </Button>
            </span>
            <button
              ref={burgerRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menü öffnen"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={cn(
                "flex size-11 items-center justify-center rounded-full border transition-colors xl:hidden",
                solid ? "border-ink/15 text-ink" : "border-white/25 text-cream",
              )}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={closeMenu} activeSection={activeSection} />
    </>
  );
}
