"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth/client";
import { Icon } from "@/components/ui/Icon";
import { AuthCard, darkInput, darkLabel, darkPrimary, darkSecondary } from "../../AuthCard";

export function SetupWizard({ hasPasskey, hasTotp, name }: { hasPasskey: boolean; hasTotp: boolean; name: string }) {
  const router = useRouter();
  const [passkeyDone, setPasskeyDone] = useState(hasPasskey);
  const [totpDone, setTotpDone] = useState(hasTotp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TOTP-Anmeldung
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!totpUri) return;
    QRCode.toDataURL(totpUri, { margin: 1, width: 200, color: { dark: "#17251b", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [totpUri]);

  useEffect(() => {
    if (passkeyDone && totpDone) {
      router.replace("/");
      router.refresh();
    }
  }, [passkeyDone, totpDone, router]);

  const addPasskey = async () => {
    setBusy(true);
    setError(null);
    const r = await authClient.passkey.addPasskey({ name: `${name} · ${new Date().toLocaleDateString("de-DE")}` });
    setBusy(false);
    if (r?.error) {
      setError("Der Passkey konnte nicht angelegt werden. Bitte erneut versuchen.");
      return;
    }
    setPasskeyDone(true);
  };

  const startTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.twoFactor.enable({ password, issuer: "Praxis-Cockpit" });
    setBusy(false);
    if (r.error) {
      setError("Das Passwort stimmt nicht.");
      return;
    }
    if (r.data.method !== "totp") {
      setError("Unerwartete Antwort des Servers.");
      return;
    }
    setTotpUri(r.data.totpURI);
    setBackupCodes(r.data.backupCodes);
    setPassword("");
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setBusy(false);
    if (r.error) {
      setError("Der Code ist nicht gültig – bitte den aktuellen Code aus der App eingeben.");
      return;
    }
    setTotpDone(true);
  };

  const step = !passkeyDone ? 1 : 2;

  return (
    <AuthCard eyebrow={`Sicherheit · Schritt ${step} von 2`} title={step === 1 ? "Passkey anlegen" : "Zweiter Faktor"}>
      <ol className="mb-6 flex gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
        <li className={passkeyDone ? "text-accent" : "text-cream"}>{passkeyDone ? "✓ " : "01 "}Passkey</li>
        <li className="text-cream/60" aria-hidden="true">—</li>
        <li className={totpDone ? "text-accent" : step === 2 ? "text-cream" : "text-cream/65"}>{totpDone ? "✓ " : "02 "}Authenticator</li>
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-cream/75">
            Ein Passkey ersetzt Passwörter durch Fingerabdruck, Gesicht oder Geräte-PIN – phishing-sicher und an dieses Gerät gebunden. Sie können später weitere Geräte hinzufügen.
          </p>
          <button type="button" onClick={addPasskey} disabled={busy} className={darkPrimary} data-autofocus>
            <Icon name="key" size={18} />
            {busy ? "Warte auf Gerät …" : "Passkey jetzt anlegen"}
          </button>
        </div>
      )}

      {step === 2 && !totpUri && (
        <form onSubmit={startTotp} className="space-y-4" noValidate>
          <p className="text-[14px] leading-relaxed text-cream/75">
            Als Rückfall bei Passwort-Anmeldung dient ein Einmalcode aus einer Authenticator-App (z. B. Apple Passwörter, Google Authenticator, 1Password). Zum Start bitte das Passwort bestätigen.
          </p>
          <div>
            <label htmlFor="pw" className={darkLabel}>
              Passwort
            </label>
            <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={darkInput} data-autofocus />
          </div>
          <button type="submit" disabled={busy} className={darkPrimary}>
            {busy ? "Vorbereiten …" : "QR-Code anzeigen"}
          </button>
        </form>
      )}

      {step === 2 && totpUri && (
        <form onSubmit={verifyTotp} className="space-y-5" noValidate>
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-white p-2">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR-Code für die Authenticator-App" width={160} height={160} />
              ) : (
                <div className="size-40" />
              )}
            </div>
            <div className="text-[13px] leading-relaxed text-cream/75">
              <p>QR-Code mit der App scannen, dann den aktuellen 6-stelligen Code eingeben.</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-cream/60 underline-offset-4 hover:underline">Code manuell eingeben</summary>
                <code className="mt-2 block break-all rounded-lg bg-white/[0.06] p-2 text-[11px] text-cream/80">{new URL(totpUri).searchParams.get("secret")}</code>
              </details>
            </div>
          </div>
          <div>
            <label htmlFor="code" className={darkLabel}>
              Code aus der App
            </label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className={`${darkInput} tnum text-center text-[22px] tracking-[0.3em]`} data-autofocus />
          </div>
          {backupCodes.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Backup-Codes – jetzt sicher aufbewahren</p>
              <p className="mt-1 text-[12px] text-cream/60">Jeder Code gilt einmal, falls die App nicht verfügbar ist. Sie werden nicht erneut angezeigt.</p>
              <ul className="tnum mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[13px] text-cream">
                {backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="submit" disabled={busy} className={darkPrimary}>
            {busy ? "Prüfen …" : "Aktivieren und ins Cockpit"}
            {!busy && <Icon name="arrow-right" size={16} />}
          </button>
          <button type="button" onClick={() => setTotpUri(null)} className={darkSecondary}>
            Neu beginnen
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-[#f4a5a5]">
          {error}
        </p>
      )}
    </AuthCard>
  );
}
