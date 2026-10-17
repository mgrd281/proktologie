"use client";

import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "./CommandPalette";
import { SessionGuard } from "./SessionGuard";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  user,
  demoCount,
  absoluteSeconds,
  title,
  children,
}: {
  user: { name: string; email: string; role: string };
  demoCount: number;
  /** Absolute Sitzungsdauer (lib/auth/auth.ts) – für den Sitzungswächter */
  absoluteSeconds: number;
  title?: string;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);

  return (
    <ToastProvider>
      {/* #cockpit-shell: wird inert, solange ein Drawer oder Dialog offen ist (Overlay.tsx) */}
      <div id="cockpit-shell" className="flex min-h-dvh">
        <Sidebar demoCount={demoCount} mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
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
    </ToastProvider>
  );
}
