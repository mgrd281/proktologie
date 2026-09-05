"use client";

import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  user,
  demoCount,
  title,
  children,
}: {
  user: { name: string; email: string; role: string };
  demoCount: number;
  title?: string;
  children: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar demoCount={demoCount} mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={user} onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} title={title} />
          <main id="cockpit-main" className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </ToastProvider>
  );
}
