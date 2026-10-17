"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/**
 * Sitzungswächter. Die Anmeldung endet 60 Minuten nach dem letzten
 * Speichern bzw. der letzten Aktion (gleitend, lib/auth/actor.ts) und
 * spätestens nach der absoluten Obergrenze. Früher scheiterte
 * dann die nächste Aktion still mit „Bitte anmelden.“ – ohne Ausweg, und wer
 * neu lud, verlor seine Eingaben. Jetzt:
 * - 5 Minuten vorher ein Hinweis mit „Angemeldet bleiben“;
 * - danach „Neu anmelden“ in einem neuen Tab. Diese Seite samt Eingaben bleibt
 *   offen und arbeitet weiter, sobald die neue Anmeldung steht.
 * Abgefragt wird, ohne die Sitzung zu verlängern (disableRefresh) – sonst
 * hielte der Wächter sie selbst am Leben.
 */
const WARN_MS = 5 * 60_000;

type Session = { expiresAt: number; absolute: boolean };

async function readSession(refresh: boolean, absoluteMs: number): Promise<Session | null | "error"> {
  try {
    const q = refresh ? "disableCookieCache=true" : "disableCookieCache=true&disableRefresh=true";
    const r = await fetch(`/api/auth/get-session?${q}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return "error";
    const j = (await r.json()) as { session?: { expiresAt: string; createdAt: string } } | null;
    if (!j?.session) return null;
    const idle = new Date(j.session.expiresAt).getTime();
    const absolute = new Date(j.session.createdAt).getTime() + absoluteMs;
    // Ablauf in Uhrzeit dieses Geräts umrechnen – geht dessen Uhr falsch, käme der Hinweis sonst zu früh oder zu spät
    const serverNow = Date.parse(r.headers.get("date") ?? "");
    const skew = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
    return { expiresAt: Math.min(idle, absolute) - skew, absolute: absolute <= idle };
  } catch {
    // Netz weg ist keine Abmeldung – beim nächsten Mal wieder fragen
    return "error";
  }
}

const minutes = (ms: number) => {
  const n = Math.max(1, Math.ceil(ms / 60_000));
  return n === 1 ? "1 Minute" : `${n} Minuten`;
};

export function SessionGuard({ absoluteSeconds }: { absoluteSeconds: number }) {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [staying, setStaying] = useState(false);
  const wasExpired = useRef(false);

  const check = useCallback(async () => {
    const s = await readSession(false, absoluteSeconds * 1000);
    if (s === "error") return;
    setNow(Date.now());
    setSession(s);
  }, [absoluteSeconds]);

  const left = session ? session.expiresAt - now : 0;
  const phase = session === undefined ? "ok" : session === null || left <= 0 ? "expired" : left <= WARN_MS ? "warn" : "ok";

  // Jede Minute fragen, kurz vor und nach dem Ablauf alle 15 s – und sofort,
  // wenn der Tab wieder im Vordergrund ist (z. B. nach dem Anmelden im neuen Tab)
  useEffect(() => {
    const id = window.setInterval(() => void check(), phase === "ok" ? 60_000 : 15_000);
    const onBack = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("cockpit:session-check", onBack);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("cockpit:session-check", onBack);
    };
  }, [check, phase]);

  // Wieder angemeldet → kurz bestätigen
  useEffect(() => {
    if (phase === "expired") wasExpired.current = true;
    else if (phase === "ok" && wasExpired.current) {
      wasExpired.current = false;
      toast({ title: "Wieder angemeldet", description: "Sie können hier weiterarbeiten.", tone: "ok" });
    }
  }, [phase, toast]);

  if (phase === "ok") return null;

  const stay = async () => {
    setStaying(true);
    const s = await readSession(true, absoluteSeconds * 1000);
    setStaying(false);
    if (s === "error") {
      toast({ title: "Keine Verbindung", description: "Bitte gleich noch einmal versuchen.", tone: "danger" });
      return;
    }
    setNow(Date.now());
    setSession(s);
  };
  const loginHref = `/login?weiter=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  const relogin = (
    <a href={loginHref} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-fill px-6 text-sm font-semibold tracking-wide text-deep transition-colors hover:bg-brand-fill-hover">
      <Icon name="external" size={16} />
      Neu anmelden
      <span className="sr-only">(öffnet einen neuen Tab)</span>
    </a>
  );

  return (
    // data-overlay-free: auch bei offenem Drawer per Tab erreichbar (Overlay.tsx)
    <div data-overlay-free className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md md:right-6 md:left-auto md:mx-0">
      <div role={phase === "expired" ? "alert" : "status"} className="elevated rounded-2xl border border-line bg-surface-raised p-4 text-text">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon name={phase === "expired" ? "lock" : "clock"} size={16} className={phase === "expired" ? "text-danger" : "text-warn"} />
          {phase === "expired" ? "Sie wurden abgemeldet" : "Gleich werden Sie abgemeldet"}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
          {phase === "expired"
            ? "Ihre Eingaben auf dieser Seite bleiben erhalten. Melden Sie sich in einem neuen Tab an – danach geht es hier weiter."
            : session?.absolute
              ? `Aus Sicherheitsgründen endet die Anmeldung nach ${Math.round(absoluteSeconds / 3600)} Stunden – in ${minutes(left)}. Bitte offene Eingaben speichern.`
              : `Ihre Anmeldung endet in ${minutes(left)}.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {phase === "warn" && !session?.absolute ? (
            <Button variant="primary" icon="check" loading={staying} onClick={() => void stay()}>
              Angemeldet bleiben
            </Button>
          ) : (
            relogin
          )}
        </div>
      </div>
    </div>
  );
}
