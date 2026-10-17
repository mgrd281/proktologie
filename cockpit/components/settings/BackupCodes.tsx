"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Backup-Codes: Sie erscheinen genau einmal. Deshalb kopieren oder drucken,
 * dann „Ich habe sie gespeichert“ ankreuzen – erst danach geht es weiter.
 * Gedruckt wird ein eigenes Blatt nur mit den Codes, ohne Oberfläche.
 * `dark` für die Einrichtung auf der dunklen Anmeldebühne.
 */
export function BackupCodes({
  codes,
  who,
  saved,
  onSaved,
  error,
  dark,
}: {
  codes: string[];
  who: string;
  saved: boolean;
  onSaved: (saved: boolean) => void;
  /** z. B. „Bitte zuerst sichern und ankreuzen.“ – erscheint am Kästchen */
  error?: string;
  dark?: boolean;
}) {
  const errId = useId();
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  const darkButton =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/25 px-4 text-[14px] font-medium text-cream transition-colors hover:border-accent hover:text-accent";

  return (
    <div>
      <ol className={cn("tnum grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[15px]", dark ? "text-cream" : "text-text")}>
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {dark ? (
          <>
            <button type="button" onClick={copy} className={darkButton}>
              <Icon name="copy" size={16} /> Kopieren
            </button>
            <button type="button" onClick={() => printCodes(codes, who)} className={darkButton}>
              <Icon name="printer" size={16} /> Drucken
            </button>
          </>
        ) : (
          <>
            <Button size="sm" icon="copy" onClick={copy}>
              Kopieren
            </Button>
            <Button size="sm" icon="printer" onClick={() => printCodes(codes, who)}>
              Drucken
            </Button>
          </>
        )}
        <span aria-live="polite" className={cn("text-[13px]", dark ? "text-cream/75" : "text-text-muted")}>
          {copied === "ok" ? "Kopiert." : copied === "fail" ? "Kopieren nicht möglich – bitte abschreiben oder drucken." : ""}
        </span>
      </div>
      <label className={cn("mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-medium", dark ? "text-cream" : "text-text")}>
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => onSaved(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className="size-5 shrink-0 accent-[var(--brand-fill)]"
        />
        Ich habe sie gespeichert
      </label>
      {error && (
        <p id={errId} role="alert" className={cn("mt-1 text-[13px]", dark ? "text-[#f4a5a5]" : "text-danger")}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Eigenes Blatt in einem unsichtbaren Rahmen: nur die Codes, kein Menü, keine Termine. */
function printCodes(codes: string[], who: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
  document.body.append(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.documentElement.lang = "de";
  doc.title = "Backup-Codes · Praxis-Cockpit";
  const style = doc.createElement("style");
  style.textContent =
    "body{font:14px/1.5 system-ui,sans-serif;color:#000;margin:18mm}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px}ol{columns:2;font:16px/2.2 ui-monospace,monospace;padding-left:1.6em}";
  doc.head.append(style);
  const title = doc.createElement("h1");
  title.textContent = "Praxis-Cockpit · Backup-Codes";
  const meta = doc.createElement("p");
  meta.textContent = `${who} · erstellt am ${new Date().toLocaleDateString("de-DE")}`;
  const list = doc.createElement("ol");
  for (const code of codes) {
    const li = doc.createElement("li");
    li.textContent = code;
    list.append(li);
  }
  const note = doc.createElement("p");
  note.textContent = "Jeder Code gilt genau einmal – für den Fall, dass die Authenticator-App nicht greifbar ist. Bitte verschlossen aufbewahren.";
  doc.body.append(title, meta, list, note);
  win.addEventListener("afterprint", () => frame.remove());
  win.focus();
  win.print();
  // Manche Browser melden „afterprint“ nicht – spätestens dann aufräumen
  window.setTimeout(() => frame.remove(), 120_000);
}
