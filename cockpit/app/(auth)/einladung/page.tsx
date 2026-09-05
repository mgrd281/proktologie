"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { acceptInviteAction } from "@/app/actions/users";
import { Icon } from "@/components/ui/Icon";
import { AuthCard, darkInput, darkLabel, darkPrimary } from "../AuthCard";

/**
 * Das Einladungs-Token steht im URL-Fragment (#…) und erreicht den Server
 * erst durch die bewusste Übergabe in der Server Action – nie über Logs,
 * Referrer oder Verlauf des Servers.
 */
export default function InvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, "");
    setToken(t || null);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== password2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await acceptInviteAction({ token, name, password });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace("/sicherheit/einrichten");
    router.refresh();
  };

  if (token === null) {
    return (
      <AuthCard eyebrow="Einladung" title="Kein gültiger Link">
        <p className="text-[14px] leading-relaxed text-cream/75">Dieser Link enthält kein Einladungs-Token. Bitte den vollständigen Link aus der Einladung verwenden.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard eyebrow="Einladung" title={<>Konto anlegen<span className="text-accent">.</span></>}>
      <p className="mb-5 text-[13px] leading-relaxed text-cream/70">
        Sie tragen Ihren eigenen Namen ein – im Cockpit werden keine Personen vorgegeben. Danach richten Sie Passkey und Authenticator-App ein.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className={darkLabel}>
            Vollständiger Name
          </label>
          <input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={darkInput} data-autofocus />
        </div>
        <div>
          <label htmlFor="pw" className={darkLabel}>
            Passwort (mindestens 12 Zeichen)
          </label>
          <input id="pw" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className={darkInput} />
        </div>
        <div>
          <label htmlFor="pw2" className={darkLabel}>
            Passwort wiederholen
          </label>
          <input id="pw2" type="password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} className={darkInput} />
        </div>
        <button type="submit" disabled={busy} className={darkPrimary}>
          {busy ? "Anlegen …" : "Konto anlegen"}
          {!busy && <Icon name="arrow-right" size={16} />}
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
