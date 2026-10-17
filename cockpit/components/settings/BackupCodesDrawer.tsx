"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Bits";
import { Dialog, Drawer } from "@/components/ui/Overlay";
import { BackupCodes } from "./BackupCodes";

/**
 * Neue Backup-Codes – früher gab es sie nur einmal bei der Einrichtung.
 * Bestätigt mit dem Passwort; die neuen ersetzen alle bisherigen. Wer das
 * Fenster schließt, ohne die Codes gesichert zu haben, wird gefragt.
 */
export function BackupCodesDrawer({ email, name, onClose }: { email: string; name: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedError, setSavedError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError("Bitte das Passwort eingeben.");
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    const r = await authClient.twoFactor.generateBackupCodes({ password });
    setBusy(false);
    if (r.error) {
      setPasswordError(
        r.error.code === "INVALID_PASSWORD"
          ? "Das Passwort stimmt nicht."
          : r.error.status === 429
            ? "Zu viele Versuche – bitte kurz warten."
            : "Es wurden keine neuen Codes erzeugt. Bitte erneut versuchen.",
      );
      passwordRef.current?.focus();
      return;
    }
    setPassword("");
    setCodes(r.data.backupCodes);
  };

  const finish = () => {
    if (!saved) {
      setSavedError("Bitte die Codes zuerst sichern und ankreuzen.");
      return;
    }
    onClose();
  };
  const close = () => (codes && !saved ? setConfirmClose(true) : onClose());

  return (
    <>
      <Drawer
        open
        onClose={close}
        eyebrow="Sicherheit"
        title="Neue Backup-Codes"
        footer={
          codes ? (
            <Button variant="primary" icon="check" onClick={finish}>
              Fertig
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Abbrechen
              </Button>
              <Button variant="primary" type="submit" form="backup-codes-form" loading={busy}>
                Neue Codes erzeugen
              </Button>
            </>
          )
        }
      >
        {codes ? (
          <div className="space-y-5">
            <Notice tone="warn">Nur jetzt sichtbar – bitte kopieren oder drucken. Die bisherigen Codes gelten nicht mehr.</Notice>
            <BackupCodes
              codes={codes}
              who={name}
              saved={saved}
              onSaved={(v) => {
                setSaved(v);
                if (v) setSavedError(undefined);
              }}
              error={savedError}
            />
          </div>
        ) : (
          <form id="backup-codes-form" onSubmit={generate} className="space-y-5" noValidate>
            <p className="text-[14px] leading-relaxed text-text-muted">
              Backup-Codes helfen, wenn die Authenticator-App nicht greifbar ist – jeder gilt einmal. Neue Codes ersetzen alle bisherigen. Zur Bestätigung bitte das Passwort eingeben.
            </p>
            <input type="text" name="username" autoComplete="username" value={email} readOnly className="hidden" />
            <Field label="Passwort" required error={passwordError}>
              {(id, describedBy) => (
                <Input
                  ref={passwordRef}
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-required
                  aria-describedby={describedBy}
                  invalid={Boolean(passwordError)}
                  data-autofocus
                />
              )}
            </Field>
          </form>
        )}
      </Drawer>
      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Codes noch nicht gesichert?"
        cancelLabel="Zurück"
        confirmLabel="Trotzdem schließen"
        danger
        onConfirm={onClose}
      >
        Die neuen Codes werden danach nicht mehr angezeigt, die bisherigen gelten nicht mehr. Neue Codes lassen sich jederzeit wieder erzeugen.
      </Dialog>
    </>
  );
}
