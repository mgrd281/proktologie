"use client";

import { Icon } from "@/components/ui/Icon";
import { swipeList } from "@/components/ui/Swipe";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wischreihe mit Orientierung (nur Handy, siehe Swipe.tsx): Darunter steht,
 * wo man ist („2 / 8“). Mit Maus (etwa ein schmales Fenster oder 200 %
 * Zoom) kommen Pfeil-Knöpfe und eine schmale Leiste dazu – Wischen geht
 * dort nicht. Fokussierbar (Pfeiltasten scrollen) ist die Reihe nur, wenn
 * sie wirklich scrollt; am Desktop ist sie ein gewöhnliches Raster ohne
 * zusätzlichen Tab-Halt.
 */

interface SwipeRowProps {
  as?: "ul" | "ol";
  label: string;
  count: number;
  onDark?: boolean;
  className?: string;
  children: ReactNode;
}

export function SwipeRow({ as: List = "ul", label, count, onDark = false, className, children }: SwipeRowProps) {
  const ref = useRef<HTMLUListElement & HTMLOListElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [index, setIndex] = useState(0);

  // Abstand zweier Karten = Kartenbreite + Lücke (aus den echten Positionen)
  const step = useCallback(() => {
    const items = ref.current?.children;
    if (!items || items.length < 2) return 1;
    return items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left || 1;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setScrollable(el.scrollWidth > el.clientWidth + 1);
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      setIndex(atEnd && el.scrollLeft > 0 ? count - 1 : Math.min(count - 1, Math.round(el.scrollLeft / step())));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [count, step]);

  const go = (delta: number) => {
    const el = ref.current;
    if (!el) return;
    const target = Math.max(0, Math.min(count - 1, index + delta));
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target * step(), behavior: smooth ? "smooth" : "auto" });
  };

  const tone = onDark ? "text-cream/75" : "text-ink/70";
  const arrow = cn(
    "hidden size-11 items-center justify-center rounded-full border transition-colors [@media(hover:hover)_and_(pointer:fine)]:inline-flex",
    onDark ? "border-white/25 text-cream hover:border-accent hover:text-accent" : "border-ink/15 text-ink hover:border-primary hover:text-primary-deep",
    "aria-disabled:cursor-default aria-disabled:opacity-35",
  );

  return (
    <>
      {/* swipe-row: Mit Maus eine schmale, sichtbare Leiste (app/globals.css) */}
      <List
        ref={ref}
        tabIndex={scrollable ? 0 : undefined}
        aria-label={label}
        className={cn("swipe-row", className, swipeList)}
      >
        {children}
      </List>
      <div className={cn("mt-3 flex items-center justify-between gap-3 text-xs tracking-wide md:hidden", tone)}>
        {/* Bei Touch der bekannte Hinweis (auch ohne JavaScript) – mit Maus sagen es die Pfeile */}
        <span aria-hidden="true" className="flex items-center gap-2 [@media(hover:hover)_and_(pointer:fine)]:invisible">
          Zum Weiterlesen seitlich wischen
          <Icon name="arrow-right" size={14} />
        </span>
        {scrollable && (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Vorherige Karte"
              aria-disabled={index === 0 || undefined}
              className={arrow}
            >
              <Icon name="arrow-right" size={16} className="rotate-180" />
            </button>
            <span aria-hidden="true" className="font-medium tabular-nums">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Nächste Karte"
              aria-disabled={index === count - 1 || undefined}
              className={arrow}
            >
              <Icon name="arrow-right" size={16} />
            </button>
          </span>
        )}
      </div>
    </>
  );
}
