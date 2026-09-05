"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { LogoLockup } from "@/components/ui/Logo";
import { NAV } from "./nav";

/**
 * Helle Seitenleiste – ein Werkzeug für acht Stunden Tageslicht.
 * Aktiver Eintrag: 2-px-Markenbalken links. Einklappbar auf 64 px;
 * der Zustand ist eine reine Anzeigepräferenz (localStorage).
 */
export function Sidebar({ demoCount, mobileOpen, onMobileClose }: { demoCount: number; mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-deep/30 backdrop-blur-[2px] lg:hidden" onClick={onMobileClose} aria-hidden="true" />}
      <aside
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
          <ul className="space-y-0.5 px-2">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium transition-colors duration-150",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "bg-surface-raised text-text ring-1 ring-line" : "text-text-muted hover:bg-surface-raised/70 hover:text-text",
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-brand-fill" />}
                    <Icon name={item.icon} size={18} className={cn(active ? "text-brand" : "text-text-faint")} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.phase && (
                      <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-text-faint uppercase">
                        Phase {item.phase}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {demoCount > 0 && (
          <div className={cn("mx-2 mb-2 rounded-xl border border-warn/40 bg-warn/10 text-warn", collapsed ? "p-2 text-center" : "px-3 py-2.5")}>
            {collapsed ? (
              <span className="text-[10px] font-bold tracking-[0.1em]">DEMO</span>
            ) : (
              <>
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase">Demo-Daten aktiv</p>
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
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[12px] text-text-faint hover:bg-surface-raised hover:text-text"
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {!collapsed && <span>Einklappen</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
