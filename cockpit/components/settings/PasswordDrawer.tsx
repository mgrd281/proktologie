"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Bits";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

const MIN_LENGTH = 12;

type Errors = { current?: string; next?: string; repeat?: string; form?: string };

/**
 * Passwort ändern, bestätigt mit dem bisherigen. Vorausgewählt enden dabei
 * alle anderen Anmeldungen – etwa am Praxis-PC, an dem jemand das alte
 * Passwort gesehen haben könnte. Passkeys und App bleiben, wie sie sind.
 * Der Aufruf läuft über Better Auth und dessen Bremse gegen Rateversuche.
 */
export function PasswordDrawer({ email, onClose }: { email: string; onClose: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [others, setOthers] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    if (!current) found.current = "Bitte das bisherige Passwort eingeben.";
    if (next.length < MIN_LENGTH) found.next = `Mindestens ${MIN_LENGTH} Zeichen.`;
    else if (next === current) found.next = "Bitte ein anderes als das bisherige Passwort wählen.";
    else if (repeat !== next) found.repeat = "Die beiden neuen Passwörter sind nicht gleich.";
    setErrors(found);
    if (found.current) return currentRef.current?.focus();
    if (found.next) return nextRef.current?.focus();
    if (found.repeat) return repeatRef.current?.focus();

    setBusy(true);
    const r = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: others });
    setBusy(false);
    if (r.error) {
      if (r.error.code === "INVALID_PASSWORD") {
        setErrors({ current: "Das bisherige Passwort stimmt nicht." });
        currentRef.current?.focus();
        return;
      }
      setErrors({ form: r.error.status === 429 ? "Zu viele Versuche – bitte kurz warten." : "Das Passwort wurde nicht geändert. Bitte erneut versuchen." });
      return;
    }
    toast({ title: "Passwort geändert", description: others ? "Alle anderen Geräte wurden abgemeldet." : undefined, tone: "ok" });
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Sicherheit"
      title="Passwort ändern"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form="password-form" loading={busy} icon="check">
            Passwort ändern
          </Button>
        </>
      }
    >
      <form id="password-form" onSubmit={submit} className="space-y-5" noValidate>
        <p className="text-[14px] leading-relaxed text-text-muted">Gilt für die Anmeldung mit Passwort. Passkeys und Authenticator-App bleiben, wie sie sind.</p>
        {/* Für Passwort-Manager: zu welchem Konto das neue Passwort gehört */}
        <input type="text" name="username" autoComplete="username" value={email} readOnly className="hidden" />
        <Field label="Bisheriges Passwort" required error={errors.current}>
          {(id, describedBy) => (
            <Input
              ref={currentRef}
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              aria-required
              aria-describedby={describedBy}
              invalid={Boolean(errors.current)}
              data-autofocus
            />
          )}
        </Field>
        <Field label="Neues Passwort" required hint="Mindestens 12 Zeichen. Ein kurzer Satz ist sicher und gut zu merken." error={errors.next}>
          {(id, describedBy) => (
            <Input
              ref={nextRef}
              id={id}
              type="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-required
              aria-describedby={describedBy}
              invalid={Boolean(errors.next)}
            />
          )}
        </Field>
        <Field label="Neues Passwort wiederholen" required error={errors.repeat}>
          {(id, describedBy) => (
            <Input
              ref={repeatRef}
              id={id}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              aria-required
              aria-describedby={describedBy}
              invalid={Boolean(errors.repeat)}
            />
          )}
        </Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-[14px] text-text">
          <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand-fill)]" />
          <span>
            <span className="block font-medium">Auf allen anderen Geräten abmelden</span>
            <span className="mt-0.5 block text-[12px] text-text-muted">Empfohlen. Dieses Gerät bleibt angemeldet.</span>
          </span>
        </label>
        {errors.form && (
          <div role="alert">
            <Notice tone="danger">{errors.form}</Notice>
          </div>
        )}
      </form>
    </Drawer>
  );
}
