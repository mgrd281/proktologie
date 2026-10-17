"use client";

import { filmFrameUrl } from "@/lib/cinema/sources";
import { useEffect, useState } from "react";

interface Row {
  ok: boolean | null;
  text: string;
}

function browserName(ua: string): string {
  const m =
    ua.match(/Edg\/(\d+)/) ? `Microsoft Edge ${ua.match(/Edg\/(\d+)/)![1]}` :
    ua.match(/OPR\/(\d+)/) ? `Opera ${ua.match(/OPR\/(\d+)/)![1]}` :
    ua.match(/Firefox\/(\d+)/) ? `Firefox ${ua.match(/Firefox\/(\d+)/)![1]}` :
    ua.match(/Chrome\/(\d+)/) ? `Chrome ${ua.match(/Chrome\/(\d+)/)![1]}` :
    ua.match(/Version\/(\d+).*Safari/) ? `Safari ${ua.match(/Version\/(\d+)/)![1]}` :
    /Trident|MSIE/.test(ua) ? "Internet Explorer" :
    "unbekannt";
  const os = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows (älter)" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "unbekannt";
  return `${m} auf ${os}`;
}

const yes = (ok: boolean, good: string, bad: string): Row => ({ ok, text: ok ? good : bad });

/** Lädt das erste Filmbild und dekodiert es so, wie es die Kamerafahrt tut. */
async function probeFrame(path: string): Promise<Row> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { ok: false, text: `Das erste Filmbild konnte nicht geladen werden (Antwort ${res.status}).` };
    const blob = await res.blob();
    if (typeof createImageBitmap !== "function") {
      return { ok: false, text: "Das Filmbild wurde geladen, aber der Browser kann es nicht für die Kamerafahrt aufbereiten." };
    }
    const bmp = await createImageBitmap(blob);
    const size = `${bmp.width}×${bmp.height}`;
    bmp.close();
    return { ok: true, text: `Das erste Filmbild wurde geladen und aufbereitet (${size} Pixel).` };
  } catch (e) {
    return { ok: false, text: `Das erste Filmbild konnte nicht aufbereitet werden (${e instanceof Error ? e.name : "Fehler"}).` };
  }
}

export function TechnikCheck() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const css = (p: string) => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports(p);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const base: Row[] = [
      { ok: null, text: `Browser: ${browserName(navigator.userAgent)}.` },
      { ok: null, text: `Fenster: ${window.innerWidth} × ${window.innerHeight} Pixel, Bildschirm-Skalierung ${Math.round(window.devicePixelRatio * 100)} %.` },
      reduced
        ? { ok: null, text: "„Animationen reduzieren“ ist in Windows/Browser eingeschaltet. Die Startseite zeigt deshalb die ruhige Fassung ohne Kamerafahrt – das ist so gewollt." }
        : { ok: true, text: "Animationen sind erlaubt – die Startseite zeigt die Kamerafahrt." },
      yes(css("height: 100dvh"), "Der Browser kennt die moderne Höhenangabe der Kamerafahrt.", "Der Browser kennt die moderne Höhenangabe nicht – die Startseite nutzt dafür jetzt eine ältere Ersatzangabe."),
      yes(css("color: color-mix(in srgb, red, blue)"), "Der Browser kann die Farben der Seite richtig mischen.", "Der Browser kann die Farben der Seite nicht mischen – manche Flächen erscheinen blass oder weiß. Bitte den Browser aktualisieren."),
      yes(typeof createImageBitmap === "function", "Der Browser kann Filmbilder schnell aufbereiten.", "Der Browser kann Filmbilder nicht schnell aufbereiten – die Startseite zeigt dann ein Standbild."),
      yes(!!document.createElement("canvas").getContext("2d"), "Der Browser kann die Kamerafahrt zeichnen.", "Der Browser kann nicht zeichnen – die Startseite zeigt dann ein Standbild."),
    ];
    setRows([...base, { ok: null, text: "Das erste Filmbild wird geprüft …" }]);
    void probeFrame(filmFrameUrl(mobile ? "mobile" : "desktop", 1)).then((r) =>
      setRows([...base, r]),
    );
  }, []);

  if (!rows) return null;
  return (
    <ul className="mt-8 space-y-3" data-testid="technik">
      {rows.map((r, i) => (
        <li key={i} className="flex gap-3 rounded-xl bg-white p-4 text-lg leading-snug text-ink">
          <span aria-hidden="true" className={r.ok === null ? "text-ink/50" : r.ok ? "text-primary-deep" : "text-red-700"}>
            {r.ok === null ? "•" : r.ok ? "✓" : "✗"}
          </span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}
