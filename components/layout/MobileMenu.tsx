"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { OpenStatus } from "@/components/ui/OpenStatus";
import { ctaHref, ctaLabel, navigation } from "@/content/navigation";
import { opensBooking } from "@/lib/booking/openers";
import { site } from "@/content/site";
import { useEffect, useRef } from "react";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  /** Gerade gelesener Abschnitt der Startseite (Header) – im Menü markiert. */
  activeSection?: string | null;
}

/**
 * Vollflächiges Mobilmenü in Deep Green.
 * Fokus-Falle, Esc schließt, Fokus kehrt zum Auslöser zurück (im Header).
 * Termin und Telefon stehen oben – auch auf kleinen Handys ohne Scrollen
 * erreichbar. Das Menü scrollt selbst (`data-lenis-prevent`): Lenis ist
 * bei offenem Menü gestoppt und würde Rad und Wischen sonst verschlucken.
 */
export function MobileMenu({ open, onClose, activeSection = null }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Fokus außerhalb des Panels (z. B. auf <body> nach Tap ins Leere):
      // zurück in den Dialog holen statt hinter das Overlay zu tabben
      if (!(active instanceof Node) || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menü"
      data-lenis-prevent
      className="on-dark animate-menu-in fixed inset-0 z-60 flex flex-col overflow-y-auto overscroll-contain bg-deep px-6 py-5"
    >
      <div className="flex items-center justify-between">
        <LogoLockup onDark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Menü schließen"
          className="flex size-11 items-center justify-center rounded-full border border-white/20 text-cream"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        <Button href={ctaHref} {...opensBooking()} onClick={onClose} withArrow className="w-full">
          {ctaLabel}
        </Button>
        <Button href={site.phoneHref} variant="outline-dark" className="w-full">
          <Icon name="phone" size={18} />
          <span>
            <span className="sr-only">Oder rufen Sie uns an: </span>
            {site.phone}
          </span>
        </Button>
        <OpenStatus onDark className="justify-center" />
      </div>

      <nav aria-label="Hauptnavigation" className="mt-8 flex-1 border-t border-white/10 pt-5 pb-4">
        <ul className="space-y-1">
          {navigation.map((item, index) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={onClose}
                aria-current={item.href === `/#${activeSection}` ? "location" : undefined}
                className="group flex min-h-12 items-baseline gap-4 py-2"
              >
                <span className="text-xs font-medium text-accent/70 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-2xl font-medium text-cream transition-colors group-hover:text-accent group-aria-[current]:text-accent">
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
