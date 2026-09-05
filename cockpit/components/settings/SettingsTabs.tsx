"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SETTINGS_TABS } from "@/components/shell/nav";

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Einstellungen" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {SETTINGS_TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              active ? "text-text" : "text-text-muted hover:text-text",
            )}
          >
            {t.label}
            {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-fill" />}
          </Link>
        );
      })}
    </nav>
  );
}
