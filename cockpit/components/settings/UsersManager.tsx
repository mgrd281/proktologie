"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createInviteAction, revokeInviteAction, setDisabledAction, setRoleAction } from "@/app/actions/users";
import { ROLES, type Role } from "@/lib/auth/auth-shared";
import { Card, EmptyState, Eyebrow, Notice } from "@/components/ui/Bits";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
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

export function UsersManager({ me, isAdmin, users, invites, openInvite }: { me: string; isAdmin: boolean; users: UserRow[]; invites: InviteRow[]; openInvite: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [drawer, setDrawer] = useState(openInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("empfang");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(r.error);
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
      toast(r.ok ? { title: `${u.name}: ${ROLE_LABEL[next]}`, tone: "ok" } : { title: "Nicht geändert", description: r.error, tone: "danger" });
      router.refresh();
    });

  const toggle = (u: UserRow) =>
    start(async () => {
      const r = await setDisabledAction({ userId: u.id, disabled: !u.banned });
      toast(r.ok ? { title: `${u.name} ${u.banned ? "aktiviert" : "deaktiviert"}`, tone: u.banned ? "ok" : "warn" } : { title: "Nicht geändert", description: r.error, tone: "danger" });
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-xl text-[13px] leading-relaxed text-text-muted">
          Konten entstehen nur per Einladung. Der Link enthält ein einmaliges Token, gilt 72 Stunden und verrät nichts über die Person – den Namen trägt sie selbst ein. Nach der Annahme sind Passkey und Authenticator Pflicht.
        </p>
        <Button variant="primary" size="sm" icon="plus" onClick={() => { setLink(null); setDrawer(true); }}>Einladen</Button>
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
                onChange={(e) => changeRole(u, e.target.value as Role)}
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
                {u.id !== me && <IconButton label={u.banned ? "Konto aktivieren" : "Konto deaktivieren"} icon={u.banned ? "refresh" : "lock"} size={30} onClick={() => toggle(u)} disabled={pending} />}
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
              <IconButton label="Einladung zurückziehen" icon="trash" size={32} disabled={pending} onClick={() => start(async () => { await revokeInviteAction(i.id); router.refresh(); })} />
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
    </div>
  );
}
