"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Toasts mit Rückgängig: Jede destruktive oder statusändernde Aktion
 * bekommt einige Sekunden Bedenkzeit, statt vorher einen Dialog zu zeigen.
 * - Unter der Maus oder mit dem Fokus darin bleibt die Meldung stehen.
 * - Strg+Z (⌘Z) macht die letzte Aktion rückgängig – außer beim Tippen,
 *   dort gilt das Rückgängig des Feldes.
 * - Danach „Rückgängig gemacht“; scheitert es, steht das als Fehler da.
 * - Fehler kommen als Alarm (assertive), alles andere höflich.
 */
export interface ToastInput {
  title: string;
  description?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
  action?: { label: string; onClick: () => void | Promise<void> };
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface Timer {
  handle: ReturnType<typeof setTimeout> | null;
  due: number;
  remaining: number;
}

const UNDO = "Rückgängig";

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast außerhalb des ToastProviders");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const itemsRef = useRef<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, Timer>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    timers.current.delete(id);
  }, []);

  const schedule = useCallback(
    (id: number, ms: number) => {
      timers.current.set(id, { handle: setTimeout(() => dismiss(id), ms), due: Date.now() + ms, remaining: ms });
    },
    [dismiss],
  );
  /** Maus darüber oder Fokus darin: Die Zeit läuft nicht weiter. */
  const pause = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (!timer?.handle) return;
    clearTimeout(timer.handle);
    timers.current.set(id, { handle: null, due: 0, remaining: Math.max(1500, timer.due - Date.now()) });
  }, []);
  const resume = useCallback(
    (id: number) => {
      const timer = timers.current.get(id);
      if (!timer || timer.handle) return;
      schedule(id, timer.remaining);
    },
    [schedule],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      // Abgemeldet? Der Sitzungswächter (SessionGuard) sieht sofort nach, statt erst in einer Minute
      if (/anmelden|abgemeldet/i.test(`${input.title} ${input.description ?? ""}`)) window.dispatchEvent(new Event("cockpit:session-check"));
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { ...input, id }]);
      schedule(id, input.durationMs ?? (input.action ? 6000 : 4000));
    },
    [schedule],
  );

  const runAction = useCallback(
    async (t: ToastItem) => {
      dismiss(t.id);
      try {
        await t.action!.onClick();
        if (t.action!.label === UNDO) toast({ title: "Rückgängig gemacht", tone: "ok" });
      } catch (e) {
        toast({ title: "Rückgängig nicht möglich", description: e instanceof Error ? e.message : "Bitte den Stand prüfen.", tone: "danger" });
      }
    },
    [dismiss, toast],
  );

  // Strg+Z / ⌘Z: die letzte Aktion mit „Rückgängig“ – nicht beim Tippen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const latest = [...itemsRef.current].reverse().find((t) => t.action?.label === UNDO);
      if (!latest) return;
      e.preventDefault();
      void runAction(latest);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [runAction]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => t.handle && clearTimeout(t.handle));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  const render = (t: ToastItem) => (
    <div
      key={t.id}
      onMouseEnter={() => pause(t.id)}
      onMouseLeave={() => resume(t.id)}
      onFocus={() => pause(t.id)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume(t.id);
      }}
      className="rise-in elevated pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-text"
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          t.tone === "ok" && "bg-ok",
          t.tone === "warn" && "bg-warn",
          t.tone === "danger" && "bg-danger",
          (!t.tone || t.tone === "neutral") && "bg-brand-fill",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{t.title}</p>
        {t.description && <p className="mt-0.5 text-[13px] text-text-muted">{t.description}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          onClick={() => void runAction(t)}
          aria-keyshortcuts={t.action.label === UNDO ? "Control+Z" : undefined}
          title={t.action.label === UNDO ? "Rückgängig (Strg+Z)" : undefined}
          className="min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-brand hover:bg-brand-soft max-md:min-h-11"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Meldung schließen"
        onClick={() => dismiss(t.id)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text max-md:size-11"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4">
        {/* Zwei Live-Regionen: Fehler drängen sich vor (assertive), alles andere wartet höflich */}
        <div aria-live="assertive" className="flex w-full flex-col items-center gap-2">
          {items.filter((t) => t.tone === "danger").map(render)}
        </div>
        <div aria-live="polite" className="flex w-full flex-col items-center gap-2">
          {items.filter((t) => t.tone !== "danger").map(render)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
