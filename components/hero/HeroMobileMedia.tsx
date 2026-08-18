"use client";

import { useState } from "react";
import {
  MOBILE_VIDEO_MP4,
  MOBILE_VIDEO_WEBM,
  POSTER_PATH,
} from "@/components/hero/sequence/config";
import { DoctorPortrait } from "@/components/ui/DoctorPortrait";
import { arzt } from "@/content/arzt";
import { cn } from "@/lib/cn";

/**
 * Mobiler Hero-Medien-Slot: statt 500 Frames ein kurzes, optimiertes
 * Video (WebM + MP4-Fallback, Poster aus der Sequenz).
 *
 * Die Videodateien werden später unter public/hero-frames/
 * (hero-mobile.webm / hero-mobile.mp4) abgelegt – solange sie fehlen,
 * fällt der Slot automatisch auf die Porträt-Karte zurück, die Optik
 * bleibt bis dahin unverändert.
 */
export function HeroMobileMedia({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <DoctorPortrait
        alt={arzt.portraitAlt}
        priority
        className={cn("rounded-2xl", className)}
      />
    );
  }

  return (
    <video
      className={cn("rounded-2xl bg-deep object-cover", className)}
      poster={POSTER_PATH}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="Stimmungsvideo der Praxis"
    >
      <source src={MOBILE_VIDEO_WEBM} type="video/webm" />
      {/* onError auf der LETZTEN Quelle: feuert, wenn keine Quelle spielbar ist */}
      <source
        src={MOBILE_VIDEO_MP4}
        type="video/mp4"
        onError={() => setFailed(true)}
      />
    </video>
  );
}
