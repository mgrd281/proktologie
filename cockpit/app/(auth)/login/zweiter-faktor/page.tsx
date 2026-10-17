"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { safeNext } from "@/lib/auth/next";
import { AuthCard, darkInput, darkLabel, darkPrimary } from "../../AuthCard";

type Failure = { text: string; restart?: boolean };

/** Better-Auth-Fehler in Sätze, mit denen man weiterkommt. */
function failure(error: { code?: string; status: number }, backup: boolean): Failure {
  if (error.code === "INVALID_TWO_FACTOR_COOKIE") return { text: "Die Anmeldung ist abgelaufen. Bitte noch einmal mit Passwort anmelden.", restart: true };
  if (error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") return { text: "Zu viele falsche Codes. Bitte noch einmal mit Passwort anmelden.", restart: true };
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED") return { text: "Zu viele falsche Codes – die Anmeldung ist für 15 Minuten gesperrt." };
  if (error.status === 429) return { text: "Zu viele Versuche – bitte kurz warten." };
  return { text: backup ? "Dieser Backup-Code ist nicht gültig." : "Der Code ist nicht gültig. Bitte den aktuellen Code aus der App eingeben." };
}

/**
 * Zweiter Faktor nach der Passwort-Anmeldung.
 * - Sechs Ziffern aus der App prüfen sich sofort, ohne Extra-Klick.
 * - „Diesem Gerät vertrauen“ ist eine bewusste Wahl (früher still an):
 *   30 Tage ohne Code, nur für eigene oder fest zugeteilte Geräte.
 */
function TwoFactorForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get("weiter"));
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  const verify = async (value: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const r = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: value.trim(), trustDevice: trust })
      : await authClient.twoFactor.verifyTotp({ code: value.replace(/\s/g, ""), trustDevice: trust });
    if (r.error) {
      sending.current = false;
      setBusy(false);
      setError(failure(r.error, backup));
      setCode("");
      input.current?.focus();
      return;
    }
    // Bleibt „Prüfen …“, bis die Zielseite da ist
    router.replace(next);
    router.refresh();
  };

  const onChange = (value: string) => {
    setCode(value);
    if (!backup && /^\d{6}$/.test(value.replace(/\s/g, ""))) void verify(value);
  };

  const toggle = () => {
    setBackup((b) => !b);
    setCode("");
    setError(null);
    input.current?.focus();
  };

  return (
    <AuthCard eyebrow="Zweiter Faktor" title={backup ? "Backup-Code" : "Code aus der App"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="space-y-4"
        noValidate
      >
        <div>
          <label htmlFor="code" className={darkLabel}>
            {backup ? "Einer Ihrer Backup-Codes" : "6-stelliger Code"}
          </label>
          <input
            ref={input}
            id="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            pattern={backup ? undefined : "[0-9 ]*"}
            required
            value={code}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className={`${darkInput} tnum text-center text-[22px] tracking-[0.3em]`}
            autoFocus
          />
          {/* Direkt am Feld: Dort geht es nach einem falschen Code weiter */}
          {error && (
            <p id="code-error" role="alert" className="mt-2 text-[13px] leading-relaxed text-[#f4a5a5]">
              {error.text}{" "}
              {error.restart && (
                <Link href={`/login?weiter=${encodeURIComponent(next)}`} className="font-medium text-cream underline underline-offset-4">
                  Zur Anmeldung
                </Link>
              )}
            </p>
          )}
        </div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-[14px] text-cream">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand-fill)]" />
          <span>
            <span className="block font-medium">Diesem Gerät vertrauen</span>
            <span className="mt-0.5 block text-[12px] text-cream/75">30 Tage ohne Code auf diesem Gerät – nur an eigenen oder fest zugeteilten Geräten.</span>
          </span>
        </label>
        <button type="submit" disabled={busy} className={darkPrimary}>
          {busy ? "Prüfen …" : "Bestätigen"}
        </button>
        <button type="button" onClick={toggle} className="min-h-11 w-full py-2 text-center text-[13px] text-cream/75 underline-offset-4 hover:text-cream hover:underline">
          {backup ? "Code aus der Authenticator-App verwenden" : "Keinen Zugriff auf die App? Backup-Code verwenden"}
        </button>
      </form>
      <p className="mt-6 border-t border-white/10 pt-4 text-[13px] text-cream/75">Zugang verloren? Bitte an die Praxisleitung wenden.</p>
    </AuthCard>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  );
}
