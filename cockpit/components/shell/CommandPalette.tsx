"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { searchAppointmentsAction, type SearchHit } from "@/app/actions/appointments";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/lib/booking/model";
import { fmtShortDate } from "@/lib/time";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Bits";
import { Dialog } from "@/components/ui/Overlay";
import { NAV } from "./nav";

/**
 * ⌘K / Strg K: suchen, springen, anlegen – alles über eine Eingabe. Gesucht
 * werden Termine nach Name (Nachname + Vorname), Telefon, E-Mail oder
 * Referenz; exakt über die Blind-Indizes, Treffer öffnen den Termin. Dazu
 * die Zwei-Tasten-Kürzel „g“ + Buchstabe (wie in Linear/GitHub), die auch
 * ohne geöffnete Palette funktionieren – solange kein Drawer oder Dialog
 * offen ist.
 */
interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  keys?: string[];
  run: () => void;
  group: Group;
}

type Group = "Termine" | "Springen" | "Anlegen" | "Ansicht";
const GROUPS: Group[] = ["Termine", "Springen", "Anlegen", "Ansicht"];

/** Liegt eine Ebene (Drawer, Dialog) über der Oberfläche? Dann ruhen die Kürzel (Overlay.tsx). */
const layerOpen = () => Boolean(document.getElementById("cockpit-shell")?.inert);

/** Auf /termine bleiben Ansicht und Datum stehen – „n“ legt am angezeigten Tag an. */
function termineHref(param: "neu" | "ausnahme"): string {
  const params = new URLSearchParams(location.pathname === "/termine" ? location.search : "");
  for (const key of ["neu", "ausnahme", "id"]) params.delete(key);
  params.set(param, "1");
  return `/termine?${params}`;
}

/**
 * Tagesblatt: auf „Heute“ gedruckt – dort steht der Tagesplan, der Rest der
 * Seite und die Oberfläche bleiben beim Druck weg (globals.css).
 */
function printDaySheet(push: (href: string) => void) {
  if (location.pathname === "/") window.print();
  else push("/?drucken=1");
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const pendingG = useRef(false);
  const [help, setHelp] = useState(false);

  // Globale Kürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (layerOpen()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (open || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g") {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 1200);
        return;
      }
      if (pendingG.current) {
        const item = NAV.find((n) => n.key && n.key === e.key);
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        pendingG.current = false;
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        router.push(termineHref("neu"));
      }
      if (e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, router]);

  // Bei jedem Öffnen frisch: leere Eingabe, erster Eintrag
  return (
    <>
      {open && <Palette onClose={() => onOpenChange(false)} onHelp={() => setHelp(true)} />}
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
    </>
  );
}

const noSubscribe = () => () => {};

