import { audit } from "../audit.ts";
import { enqueue } from "../jobs/queue.ts";
import { sendAppointmentMail } from "../messaging/send.ts";
import { type AppointmentView } from "./model.ts";
import * as repo from "./repo.ts";

/**
 * Was nach einem Terminereignis automatisch passiert. Die Repo-Schicht
 * bleibt frei von Versandlogik; Actions und öffentliche API rufen diese
 * Hooks auf. Alles Versandbezogene läuft über die Job-Warteschlange
 * (Wiederholung bei Fehlern), Warteliste-Angebote ebenso.
 */

export async function afterBooked(a: AppointmentView) {
  if (a.pii.email && !a.isDemo) await enqueue({ kind: "mail.confirmation", payload: { appointmentId: a.id }, dedupeKey: `mail.confirmation:${a.id}` });
}

export async function afterRescheduled(a: AppointmentView) {
  if (a.pii.email && !a.isDemo) {
    await enqueue({ kind: "mail.rescheduled", payload: { appointmentId: a.id }, dedupeKey: `mail.rescheduled:${a.id}:${a.sequence}` });
  }
}

export async function afterCancelled(a: AppointmentView, by: "patient" | "praxis" | "system", opts: { notify?: boolean } = {}) {
  const wasHold = Boolean(a.holdUntil);
  if (opts.notify !== false && a.pii.email && !a.isDemo) {
    await enqueue({ kind: "mail.cancellation", payload: { appointmentId: a.id, by }, dedupeKey: `mail.cancellation:${a.id}` });
  }
  // Ein abgelehntes/abgelaufenes Angebot: Wartelisten-Eintrag abschließen
  const wl = await repo.waitlistByOfferedAppointment(a.id);
  if (wl) await repo.setWaitlistStatus(wl.id, by === "system" ? "expired" : "withdrawn", null);
  // Der Platz wird frei → nächste passende Person aus der Warteliste
  if (new Date(a.startsAt).getTime() > Date.now() && !a.isDemo) {
    await enqueue({
      kind: "waitlist.offer_next",
      payload: { typeId: a.typeId, startsAt: a.startsAt, freedFrom: a.id },
      dedupeKey: `waitlist.offer:${a.id}:${wasHold ? "hold" : "appt"}:${Date.now()}`,
    });
  }
}

/**
 * Nächste Person aus der Warteliste bekommt den freien Platz reserviert:
 * ein echter Termin mit hold_until – der Ausschluss-Constraint sichert,
 * dass niemand sonst ihn in der Zwischenzeit bucht.
 */
export async function offerNext(typeId: string, startsAt: Date, now = new Date()): Promise<{ offered: boolean; appointmentId?: string }> {
  if (startsAt.getTime() <= now.getTime()) return { offered: false };
  const settings = await repo.getSettings();
  if (!settings.bookingLive) return { offered: false };
  const candidate = await repo.nextWaitlistCandidate(typeId, startsAt);
  if (!candidate) return { offered: false };
  // Slot muss nach den öffentlichen Regeln noch verfügbar sein
  const type = await repo.getType(typeId);
  if (!type || !type.active) return { offered: false };
  const token = repo.newManageToken();
  const holdUntil = new Date(now.getTime() + settings.waitlistHoldHours * 3600_000);
  let a: AppointmentView;
  try {
    a = await repo.createAppointment({
      typeId,
      startsAt,
      pii: candidate.pii,
      source: "web",
      status: "booked",
      manageToken: token,
      holdUntil,
      isDemo: candidate.isDemo,
      actorId: null,
      ignoreOpeningHours: true,
    });
  } catch (e) {
    if (e instanceof repo.ConflictError) return { offered: false };
    throw e;
  }
  await repo.setWaitlistStatus(candidate.id, "offered", null, { offeredAppointmentId: a.id, offerExpiresAt: holdUntil });
  await audit({ action: "waitlist.offer", entity: "waitlist", entityId: candidate.id, meta: { appointmentId: a.id } });
  if (!a.isDemo) await enqueue({ kind: "mail.waitlist_offer", payload: { appointmentId: a.id }, dedupeKey: `mail.waitlist_offer:${a.id}` });
  return { offered: true, appointmentId: a.id };
}

/**
 * Gezieltes Angebot aus dem Cockpit: DIESER Person DIESEN Platz reservieren –
 * unabhängig von Reihenfolge und Live-Schalter (der Empfang entscheidet).
 * Konflikte (Platz inzwischen belegt) kommen als ConflictError.
 */
export async function offerEntry(waitlistId: string, startsAt: Date, actorId: string, now = new Date()): Promise<{ appointmentId: string; ref: string }> {
  const w = await repo.getWaitlistEntry(waitlistId);
  if (!w) throw new Error("Wartelisten-Eintrag nicht gefunden.");
  if (w.status !== "open") throw new Error("Dieser Eintrag ist nicht mehr offen.");
  if (!w.pii.email) throw new Error("Ohne E-Mail-Adresse lässt sich kein Angebot verschicken – bitte telefonisch vereinbaren und den Termin direkt anlegen.");
  if (startsAt.getTime() <= now.getTime()) throw new Error("Der Zeitpunkt liegt in der Vergangenheit.");
  const settings = await repo.getSettings();
  const holdUntil = new Date(now.getTime() + settings.waitlistHoldHours * 3600_000);
  const a = await repo.createAppointment({
    typeId: w.typeId,
    startsAt,
    pii: w.pii,
    source: "cockpit",
    status: "booked",
    manageToken: repo.newManageToken(),
    holdUntil,
    isDemo: w.isDemo,
    actorId,
  });
  await repo.setWaitlistStatus(w.id, "offered", actorId, { offeredAppointmentId: a.id, offerExpiresAt: holdUntil });
  await audit({ actorId, action: "waitlist.offer.manual", entity: "waitlist", entityId: w.id, meta: { appointmentId: a.id } });
  if (!a.isDemo) await enqueue({ kind: "mail.waitlist_offer", payload: { appointmentId: a.id }, dedupeKey: `mail.waitlist_offer:${a.id}` });
  return { appointmentId: a.id, ref: a.ref };
}

/** Angebot angenommen: Termin wird verbindlich, Bestätigung mit Kalenderdatei geht raus. */
export async function acceptOffer(a: AppointmentView) {
  const confirmed = await repo.setStatus(a.id, "confirmed", null, "patient");
  const wl = await repo.waitlistByOfferedAppointment(a.id);
  if (wl) await repo.setWaitlistStatus(wl.id, "booked", null);
  await enqueue({ kind: "mail.confirmation", payload: { appointmentId: a.id }, dedupeKey: `mail.confirmation:${a.id}` });
  return confirmed;
}

/** Abgelaufene Reservierungen freigeben und die nächste Person anschreiben. */
export async function expireHolds(now = new Date()): Promise<number> {
  const holds = await repo.expiredHolds(now);
  for (const a of holds) {
    await repo.setStatus(a.id, "cancelled", null, "system");
    await afterCancelled({ ...a, holdUntil: a.holdUntil }, "system", { notify: true });
  }
  return holds.length;
}

/** Direktversand für Klicks im Cockpit („Bestätigung erneut senden“). */
export async function resendConfirmation(appointmentId: string, actorId: string) {
  const a = await repo.getAppointment(appointmentId);
  if (!a) throw new Error("Termin nicht gefunden");
  if (!a.pii.email) throw new Error("Für diesen Termin ist keine E-Mail-Adresse hinterlegt.");
  if (!a.hasManageLink) await repo.issueManageToken(a.id, actorId);
  return sendAppointmentMail("confirmation", a.id, { force: true, actorId });
}
