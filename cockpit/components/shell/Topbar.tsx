"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Bits";

const ROLE_LABEL: Record<string, string> = { arzt: "Arzt", empfang: "Empfang", admin: "Administration" };

export function Topbar({
  user,
  onMenu,
  onSearch,
  title,
}: {
  user: { name: string; email: string; role: string };
  onMenu: () => void;
  onSearch: () => void;
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-6">
      <button type="button" onClick={onMenu} aria-label="Navigation öffnen" className="rounded-full p-2 text-text-muted hover:bg-surface-sunken lg:hidden">
        <Icon name="menu" size={20} />
      </button>
      <p className="hidden min-w-0 truncate text-[13px] text-text-muted md:block">{title}</p>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSearch}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-raised px-3 text-[13px] text-text-muted transition-colors hover:border-line-strong hover:text-text"
      >
        <Icon name="search" size={15} />
        <span className="hidden sm:inline">Suchen oder springen</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("cockpit-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const apply = (next: "light" | "dark" | "system") => {
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem("cockpit-theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("cockpit-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {}
  };
  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      type="button"
      onClick={() => apply(isDark ? "light" : "dark")}
      aria-label={isDark ? "Helles Design" : "Dunkles Design"}
      title={isDark ? "Helles Design" : "Dunkles Design"}
      className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
    >
      <Icon name={isDark ? "sun" : "moon"} size={18} />
    </button>
  );
}

function UserMenu({ user }: { user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-raised pr-3 pl-1 text-[13px] hover:border-line-strong"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-deep text-[11px] font-semibold text-cream">{initials || "•"}</span>
        <span className="hidden max-w-32 truncate font-medium text-text sm:inline">{user.name}</span>
        <Icon name="chevron-down" size={14} className="text-text-faint" />
      </button>
      {open && (
        <div role="menu" className={cn("rise-in elevated absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface-raised p-1.5 text-[13px]")}>
          <div className="px-3 py-2">
            <p className="truncate font-medium text-text">{user.name}</p>
            <p className="truncate text-[12px] text-text-muted">{user.email}</p>
            <p className="mt-1 inline-block rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-brand uppercase">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <a href="/einstellungen/sicherheit" role="menuitem" className="flex items-center gap-2 rounded-xl px-3 py-2 text-text hover:bg-surface-sunken">
            <Icon name="shield" size={16} className="text-text-faint" /> Sicherheit
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await authClient.signOut();
              router.replace("/login");
              router.refresh();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-text hover:bg-surface-sunken"
          >
            <Icon name="logout" size={16} className="text-text-faint" /> Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