/** „?“: alle Tastenkürzel auf einen Blick. */
function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  const mod = mac ? "⌘" : "Strg";
  const rows: Array<[string[], string]> = [
    [[mod, "K"], "Suchen oder springen (auch /)"],
    [["g", "h"], "Heute"],
    [["g", "t"], "Termine"],
    [["g", "a"], "Anfragen"],
    [["g", "w"], "Warteliste"],
    [["g", "e"], "Einstellungen"],
    [["n"], "Neuer Termin"],
    [["←", "→"], "Kalender: zurück / weiter"],
    [["t"], "Kalender: heute"],
    [["Enter"], "Termin-Fenster: speichern"],
    [[mod, "Enter"], "Speichern, auch aus der Notiz"],
    [["Esc"], "Fenster schließen"],
    [[mod, "Z"], "Letzte Aktion rückgängig"],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Tastenkürzel" cancelLabel="Schließen">
      <dl className="mt-1 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[14px] text-text">
        {rows.map(([keys, label]) => (
          <div key={label} className="contents">
            <dt className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px]">In offenen Fenstern ruhen die Kürzel – dort gilt nur Esc.</p>
    </Dialog>
  );
}

interface SearchResult {
  q: string;
  hits: SearchHit[];
  needsFullName: boolean;
  failed: boolean;
}

function Palette({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  // Termine suchen – kurz nach dem letzten Tastendruck
  const query = q.trim();
  useEffect(() => {
    if (query.length < 2) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void searchAppointmentsAction(query).then(
        (r) => alive && setSearch({ q: query, hits: r.ok ? r.data.hits : [], needsFullName: r.ok && r.data.needsFullName, failed: !r.ok }),
        () => alive && setSearch({ q: query, hits: [], needsFullName: false, failed: true }),
      );
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  const result = search && search.q === query ? search : null;
  const searching = query.length >= 2 && !result;

  const commands = useMemo<Command[]>(
    () => [
      ...NAV.map<Command>((n) => ({
        id: `go:${n.href}`,
        label: n.label,
        hint: n.preparing ? "in Vorbereitung" : undefined,
        icon: n.icon,
        keys: n.key ? ["g", n.key] : undefined,
        group: "Springen",
        run: () => router.push(n.href),
      })),
      { id: "new:appt", label: "Neuen Termin anlegen", icon: "plus", keys: ["n"], group: "Anlegen", run: () => router.push(termineHref("neu")) },
      { id: "new:blocker", label: "Blocker / Urlaub eintragen", icon: "clock", group: "Anlegen", run: () => router.push(termineHref("ausnahme")) },
      { id: "new:invite", label: "Mitarbeitende einladen", icon: "users", group: "Anlegen", run: () => router.push("/einstellungen/benutzer?einladen=1") },
      { id: "view:print", label: "Tagesblatt drucken", icon: "printer", group: "Ansicht", run: () => printDaySheet((href) => router.push(href)) },
      { id: "view:keys", label: "Tastenkürzel anzeigen", icon: "command", keys: ["?"], group: "Ansicht", run: onHelp },
    ],
    [router, onHelp],
  );

  const items = useMemo<Command[]>(() => {
    const s = query.toLowerCase();
    const hits: Command[] = (result?.hits ?? []).map((h) => ({
      id: `appt:${h.id}`,
      label: h.name,
      hint: `${fmtShortDate(new Date(`${h.date}T12:00:00Z`))} ${h.time} · ${h.typeLabel}${h.status === "cancelled" || h.status === "no_show" ? ` · ${STATUS_LABEL[h.status]}` : ""}${h.isDemo ? " · Demo" : ""}`,
      icon: "calendar",
      group: "Termine",
      run: () => router.push(`/termine?id=${encodeURIComponent(h.id)}`),
    }));
    const matching = s ? commands.filter((c) => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s)) : commands;
    return [...hits, ...matching];
  }, [query, result, commands, router]);

  const active = Math.min(cursor, Math.max(0, items.length - 1));
  const run = (c: Command) => {
    onClose();
    c.run();
  };

  // Zustand für Screenreader: Treffer, Suche läuft, Hinweis zur Namenssuche
  const status = searching
    ? "Suche …"
    : result?.failed
      ? "Die Suche ist gerade nicht erreichbar."
      : result?.hits.length
        ? `${result.hits.length} ${result.hits.length === 1 ? "Termin" : "Termine"} gefunden`
        : items.length === 0 && result?.needsFullName
          ? "Für die Namenssuche bitte Nachname und Vorname eingeben, z. B. „Müller Anna“."
          : items.length === 0 && query
            ? "Nichts gefunden."
            : "";

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Suchen oder springen" className="rise-in elevated relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface-raised text-text">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-text-faint" />
          <input
            ref={input}
            value={q}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-autocomplete="list"
            aria-activedescendant={items.length ? `palette-${active}` : undefined}
            aria-describedby="palette-status"
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor(Math.min(items.length - 1, active + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor(Math.max(0, active - 1));
              } else if (e.key === "Enter" && items[active]) {
                e.preventDefault();
                run(items[active]!);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Tab") {
                // Die Eingabe ist der einzige Halt im Dialog – Tab bleibt hier
                e.preventDefault();
              }
            }}
            placeholder="Name, Telefon, E-Mail, Ref – oder wohin?"
            aria-label="Suchen oder springen"
            className="h-13 w-full bg-transparent text-[16px] outline-none placeholder:text-text-faint md:text-[15px]"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" aria-label="Ergebnisse" className="max-h-[50vh] overflow-y-auto p-2">
          {GROUPS.map((g) => {
            const groupItems = items.filter((c) => c.group === g);
            if (!groupItems.length) return null;
            return (
              <li key={g} role="presentation">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.16em] text-text-faint uppercase" aria-hidden="true">
                  {g}
                </p>
                <ul role="group" aria-label={g}>
                  {groupItems.map((c) => {
                    const idx = items.indexOf(c);
                    const isActive = idx === active;
                    return (
                      <li
                        key={c.id}
                        id={`palette-${idx}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setCursor(idx)}
                        onClick={() => run(c)}
                        className={cn(
                          "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[14px]",
                          isActive ? "bg-brand-soft text-text" : "text-text-muted",
                        )}
                      >
                        <Icon name={c.icon} size={16} className={isActive ? "text-brand" : "text-text-faint"} />
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        {c.hint && <span className="tnum shrink-0 text-[12px] text-text-faint">{c.hint}</span>}
                        {c.keys && (
                          <span className="hidden gap-1 sm:flex" aria-hidden="true">
                            {c.keys.map((k) => (
                              <Kbd key={k}>{k}</Kbd>
                            ))}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
        <p id="palette-status" role="status" className={cn("px-5 pb-3 text-[13px] text-text-muted", !status && "sr-only")}>
          {status}
        </p>
      </div>
    </div>
  );
}
