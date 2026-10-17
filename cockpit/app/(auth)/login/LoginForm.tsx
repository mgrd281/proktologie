"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth/client";
import { Icon } from "@/components/ui/Icon";
import { AuthCard, darkInput, darkLabel, darkPrimary, darkSecondary } from "../AuthCard";

const noChanges = () => () => {};

export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"passkey" | "password">("passkey");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ändert sich nicht, solange die Seite offen ist – auf dem Server erst einmal „ja“
  const passkeySupported = useSyncExternalStore(
    noChanges,
    () => "PublicKeyCredential" in window,
    () => true,
  );

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  const withPasskey = async () => {
    setBusy(true);
    setError(null);
    const r = await authClient.signIn.passkey();
    setBusy(false);
    if (r?.error) {
      setError("Passkey-Anmeldung nicht möglich. Bitte erneut versuchen oder mit Passwort anmelden.");
      return;
    }
    finish();
  };

  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) {
      setError(r.error.status === 429 ? "Zu viele Versuche – bitte kurz warten." : "E-Mail oder Passwort stimmen nicht.");
      return;
    }
    const data = r.data as { twoFactorRedirect?: boolean } | null;
    if (data?.twoFactorRedirect) {
      router.push(`/login/zweiter-faktor?weiter=${encodeURIComponent(next)}`);
      return;
    }
    finish();
  };

  return (
    <AuthCard eyebrow="Anmeldung" title={<>Willkommen<span className="text-accent">.</span></>}>
      {reason === "frisch" && (
        <p className="mb-5 rounded-xl border-l-2 border-accent bg-white/[0.05] px-4 py-3 text-[13px] leading-relaxed text-cream/85">
          Für diese Aktion ist eine frische Anmeldung nötig. Bitte einmal neu anmelden.
        </p>
      )}
      {mode === "passkey" ? (
        <div className="space-y-3">
          <button type="button" onClick={withPasskey} disabled={busy || !passkeySupported} className={darkPrimary} autoFocus>
            <Icon name="key" size={18} />
            Mit Passkey anmelden
          </button>
          {!passkeySupported && <p className="text-[12px] text-cream/75">Dieser Browser unterstützt keine Passkeys.</p>}
          <button type="button" onClick={() => setMode("password")} className={darkSecondary}>
            Mit Passwort anmelden
          </button>
        </div>
      ) : (
        <form onSubmit={withPassword} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className={darkLabel}>
              E-Mail-Adresse
            </label>
            <input id="email" name="email" type="email" autoComplete="username webauthn" required value={email} onChange={(e) => setEmail(e.target.value)} className={darkInput} autoFocus />
          </div>
          <div>
            <label htmlFor="password" className={darkLabel}>
              Passwort
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={darkInput} />
          </div>
          <button type="submit" disabled={busy} className={darkPrimary}>
            {busy ? "Anmelden …" : "Anmelden"}
            {!busy && <Icon name="arrow-right" size={16} />}
          </button>
          <button type="button" onClick={() => setMode("passkey")} className="min-h-11 w-full py-2 text-center text-[13px] text-cream/75 underline-offset-4 hover:text-cream hover:underline">
            Zurück zum Passkey
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-[13px] leading-relaxed text-[#f4a5a5]">
          {error}
        </p>
      )}
      <p className="mt-6 border-t border-white/10 pt-4 text-[13px] text-cream/75">Zugang verloren? Bitte an die Praxisleitung wenden.</p>
    </AuthCard>
  );
}
