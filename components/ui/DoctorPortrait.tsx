"use client";

import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/ui/Logo";
import { useEffect, useRef, useState } from "react";

/**
 * Porträt von Dr. Kunstreich – freigestelltes Foto (WebP mit Alpha).
 *
 * Varianten:
 * - "card":   gerahmte Panel-Darstellung mit Marken-Hintergrund; der
 *             Gradient bleibt hinter dem transparenten Freisteller dauerhaft
 *             sichtbar (Über-den-Arzt-Sektion, statischer Hero).
 * - "cutout": nackte Freisteller-Ebene ohne eigenen Hintergrund – für den
 *             cinematischen Hero, dort liefert HeroBackground das Ambiente.
 *
 * Foto austauschen: `public/images/dr-kunstreich.webp` überschreiben
 * (Hochformat 3:4, freigestellt mit Transparenz) – kein Code-Change nötig.
 */

export const PORTRAIT_SRC = "/images/dr-kunstreich.webp";
export const PORTRAIT_WIDTH = 1086;
export const PORTRAIT_HEIGHT = 1448;

interface DoctorPortraitProps {
  alt: string;
  className?: string;
  /** Bild oberhalb des Folds sofort laden */
  priority?: boolean;
  variant?: "card" | "cutout";
}

export function DoctorPortrait({
  alt,
  className,
  priority = false,
  variant = "card",
}: DoctorPortraitProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // load/error können bereits VOR der Hydration gefeuert haben (statisches
  // HTML, eager geladenes Bild aus dem Cache) – React spielt solche Events
  // nicht nach. Deshalb den bereits feststehenden Zustand einmalig ablesen.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  const image = status !== "error" && (
    // eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server
    <img
      ref={imgRef}
      src={PORTRAIT_SRC}
      alt={alt}
      width={PORTRAIT_WIDTH}
      height={PORTRAIT_HEIGHT}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
      className={cn(
        "relative h-full w-full object-contain object-bottom transition-opacity duration-700",
        status === "loaded" ? "opacity-100" : "opacity-0",
      )}
    />
  );

  if (variant === "cutout") {
    return <div className={cn("relative", className)}>{image}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden bg-deep", className)}>
      {/* Marken-Hintergrund – bleibt hinter dem transparenten Freisteller sichtbar */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-deep via-[#1e3325] to-[#2c4a2a]" />
        <svg
          viewBox="0 0 400 533"
          className="absolute inset-0 h-full w-full"
          focusable="false"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M-40 420 C 80 340, 180 420, 240 330 S 420 260, 460 300"
            fill="none"
            stroke="#86BC23"
            strokeOpacity="0.16"
            strokeWidth="1.5"
          />
          <path
            d="M-40 460 C 90 380, 200 460, 270 370 S 430 310, 470 350"
            fill="none"
            stroke="#527A32"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          <circle cx="330" cy="120" r="130" fill="#527A32" fillOpacity="0.12" />
        </svg>
      </div>

      {/* Identitäts-Overlay nur solange das Foto (noch) nicht da ist */}
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <LogoMark size={64} className="text-accent/70" />
          <p className="text-[11px] font-medium tracking-[0.3em] text-cream/70 uppercase">
            Dr. Kai Kunstreich
            <span className="mt-1 block text-[9px] tracking-[0.4em] text-cream/40">
              Proktologie
            </span>
          </p>
        </div>
      )}

      {image}
    </div>
  );
}
