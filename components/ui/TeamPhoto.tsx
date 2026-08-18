"use client";

import { cn } from "@/lib/cn";
import { praxisSection } from "@/content/sections";
import { useEffect, useRef, useState } from "react";

/**
 * Teamfoto der Praxis – prominente Bildfläche in „Praxis & Team".
 *
 * Drop-in: Datei als `public/images/team.webp` ablegen (Querformat,
 * ~1600 px breit) – sie erscheint automatisch. Fehlt die Datei, wird der
 * Block komplett ausgeblendet (kein kaputtes Bild, kein Leerraum).
 * Dieselbe Datei ist als Ausgangsmaterial für das spätere Sequenz-Kapitel
 * „06 – Praxis" vorgesehen.
 */

export const TEAM_PHOTO_SRC = "/images/team.webp";

export function TeamPhoto({ className }: { className?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // load/error können vor der Hydration gefeuert haben – Zustand ablesen
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    setStatus(img.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  if (status === "error") return null;

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-2xl",
        status !== "loaded" && "hidden",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierungs-Server */}
      <img
        ref={imgRef}
        src={TEAM_PHOTO_SRC}
        alt={praxisSection.teamAlt}
        width={1600}
        height={800}
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className="w-full object-cover"
      />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-deep/75 to-transparent px-6 pt-16 pb-5">
        <span className="text-sm font-medium tracking-wide text-cream">
          {praxisSection.teamCaption}
        </span>
      </figcaption>
    </figure>
  );
}
