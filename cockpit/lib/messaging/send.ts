import { audit } from "../audit.ts";
import { COCKPIT_URL } from "../auth/auth.ts";
import * as repo from "../booking/repo.ts";
import { buildIcs } from "../ics.ts";
import { PRACTICE } from "../practice.ts";
import { fmtLongDate, timeKey } from "../time.ts";
import { emailChannel } from "./email.ts";
import * as tpl from "./templates.ts";

/**
 * Patienten-Mails zu Terminen: Vorlage + Kalenderdatei + Versand +
 * Protokoll (ohne Inhalt) + Audit. Jede Art wird pro Termin höchstens
 * einmal verschickt (bei Verschiebungen je Sequenz, bei Erinnerungen je
 * Vorlaufstunde) – ein wiederholter Aufruf ist ein No-op.
 */
export type AppointmentMailKind = "confirmation" | "rescheduled" | "cancellation" | "reminder" | "waitlist_offer";

export interface SendOptions {
  by?: "patient" | "praxis" | "system";
  hoursBefore?: number;
  /** Erneut senden, auch wenn schon protokolliert (z. B. Klick im Cockpit) */
  force?: boolean;
  actorId?: string | null;
}

export type SendOutcome = { sent: true; kindKey: string } | { sent: false; reason: "no_email" | "duplicate" | "not_found" | "failed"; error?: string };

export function manageUrlFor(token: string | null): string | null {
  return token ? `${COCKPIT_URL}/t/#${token}` : null;
}

export async function sendAppointmentMail(kind: AppointmentMailKind, appointmentId: string, opts: SendOptions = {}): Promise<SendOutcome> {
  const a = await repo.getAppointment(appointmentId);
  if (!a) return { sent: false, reason: "not_found" };
  if (!a.pii.email) return { sent: false, reason: "no_email" };

  const kindKey = kind === "reminder" ? `reminder:${opts.hoursBefore ?? 24}h` : kind === "rescheduled" ? `rescheduled:${a.sequence}` : kind;
  if (!opts.force && (await repo.messageSent(a.id, kindKey))) return { sent: false, reason: "duplicate" };

  const token = await repo.manageTokenFor(a.id);
  const ctx: tpl.TemplateContext = {
    firstName: a.pii.firstName,
    lastName: a.pii.lastName,
    typeLabel: a.typeLabel,
    startsAt: new Date(a.startsAt),
    endsAt: new Date(a.endsAt),
    ref: a.ref,
    practiceName: PRACTICE.name,
    address: PRACTICE.address,
    phone: PRACTICE.phone,
    manageUrl: manageUrlFor(token),
    prepText: kind === "cancellation" ? null : await repo.prepTextFor(a.typeId),
    holdUntil: a.holdUntil ? new Date(a.holdUntil) : null,
  };

  const mail =
    kind === "confirmation"
      ? tpl.confirmation(ctx)
      : kind === "rescheduled"
        ? tpl.rescheduled(ctx)
        : kind === "cancellation"
          ? tpl.cancellation(ctx, opts.by ?? "praxis")
          : kind === "reminder"
            ? tpl.reminder(ctx, opts.hoursBefore ?? 24)
            : tpl.waitlistOffer(ctx);

  // Kalenderdatei: Einladung bei Bestätigung/Verschiebung/Erinnerung, Absage bei Storno; kein ICS beim bloßen Angebot
  const withIcs = kind !== "waitlist_offer";
  const ics = withIcs
    ? buildIcs({
        uid: `${a.id}@proktologie-eimsbuettel.de`,
        sequence: a.sequence,
        method: kind === "cancellation" ? "CANCEL" : "REQUEST",
        start: ctx.startsAt,
        end: ctx.endsAt,
        summary: `${a.typeLabel} · ${PRACTICE.name}`,
        description: `Referenz ${a.ref}${ctx.manageUrl ? `\nTermin verwalten: ${ctx.manageUrl}` : ""}`,
        location: PRACTICE.address,
        organizerName: PRACTICE.name,
        organizerEmail: process.env.EMAIL_FROM ?? PRACTICE.email,
        attendeeEmail: a.pii.email,
        url: ctx.manageUrl ?? undefined,
      })
    : null;

  const channel = emailChannel();
  try {
    const r = await channel.send({
      to: a.pii.email,
      toName: `${a.pii.firstName} ${a.pii.lastName}`,
      subject: mail.subject,
      text: mail.text,
      html: tpl.textToHtml(mail.text),
      calendarMethod: ics ? (kind === "cancellation" ? "CANCEL" : "REQUEST") : undefined,
      attachments: ics ? [{ filename: kind === "cancellation" ? "absage.ics" : "termin.ics", contentType: "text/calendar", content: ics, encoding: "utf8" }] : undefined,
    });
    await repo.logMessage({ channel: "email", kind: kindKey, appointmentId: a.id, status: "sent", providerId: r.providerId ?? null });
    await audit({ actorId: opts.actorId ?? null, action: `mail.${kind}`, entity: "appointment", entityId: a.id, meta: { live: channel.live, kindKey } });
    return { sent: true, kindKey };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await repo.logMessage({ channel: "email", kind: kindKey, appointmentId: a.id, status: "failed", error });
    return { sent: false, reason: "failed", error };
  }
}

export async function sendWaitlistJoinedMail(waitlistId: string): Promise<SendOutcome> {
  const w = await repo.getWaitlistEntry(waitlistId);
  if (!w) return { sent: false, reason: "not_found" };
  if (!w.pii.email) return { sent: false, reason: "no_email" };
  const token = await repo.waitlistManageTokenFor(w.id);
  const windowText =
    w.windowFrom && w.windowTo
      ? `${fmtLongDate(new Date(w.windowFrom))} bis ${fmtLongDate(new Date(w.windowTo))}`
      : w.windowFrom
        ? `ab ${fmtLongDate(new Date(w.windowFrom))}`
        : w.windowTo
          ? `bis ${fmtLongDate(new Date(w.windowTo))}`
          : null;
  const mail = tpl.waitlistJoined({
    firstName: w.pii.firstName,
    lastName: w.pii.lastName,
    typeLabel: w.typeLabel,
    startsAt: new Date(),
    endsAt: new Date(),
    ref: w.ref ?? "",
    practiceName: PRACTICE.name,
    address: PRACTICE.address,
    phone: PRACTICE.phone,
    manageUrl: manageUrlFor(token),
    windowText,
  });
  try {
    const r = await emailChannel().send({ to: w.pii.email, toName: `${w.pii.firstName} ${w.pii.lastName}`, subject: mail.subject, text: mail.text, html: tpl.textToHtml(mail.text) });
    await repo.logMessage({ channel: "email", kind: "waitlist_joined", waitlistId: w.id, status: "sent", providerId: r.providerId ?? null });
    return { sent: true, kindKey: "waitlist_joined" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await repo.logMessage({ channel: "email", kind: "waitlist_joined", waitlistId: w.id, status: "failed", error });
    return { sent: false, reason: "failed", error };
  }
}

/** Kurze Beschreibung für Toasts im Cockpit. */
export function describeSlot(startsAt: Date): string {
  return `${fmtLongDate(startsAt)}, ${timeKey(startsAt)} Uhr`;
}
