"use client";

import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/ui/Logo";
import { useEffect, useRef, useState } from "react";

/**
 * Porträt von Dr. Kunstreich mit elegantem Fallback.
 *
 * Foto-Drop-in: Datei als `public/images/dr-kunstreich.jpg` ablegen
 * (Hochformat ca. 3:4, mind. 1200 × 1600 px). Sie erscheint automatisch –
 * ohne Code-Änderung. Fehlt die Datei, zeigt die Komponente ein gestaltetes
 * Marken-Panel statt eines kaputten Bildes.
 */

export const PORTRAIT_SRC = "/images/dr-kunstreich.jpg";

interface DoctorPortraitProps {
  alt: string;
  className?: string;
  /** Bild oberhalb des Folds sofort laden */
  priority?: boolean;
}

export function DoctorPortrait({
  alt,
  className,
  priority = false,
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

  return (
    <div className={cn("relative overflow-hidden bg-deep", className)}>
      {/* Gestalteter Fallback – sichtbar bis das Foto geladen ist */}
      {status !== "loaded" && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-deep via-[#1e3325] to-[#2c4a2a]" />
          <svg
            viewBox="0 0 400 533"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M-40 420 C 80 340, 180 420, 240 330 S 420 260, 460 300"
              fill="none"
              stroke="#B8D94C"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <LogoMark size={64} className="text-accent/70" />
            <p className="text-[11px] font-medium tracking-[0.3em] text-cream/70 uppercase">
              Dr. Kai Kunstreich
              <span className="mt-1 block text-[9px] tracking-[0.4em] text-cream/40">
                Proktologie
              </span>
            </p>
          </div>
        </div>
      )}

      {status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server
        <img
          ref={imgRef}
          src={PORTRAIT_SRC}
          alt={alt}
          width={1200}
          height={1600}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "relative h-full w-full object-cover object-top transition-opacity duration-700",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
