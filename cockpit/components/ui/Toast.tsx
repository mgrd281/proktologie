"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Toasts mit Rückgängig: Jede destruktive oder statusändernde Aktion
 * bekommt fünf Sekunden Bedenkzeit, statt vorher einen Dialog zu zeigen.
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

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast außerhalb des ToastProviders");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { ...input, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), input.durationMs ?? (input.action ? 6000 : 4000)));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "rise-in elevated pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-text",
            )}
          >
            <span
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
                onClick={async () => {
                  await t.action!.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-brand hover:bg-brand-soft"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Schließen" onClick={() => dismiss(t.id)} className="shrink-0 rounded-full p-1 text-text-faint hover:text-text">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
