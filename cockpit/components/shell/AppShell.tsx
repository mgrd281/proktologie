"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { AutoRefresh } from "./AutoRefresh";
import { CommandPalette } from "./CommandPalette";
import { SessionGuard } from "./SessionGuard";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  user,
  demoCount,
  counts,
  absoluteSeconds,
  title,
  children,
}: {
  user: { name: string; email: string; role: string };
  demoCount: number;
  /** Offene Anfragen und wartende Personen – Zähler in der Seitenleiste */
  counts: { requests: number; waitlist: number };
  /** Absolute Sitzungsdauer (lib/auth/auth.ts) – für den Sitzungswächter */
  absoluteSeconds: number;
  title?: string;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const closeNav = useCallback(() => setMobileNav(false), []);
  const [palette, setPalette] = useState(false);

  return (
    <ToastProvider>
      {/* #cockpit-shell: wird inert, solange ein Drawer oder Dialog offen ist (Overlay.tsx) */}
      <div id="cockpit-shell" className="flex min-h-dvh">
        <Sidebar demoCount={demoCount} counts={counts} mobileOpen={mobileNav} onMobileClose={closeNav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} title={title} />
          <main id="cockpit-main" className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      {/* Außerhalb von #cockpit-shell: bleibt bedienbar, auch wenn ein Drawer offen ist */}
      <SessionGuard absoluteSeconds={absoluteSeconds} />
      <AutoRefresh />
    </ToastProvider>
  );
}
