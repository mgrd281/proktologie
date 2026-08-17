"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { ctaHref, ctaLabel, navigation } from "@/content/navigation";
import { useLenis } from "@/providers/LenisProvider";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Fixer Header: über dem dunklen Hero transparent mit hellem Text,
 * danach deckend (Warm White + Blur) mit dunklem Text.
 * Auf Unterseiten (ohne #hero) immer deckend.
 */
export function Header() {
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const { stop, start } = useLenis();

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      setSolid(true);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const threshold = hero.offsetTop + hero.offsetHeight - 120;
      setSolid(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Body-Scroll bei geöffnetem Menü sperren
  useEffect(() => {
    if (menuOpen) {
      stop();
      document.documentElement.style.overflow = "hidden";
    } else {
      start();
      document.documentElement.style.overflow = "";
    }
    return () => {
      start();
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen, stop, start]);

  const closeMenu = () => {
    setMenuOpen(false);
    burgerRef.current?.focus();
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
          solid
            ? "border-b border-ink/8 bg-cream/90 backdrop-blur-md"
            : "on-dark border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 md:px-8">
          <Link href="/" aria-label="Proktologie Eimsbüttel – zur Startseite">
            <LogoLockup onDark={!solid} />
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden xl:block">
            <ul className="flex items-center gap-7">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={cn(
                      "group relative py-2 text-[13px] font-medium tracking-wide transition-colors",
                      solid
                        ? "text-ink/75 hover:text-ink"
                        : "text-cream/80 hover:text-white",
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100",
                        solid ? "bg-primary" : "bg-accent",
                      )}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden md:block">
              <Button
                href={ctaHref}
                withArrow
                className="!min-h-0 !px-5 !py-2.5 !text-[13px]"
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

      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </>
  );
}
