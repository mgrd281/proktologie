"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { ctaHref, ctaLabel, navigation } from "@/content/navigation";
import { site } from "@/content/site";
import { useEffect, useRef } from "react";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Vollflächiges Mobilmenü in Deep Green.
 * Fokus-Falle, Esc schließt, Fokus kehrt zum Auslöser zurück (im Header).
 */
export function MobileMenu({ open, onClose }: MobileMenuProps) {
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
      className="on-dark fixed inset-0 z-60 flex flex-col overflow-y-auto bg-deep px-6 py-5"
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

      <nav aria-label="Hauptnavigation" className="mt-14 flex-1">
        <ul className="space-y-2">
          {navigation.map((item, index) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={onClose}
                className="group flex items-baseline gap-4 py-2"
              >
                <span className="text-xs font-medium text-accent/70 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-3xl font-medium text-cream transition-colors group-hover:text-accent">
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-6 border-t border-white/10 pt-8 pb-4">
        <Button href={ctaHref} onClick={onClose} withArrow className="w-full">
          {ctaLabel}
        </Button>
        <p className="text-sm text-cream/60">
          Oder rufen Sie uns an:{" "}
          <a href={site.phoneHref} className="font-medium text-cream underline-offset-4 hover:underline">
            {site.phone}
          </a>
        </p>
      </div>
    </div>
  );
}
