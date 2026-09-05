"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * Drawer (seitliche Detailebene) und Dialog (Bestätigung). Beide:
 * role="dialog", Fokus auf das erste Bedienelement, Esc schließt,
 * Fokus kehrt zum Auslöser zurück, Seite dahinter wird `inert`.
 */
function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  const returnTo = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement;
    const main = document.getElementById("cockpit-main");
    main?.setAttribute("inert", "");
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])"));
        if (!f.length) return;
        const firstEl = f[0]!;
        const lastEl = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      main?.removeAttribute("inert");
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, panel]);
}

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useOverlay(open, onClose, panel);
  if (!open || !mounted) return null;
  // Portal auf <body>: Die Seite dahinter wird `inert`, die Ebene selbst nicht
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-deep/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="slide-in-right elevated relative flex h-full w-full flex-col bg-surface-raised text-text"
        style={{ maxWidth: width }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            {eyebrow && <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-text-muted uppercase">{eyebrow}</p>}
            <h2 id="drawer-title" className="font-display text-[22px] leading-tight font-medium">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded-full p-2 text-text-muted hover:bg-surface-sunken hover:text-text">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  onConfirm,
  danger,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useOverlay(open, onClose, panel);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" className={cn("rise-in elevated relative w-full max-w-md rounded-2xl bg-surface-raised p-6 text-text")}>
        <h2 id="dialog-title" className="font-display text-[20px] leading-tight font-medium">
          {title}
        </h2>
        {children && <div className="mt-3 text-[14px] leading-relaxed text-text-muted">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
