"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * Drawer (seitliche Detailebene) und Dialog (Bestätigung). Beide:
 * role="dialog", Fokus auf `[data-autofocus]` (sonst auf die Ebene selbst),
 * Esc schließt, Fokus kehrt zum Auslöser zurück.
 *
 * Ebenen stapeln sich (Drawer, darauf ein Bestätigungsdialog): Nur die
 * oberste ist bedienbar und reagiert auf Esc und Tab. Alles darunter – die
 * ganze Oberfläche samt Seitenleiste und Kopfzeile, tiefere Ebenen – ist
 * `inert`. Meldungen (Toasts) bleiben außerhalb und damit hörbar.
 */
const layers: HTMLElement[] = [];

function syncLayers() {
  const shell = document.getElementById("cockpit-shell") ?? document.getElementById("cockpit-main");
  if (shell) shell.inert = layers.length > 0;
  layers.forEach((el, i) => {
    el.inert = i < layers.length - 1;
  });
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
/** Bedienelemente außerhalb der Ebenen, die per Tab erreichbar bleiben (Sitzungshinweis). */
const FREE = FOCUSABLE.split(", ")
  .map((sel) => `[data-overlay-free] ${sel}`)
  .join(", ");

function useOverlay(open: boolean, mounted: boolean, onClose: () => void, root: React.RefObject<HTMLDivElement | null>, panel: React.RefObject<HTMLDivElement | null>) {
  // onClose wechselt bei vielen Aufrufern mit jedem Rendern – über eine Ref
  // läuft der Effekt nur beim Öffnen und Schließen, nicht bei jeder Eingabe.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    // Erst wenn die Ebene wirklich im Dokument steht (Portal nach dem Einhängen)
    if (!open || !mounted) return;
    const layer = root.current;
    const box = panel.current;
    if (!layer || !box) return;
    const returnTo = document.activeElement as HTMLElement | null;
    layers.push(layer);
    syncLayers();
    const first = box.querySelector<HTMLElement>("[data-autofocus]:not([data-autofocus='false'])") ?? box;
    first.focus({ preventScroll: true });
    const top = () => layers[layers.length - 1] === layer;
    const onKey = (e: KeyboardEvent) => {
      if (!top() || e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === "Tab") {
        const f = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!f.length) return;
        const firstEl = f[0]!;
        const lastEl = f[f.length - 1]!;
        // Freie Elemente (z. B. „Angemeldet bleiben“) hängen hinten an den Kreis an
        const free = Array.from(document.querySelectorAll<HTMLElement>(FREE));
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === firstEl || active === box)) {
          e.preventDefault();
          (free[free.length - 1] ?? lastEl).focus();
        } else if (e.shiftKey && active && active === free[0]) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          (free[0] ?? firstEl).focus();
        } else if (!e.shiftKey && active && active === free[free.length - 1]) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = layers.indexOf(layer);
      if (at >= 0) layers.splice(at, 1);
      layer.inert = false;
      syncLayers();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [open, mounted, root, panel]);
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
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useOverlay(open, mounted, onClose, root, panel);
  if (!open || !mounted) return null;
  // Portal auf <body>: Die Seite dahinter wird `inert`, die Ebene selbst nicht
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-deep/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className="slide-in-right elevated relative flex h-full w-full flex-col bg-surface-raised text-text outline-none"
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
  /** Ohne onConfirm: ein reiner Hinweis (role="dialog") mit nur einem Knopf */
  onConfirm?: () => void | Promise<void>;
  danger?: boolean;
  busy?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  useOverlay(open, mounted, onClose, root, panel);
  if (!open || !mounted) return null;
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role={onConfirm ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1} className={cn("rise-in elevated relative w-full max-w-md rounded-2xl bg-surface-raised p-6 text-text outline-none")}>
        <h2 id="dialog-title" className="font-display text-[20px] leading-tight font-medium">
          {title}
        </h2>
        {children && <div className="mt-3 text-[14px] leading-relaxed text-text-muted">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant={onConfirm ? "ghost" : "secondary"} onClick={onClose} data-autofocus>
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
              {confirmLabel}
            </Button>
          )}
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
