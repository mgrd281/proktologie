"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createInviteAction, resetSecurityAction, revokeInviteAction, setDisabledAction, setRoleAction } from "@/app/actions/users";
import { ROLES, type Role } from "@/lib/auth/auth-shared";
import { Card, EmptyState, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { useFreshLogin } from "@/components/ui/FreshLogin";
import { Icon } from "@/components/ui/Icon";
import { Dialog, Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  twoFactor: boolean;
  createdAt: string;
}
interface InviteRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = { arzt: "Arzt", empfang: "Empfang", admin: "Administration" };
const ROLE_HELP: Record<Role, string> = {
  empfang: "Termine, Anfragen, Tagesplan – keine Einstellungen.",
  arzt: "Alles am Empfang plus Terminarten, Sprechzeiten, Betrieb.",
  admin: "Zusätzlich Benutzer, Einladungen und Sicherheit.",
};

export function UsersManager({
  me,
  isAdmin,
  users,
  invites,
  openInvite,
  freshLeftMs,
}: {
  me: string;
  isAdmin: boolean;
  users: UserRow[];
  invites: InviteRow[];
  openInvite: boolean;
  /** Restzeit der frischen Anmeldung – Einladen, Rollen, Deaktivieren und Zurücksetzen verlangen sie */
  freshLeftMs: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fresh = useFreshLogin(freshLeftMs);
  const [pending, start] = useTransition();
  // Über ⌘K „Mitarbeitende einladen“ – aber nicht ins Formular, wenn die Anmeldung dafür zu alt ist
  const [drawer, setDrawer] = useState(openInvite && freshLeftMs > 15_000);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("empfang");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Folgenreiche Klicks (Rolle, Deaktivieren, Einladung zurückziehen) erst nach Rückfrage */
  const [confirm, setConfirm] = useState<{ title: string; text: string; label: string; danger?: boolean; run: () => void } | null>(null);

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState icon="users" title="Benutzerverwaltung ist Administration vorbehalten" text="Einladungen, Rollen und Deaktivierungen nimmt ein Konto mit Administrationsrolle vor." compact />
      </Card>
    );
  }

  const invite = () =>
    start(async () => {
      setError(null);
      const r = await createInviteAction({ email, role });
      if (!r.ok) {
        if (!fresh.handled(r.error)) setError(r.error);
        return;
      }
      setLink(r.data.link);
      router.refresh();
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link kopiert", tone: "ok" });
    } catch {
      toast({ title: "Kopieren nicht möglich – bitte manuell markieren", tone: "warn" });
    }
  };

  const changeRole = (u: UserRow, next: Role) =>
    start(async () => {
      const r = await setRoleAction({ userId: u.id, role: next });
      if (!r.ok && fresh.handled(r.error)) return;
      toast(r.ok ? { title: `${u.name}: ${ROLE_LABEL[next]}`, tone: "ok" } : { title: "Nicht geändert", description: r.error, tone: "danger" });
      router.refresh();
    });

  const toggle = (u: UserRow) =>
    start(async () => {
      const r = await setDisabledAction({ userId: u.id, disabled: !u.banned });
      if (!r.ok && fresh.handled(r.error)) return;
      toast(r.ok ? { title: `${u.name} ${u.banned ? "aktiviert" : "deaktiviert"}`, tone: u.banned ? "ok" : "warn" } : { title: "Nicht geändert", description: r.error, tone: "danger" });
      router.refresh();
    });

  const reset = (u: UserRow) =>
    start(async () => {
      const r = await resetSecurityAction({ userId: u.id });
      if (!r.ok && fresh.handled(r.error)) return;
      toast(
        r.ok
          ? { title: `${u.name}: Sicherheit zurückgesetzt`, description: "Bei der nächsten Anmeldung mit Passwort richtet die Person Passkey und App neu ein.", tone: "ok" }
          : { title: "Nicht zurückgesetzt", description: r.error, tone: "danger" },
      );
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-xl text-[13px] leading-relaxed text-text-muted">
          Konten entstehen nur per Einladung. Der Link enthält ein einmaliges Token, gilt 72 Stunden und verrät nichts über die Person – den Namen trägt sie selbst ein. Nach der Annahme sind Passkey und Authenticator Pflicht.
        </p>
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() =>
            fresh.ensure(() => {
              setLink(null);
              setDrawer(true);
            })
          }
        >
          Einladen
        </Button>
      </div>

      <DataTable<UserRow>
        caption="Konten"
        rows={users}
        rowKey={(u) => u.id}
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (u) => (
              <span className="flex items-center gap-2 font-medium text-text">
                {u.name}
                {u.id === me && <span className="text-[11px] font-normal text-text-faint">(Sie)</span>}
              </span>
            ),
          },
          { key: "email", header: "E-Mail", hideBelow: "md", cell: (u) => <span className="text-text-muted">{u.email}</span> },
          {
            key: "role",
            header: "Rolle",
            cell: (u) => (
              <select
                aria-label={`Rolle von ${u.name}`}
                value={u.role}
                disabled={u.id === me || pending}
                onChange={(e) => {
                  const next = e.target.value as Role;
                  fresh.ensure(() =>
                    setConfirm({
                      title: `Rolle von ${u.name} ändern?`,
                      text: `Neue Rolle: ${ROLE_LABEL[next]}.${next === "admin" ? " Administration darf Konten einladen, Rollen ändern und deaktivieren." : ""}`,
                      label: "Rolle ändern",
                      run: () => changeRole(u, next),
                    }),
                  );
                }}
                className="h-8 rounded-lg border border-line bg-surface-raised px-2 text-[13px] text-text disabled:opacity-60"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            ),
          },
          {
            key: "sec",
            header: "Sicherheit",
            hideBelow: "lg",
            cell: (u) => (
              <span className={`flex items-center gap-1.5 text-[12px] ${u.twoFactor ? "text-ok" : "text-warn"}`}>
                <Icon name={u.twoFactor ? "shield" : "alert"} size={14} /> {u.twoFactor ? "2FA aktiv" : "Einrichtung offen"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            align: "right",
            cell: (u) => (
              <span className="flex items-center justify-end gap-2">
                <span className={`text-[12px] ${u.banned ? "text-danger" : "text-text-muted"}`}>{u.banned ? "deaktiviert" : "aktiv"}</span>
                {u.id !== me && (
                  <>
                    <IconButton
                      label="Sicherheit zurücksetzen"
                      icon="shield"
                      size={30}
                      className="max-md:!size-11"
                      disabled={pending}
                      onClick={() =>
                        fresh.ensure(() =>
                          setConfirm({
                            title: `Sicherheit von ${u.name} zurücksetzen?`,
                            text: "Für ein verlorenes Handy oder Gerät: Passkeys und Authenticator-App dieses Kontos werden entfernt, die Person wird überall abgemeldet. Das Passwort bleibt; bei der nächsten Anmeldung richtet sie beides neu ein. Bitte nur, wenn die Bitte sicher von ihr selbst kommt.",
                            label: "Zurücksetzen",
                            danger: true,
                            run: () => reset(u),
                          }),
                        )
                      }
                    />
                    <IconButton
                      label={u.banned ? "Konto aktivieren" : "Konto deaktivieren"}
                      icon={u.banned ? "refresh" : "lock"}
                      size={30}
                      className="max-md:!size-11"
                      disabled={pending}
                      onClick={() =>
                        fresh.ensure(() =>
                          u.banned
                            ? toggle(u)
                            : setConfirm({
                                title: `${u.name} deaktivieren?`,
                                text: "Die Person wird sofort abgemeldet und kann sich nicht mehr anmelden, bis das Konto wieder aktiviert wird.",
                                label: "Deaktivieren",
                                danger: true,
                                run: () => toggle(u),
                              }),
                        )
                      }
                    />
                  </>
                )}
              </span>
            ),
          },
        ]}
      />

      <Card>
        <Eyebrow>Offene Einladungen</Eyebrow>
        <ul className="mt-3 divide-y divide-line">
          {invites.length === 0 && <li className="py-4 text-[13px] text-text-faint">Keine offenen Einladungen.</li>}
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{i.email}</p>
                <p className="text-[12px] text-text-muted">{ROLE_LABEL[i.role as Role] ?? i.role} · gültig bis {new Date(i.expiresAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <IconButton
                label="Einladung zurückziehen"
                icon="trash"
                size={32}
                className="max-md:!size-11"
                disabled={pending}
                onClick={() =>
                  setConfirm({
                    title: `Einladung an ${i.email} zurückziehen?`,
                    text: "Der Einladungslink funktioniert danach nicht mehr.",
                    label: "Zurückziehen",
                    danger: true,
                    run: () =>
                      start(async () => {
                        await revokeInviteAction(i.id);
                        router.refresh();
                      }),
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Card>

      <Drawer open={drawer} onClose={() => setDrawer(false)} eyebrow="Benutzer" title="Mitarbeitende einladen" footer={
        link ? (
          <Button variant="primary" onClick={() => setDrawer(false)} icon="check">Fertig</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>Abbrechen</Button>
            <Button variant="primary" onClick={invite} loading={pending} icon="mail">Einladungslink erzeugen</Button>
          </>
        )
      }>
        {link ? (
          <div className="space-y-4">
            <Notice tone="ok">Einladung angelegt. Der Link wird nur einmal angezeigt – bitte jetzt kopieren und persönlich weitergeben.</Notice>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-sunken p-3">
              <code className="min-w-0 flex-1 break-all text-[12px] text-text">{link}</code>
              <IconButton label="Link kopieren" icon="copy" size={34} onClick={copy} />
            </div>
            <p className="text-[12px] text-text-muted">Das Token steht hinter dem #-Zeichen und erreicht den Server erst bei der Annahme – es taucht in keinem Protokoll auf.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <Field label="E-Mail-Adresse">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus />}</Field>
            <Field label="Rolle" hint={ROLE_HELP[role]}>
              {(id) => (
                <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </Select>
              )}
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        )}
      </Drawer>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ""}
        confirmLabel={confirm?.label}
        danger={confirm?.danger}
        busy={pending}
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
      >
        {confirm?.text}
      </Dialog>
      {fresh.dialog}
    </div>
  );
}
