"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Bits";
import { NAV } from "./nav";

/**
 * ⌘K: springen, anlegen, suchen – alles über eine Eingabe. Dazu die
 * Zwei-Tasten-Kürzel „g“ + Buchstabe (wie in Linear/GitHub), die auch
 * ohne geöffnete Palette funktionieren.
 */
interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  keys?: string[];
  run: () => void;
  group: "Springen" | "Anlegen" | "Ansicht";
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pendingG = useRef(false);

  const commands = useMemo<Command[]>(
    () => [
      ...NAV.map<Command>((n) => ({
        id: `go:${n.href}`,
        label: n.label,
        hint: n.phase ? `Phase ${n.phase}` : undefined,
        icon: n.icon,
        keys: ["g", n.key],
        group: "Springen",
        run: () => router.push(n.href),
      })),
      { id: "new:appt", label: "Neuen Termin anlegen", icon: "plus", keys: ["n"], group: "Anlegen", run: () => router.push("/termine?neu=1") },
      { id: "new:blocker", label: "Blocker / Urlaub eintragen", icon: "clock", group: "Anlegen", run: () => router.push("/termine?ausnahme=1") },
      { id: "new:invite", label: "Mitarbeitende einladen", icon: "users", group: "Anlegen", run: () => router.push("/einstellungen/benutzer?einladen=1") },
      { id: "view:print", label: "Tagesblatt drucken", icon: "printer", group: "Ansicht", run: () => window.print() },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  // Globale Kürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (open || typing) return;
      if (e.key === "g") {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 1200);
        return;
      }
      if (pendingG.current) {
        const item = NAV.find((n) => n.key === e.key);
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        pendingG.current = false;
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        router.push("/termine?neu=1");
      }
      if (e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, router]);

  if (!open) return null;

  const run = (c: Command) => {
    onOpenChange(false);
    c.run();
  };

  const groups = ["Springen", "Anlegen", "Ansicht"] as const;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Befehle" className="rise-in elevated relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface-raised text-text">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(filtered.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && filtered[cursor]) {
                e.preventDefault();
                run(filtered[cursor]!);
              } else if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            placeholder="Wohin? Was anlegen?"
            aria-label="Befehl suchen"
            className="h-13 w-full bg-transparent text-[15px] outline-none placeholder:text-text-faint"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {groups.map((g) => {
            const items = filtered.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <li key={g} role="presentation">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.16em] text-text-faint uppercase">{g}</p>
                <ul role="group">
                  {items.map((c) => {
                    const idx = filtered.indexOf(c);
                    const active = idx === cursor;
                    return (
                      <li key={c.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => run(c)}
                          className={cn(
                            "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px]",
                            active ? "bg-brand-soft text-text" : "text-text-muted",
                          )}
                        >
                          <Icon name={c.icon} size={16} className={active ? "text-brand" : "text-text-faint"} />
                          <span className="flex-1">{c.label}</span>
                          {c.hint && <span className="text-[11px] text-text-faint">{c.hint}</span>}
                          {c.keys && (
                            <span className="flex gap-1">
                              {c.keys.map((k) => (
                                <Kbd key={k}>{k}</Kbd>
                              ))}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-text-muted">Nichts gefunden.</li>}
        </ul>
      </div>
    </div>
  );
}
