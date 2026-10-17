"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { NAV, type NavItem } from "./nav";

const WIDE = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/**
 * Helle Seitenleiste – ein Werkzeug für acht Stunden Tageslicht.
 * Aktiver Eintrag: 2-px-Markenbalken links. Anfragen und Warteliste zeigen,
 * wie viel offen ist; Bereiche in Vorbereitung stehen gesammelt am Ende.
 * Einklappbar auf 64 px (Anzeigepräferenz, localStorage). Am Handy ein
 * Menü, das geschlossen nicht per Tab erreichbar ist (inert) und mit Esc
 * zugeht.
 */
export function Sidebar({
  demoCount,
  counts,
  mobileOpen,
  onMobileClose,
}: {
  demoCount: number;
  counts: { requests: number; waitlist: number };
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("cockpit-sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("cockpit-sidebar", next ? "collapsed" : "open");
    } catch {}
  };

  // Handy: offenes Menü bekommt den Fokus, Esc schließt es
  useEffect(() => {
    if (wide || !mobileOpen) return;
    aside.current?.querySelector<HTMLElement>("a[aria-current], a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, mobileOpen, onMobileClose]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const main = NAV.filter((n) => !n.preparing);
  const preparing = NAV.filter((n) => n.preparing);

  const link = (item: NavItem) => {
    const active = isActive(item.href);
    const count = item.count ? counts[item.count] : 0;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onMobileClose}
          aria-current={active ? "page" : undefined}
          title={collapsed ? (count ? `${item.label} (${count})` : item.label) : undefined}
          className={cn(
            "relative flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium transition-colors duration-150 max-lg:h-11",
            collapsed ? "justify-center px-0" : "px-3",
            active ? "bg-surface-raised text-text ring-1 ring-line" : "text-text-muted hover:bg-surface-raised/70 hover:text-text",
          )}
        >
          {active && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-brand-fill" />}
          <Icon name={item.icon} size={18} className={cn(active ? "text-brand" : "text-text-muted")} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {count > 0 &&
            (collapsed ? (
              <span aria-hidden="true" className="absolute top-2 right-3 size-2 rounded-full bg-brand-fill" />
            ) : (
              <span className="tnum min-w-6 rounded-full bg-surface-sunken px-1.5 py-0.5 text-center text-[11px] font-semibold text-text-muted">
                {count}
                <span className="sr-only"> offen</span>
              </span>
            ))}
        </Link>
      </li>
    );
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-deep/30 backdrop-blur-[2px] lg:hidden" onClick={onMobileClose} aria-hidden="true" />}
      <aside
        ref={aside}
        inert={!wide && !mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-sidebar backdrop-blur-md transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          collapsed ? "w-16" : "w-[248px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ transitionTimingFunction: "var(--ease-out-soft)" }}
        aria-label="Hauptnavigation"
      >
        <div className={cn("flex h-14 items-center border-b border-line", collapsed ? "justify-center px-0" : "px-4")}>
          <Link href="/" className="rounded-lg" aria-label="Zur Startseite">
            <LogoLockup compact={collapsed} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">{main.map(link)}</ul>
          {preparing.length > 0 && (
            <>
              {collapsed ? (
                <div aria-hidden="true" className="mx-4 mt-4 mb-2 border-t border-line" />
              ) : (
                <p className="mt-5 mb-1 px-5 text-[11px] font-semibold tracking-[0.14em] text-text-muted uppercase">In Vorbereitung</p>
              )}
              <ul className="space-y-0.5 px-2" aria-label={collapsed ? "In Vorbereitung" : undefined}>
                {preparing.map(link)}
              </ul>
            </>
          )}
        </nav>

        {demoCount > 0 && (
          // Warnfarbe nur am Rand und am Punkt – Text in voller Schriftfarbe (Kontrast auf dem Warnton)
          <div className={cn("mx-2 mb-2 rounded-xl border border-warn/40 bg-warn/10 text-text", collapsed ? "p-2 text-center" : "px-3 py-2.5")}>
            {collapsed ? (
              <span className="text-[10px] font-bold tracking-[0.1em]">DEMO</span>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
                  Demo-Daten aktiv
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-text-muted">
                  {demoCount} Vorführdatensätze. Live-Betrieb ist gesperrt.{" "}
                  <Link href="/einstellungen/demo" className="font-medium text-brand underline underline-offset-2">
                    Verwalten
                  </Link>
                </p>
              </>
            )}
          </div>
        )}

        <div className="hidden border-t border-line p-2 lg:block">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Navigation ausklappen" : "Navigation einklappen"}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[12px] text-text-muted hover:bg-surface-raised hover:text-text"
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
