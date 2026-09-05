"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AuthCard, darkInput, darkLabel, darkPrimary } from "../../AuthCard";

function TwoFactorForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("weiter")?.startsWith("/") ? sp.get("weiter")! : "/";
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: true });
    setBusy(false);
    if (r.error) {
      setError("Der Code ist nicht gültig.");
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthCard eyebrow="Zweiter Faktor" title={backup ? "Backup-Code" : "Code aus der App"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="code" className={darkLabel}>
            {backup ? "Einer Ihrer Backup-Codes" : "6-stelliger Code"}
          </label>
          <input
            id="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            pattern={backup ? undefined : "[0-9 ]*"}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${darkInput} tnum text-center text-[22px] tracking-[0.3em]`}
            data-autofocus
          />
        </div>
        <button type="submit" disabled={busy} className={darkPrimary}>
          {busy ? "Prüfen …" : "Bestätigen"}
        </button>
        <button type="button" onClick={() => setBackup((b) => !b)} className="w-full py-2 text-center text-[13px] text-cream/60 underline-offset-4 hover:text-cream hover:underline">
          {backup ? "Code aus der Authenticator-App verwenden" : "Keinen Zugriff auf die App? Backup-Code verwenden"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-[13px] text-[#f4a5a5]">
          {error}
        </p>
      )}
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
