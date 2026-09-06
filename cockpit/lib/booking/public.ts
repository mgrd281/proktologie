import { z } from "zod";
import { issueFormToken, verifyFormToken } from "../api/formToken.ts";
import { audit } from "../audit.ts";
import { enqueue } from "../jobs/queue.ts";
import { hit } from "../ratelimit.ts";
import { addDays, dateKey, startOfDay, zonedToUtc } from "../time.ts";
import { acceptOffer, afterBooked, afterCancelled, afterRescheduled } from "./lifecycle.ts";
import type { AppointmentView, WaitlistView } from "./model.ts";
import * as repo from "./repo.ts";

/**
 * Öffentliche Fachlogik hinter /api/public/v1. Die Website spricht nur mit
 * diesen Funktionen (über die Route-Handler). Grundsätze:
 * - Nichts geht raus, was nicht ohnehin auf der Website steht (Terminarten,
 *   freie Zeiten). Keine Namen, keine Belegungsdetails.
 * - Jede schreibende Anfrage: Buchung live, Formular-Token, Honigtopf,
 *   Rate-Limit, Validierung, Obergrenze je E-Mail. Die Doppelbuchung
 *   verhindert zuletzt die Datenbank.
 * - Tokens für die Terminverwaltung erreichen den Server nur im POST-Body.
 */
export class PublicError extends Error {
  constructor(
    public readonly status: number,
    public readonly code:
      | "not_live"
      | "paused"
      | "rate_limited"
      | "form_token"
      | "validation"
      | "unknown_type"
      | "slot_taken"
      | "too_many"
      | "not_found"
      | "conflict"
      | "unsupported",
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const MAX_RANGE_DAYS = 45;

export interface PublicStatus {
  bookingLive: boolean;
  bookingPaused: boolean;
  banner: string | null;
  pauseFrom: string | null;
  pauseTo: string | null;
}

export async function publicStatus(): Promise<PublicStatus> {
  const s = await repo.getSettings();
  return {
    bookingLive: s.bookingLive,
    bookingPaused: s.bookingPaused,
    banner: s.bannerText?.trim() || null,
    pauseFrom: s.pauseFrom?.toISOString() ?? null,
    pauseTo: s.pauseTo?.toISOString() ?? null,
  };
}

async function requireLive() {
  const s = await repo.getSettings();
  if (!s.bookingLive) throw new PublicError(503, "not_live", "Die Online-Buchung ist derzeit nicht verfügbar.");
  if (s.bookingPaused) throw new PublicError(503, "paused", s.bannerText?.trim() || "Die Online-Buchung ist vorübergehend pausiert.", { banner: s.bannerText ?? null });
  return s;
}

export async function publicTypes() {
  const types = await repo.listTypes();
  return types.filter((t) => t.visibility === "public").map((t) => ({ id: t.id, label: t.label, note: t.note, durationMin: t.durationMin }));
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function publicAvailability(typeId: string, from: string | null, to: string | null, ip: string, now = new Date()) {
  const rl = await hit("availability", ip, { limit: 240, windowSec: 3600 }, now);
  if (!rl.ok) throw new PublicError(429, "rate_limited", "Zu viele Anfragen. Bitte in einer Stunde erneut versuchen.");
  await requireLive();
  const type = (await publicTypes()).find((t) => t.id === typeId);
  if (!type) throw new PublicError(404, "unknown_type", "Unbekannte Terminart.");
  const today = dateKey(now);
  const start = from && dateRe.test(from) && from >= today ? from : today;
  let end = to && dateRe.test(to) ? to : addDays(start, 27);
  if (end < start) end = start;
  if (end > addDays(start, MAX_RANGE_DAYS - 1)) end = addDays(start, MAX_RANGE_DAYS - 1);
  const days = await repo.availabilityRange(typeId, start, end, now);
  return { typeId, from: start, to: end, days, formToken: issueFormToken(now.getTime()) };
}

const bookingSchema = z.object({
  typeId: z.string().min(1).max(60),
  date: z.string().regex(dateRe),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().trim().min(1, "Vorname fehlt").max(80),
  lastName: z.string().trim().min(1, "Nachname fehlt").max(80),
  email: z.string().trim().email("E-Mail ungültig").max(200),
  phone: z.string().trim().min(5, "Telefonnummer fehlt").max(40),
  consent: z.literal(true, { message: "Einwilligung fehlt" }),
  formToken: z.string().min(10),
  /** Honigtopf – muss leer bleiben */
  hp: z.string().max(0).optional().or(z.literal("")),
});
export type PublicBookingInput = z.input<typeof bookingSchema>;

export interface PublicBookingResult {
  ref: string;
  startsAt: string;
  endsAt: string;
  typeLabel: string;
}

export async function createPublicBooking(raw: unknown, ip: string, now = new Date()): Promise<PublicBookingResult> {
  const rl = await hit("booking", ip, { limit: 6, windowSec: 3600 }, now);
  if (!rl.ok) throw new PublicError(429, "rate_limited", "Zu viele Buchungsversuche. Bitte rufen Sie uns an.");
  const settings = await requireLive();

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    // Honigtopf gefüllt → wie Validierungsfehler behandeln, ohne Hinweis
    throw new PublicError(422, "validation", parsed.error.issues.map((i) => i.message).join(" "));
  }
  const v = parsed.data;
  const tok = verifyFormToken(v.formToken, now.getTime());
  if (!tok.ok) throw new PublicError(400, "form_token", "Das Formular ist abgelaufen. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");

  const type = (await publicTypes()).find((t) => t.id === v.typeId);
  if (!type) throw new PublicError(404, "unknown_type", "Unbekannte Terminart.");

  // Slot muss aus der öffentlichen Verfügbarkeit stammen (Vorlauf, Horizont, Sprechzeit, Raster)
  const slots = await repo.availability(v.typeId, v.date, now);
  const slot = slots.find((s) => s.time === v.time);
  if (!slot) throw new PublicError(409, "slot_taken", "Diese Zeit ist leider nicht mehr verfügbar. Bitte wählen Sie eine andere.");

  const future = await repo.countFutureActiveByEmail(v.email, now);
  if (future >= settings.maxFuturePerEmail) {
    throw new PublicError(409, "too_many", `Für diese E-Mail-Adresse bestehen bereits ${future} offene Termine. Bitte nutzen Sie den Verwaltungslink aus Ihrer Bestätigung oder rufen Sie uns an.`);
  }

  const token = repo.newManageToken();
  let a: AppointmentView;
  try {
    a = await repo.createAppointment({
      typeId: v.typeId,
      startsAt: slot.startsAt,
      pii: { firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone },
      source: "web",
      status: "booked",
      manageToken: token,
      actorId: null,
    });
  } catch (e) {
    if (e instanceof repo.ConflictError) throw new PublicError(409, "slot_taken", "Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.");
    throw e;
  }
  await afterBooked(a);
  return { ref: a.ref, startsAt: a.startsAt, endsAt: a.endsAt, typeLabel: a.typeLabel };
}

// ---------- Terminverwaltung durch Patient:innen ----------

export interface ManageView {
  kind: "appointment";
  ref: string;
  typeId: string;
  typeLabel: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentView["status"];
  firstName: string;
  /** Angebot aus der Warteliste: bis wann reserviert */
  holdUntil: string | null;
  confirmedByPatient: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  address: string;
}

const manageSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.enum(["view", "confirm", "cancel", "reschedule"]),
  date: z.string().regex(dateRe).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

function toManageView(a: AppointmentView, now: Date): ManageView {
  const upcoming = new Date(a.startsAt).getTime() > now.getTime();
  const open = a.status === "booked" || a.status === "confirmed" || a.status === "reminded";
  return {
    kind: "appointment",
    ref: a.ref,
    typeId: a.typeId,
    typeLabel: a.typeLabel,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    status: a.status,
    firstName: a.pii.firstName,
    holdUntil: a.holdUntil,
    confirmedByPatient: Boolean(a.confirmedByPatientAt),
    canConfirm: open && upcoming && a.status !== "confirmed",
    canCancel: open && upcoming,
    canReschedule: open && upcoming && !a.holdUntil,
    address: "Schäferkampsallee 56, 20357 Hamburg",
  };
}

export async function manageAppointment(raw: unknown, ip: string, now = new Date()): Promise<ManageView> {
  const rl = await hit("manage", ip, { limit: 60, windowSec: 3600 }, now);
  if (!rl.ok) throw new PublicError(429, "rate_limited", "Zu viele Anfragen. Bitte später erneut versuchen.");
  const parsed = manageSchema.safeParse(raw);
  if (!parsed.success) throw new PublicError(422, "validation", "Ungültige Anfrage.");
  const v = parsed.data;
  const a = await repo.findAppointmentByManageToken(v.token);
  if (!a) throw new PublicError(404, "not_found", "Dieser Link ist ungültig oder abgelaufen.");
  const view = toManageView(a, now);

  if (v.action === "view") return view;

  if (v.action === "confirm") {
    if (!view.canConfirm && a.status !== "confirmed") throw new PublicError(409, "conflict", "Dieser Termin kann nicht mehr bestätigt werden.");
    if (a.status === "confirmed") return view;
    const updated = a.holdUntil ? await acceptOffer(a) : await repo.setStatus(a.id, "confirmed", null, "patient");
    return toManageView(updated, now);
  }

  if (v.action === "cancel") {
    if (!view.canCancel) throw new PublicError(409, "conflict", "Dieser Termin kann nicht mehr abgesagt werden.");
    const updated = await repo.setStatus(a.id, "cancelled", null, "patient");
    await afterCancelled(updated.holdUntil ? updated : { ...updated, holdUntil: a.holdUntil }, "patient", { notify: !a.holdUntil });
    return toManageView(updated, now);
  }

  // reschedule
  if (!view.canReschedule) throw new PublicError(409, "conflict", "Dieser Termin kann nicht verschoben werden.");
  if (!v.date || !v.time) throw new PublicError(422, "validation", "Bitte Datum und Uhrzeit wählen.");
  const slots = await repo.availability(a.typeId, v.date, now);
  const slot = slots.find((s) => s.time === v.time);
  if (!slot) throw new PublicError(409, "slot_taken", "Diese Zeit ist nicht mehr verfügbar.");
  if (slot.startsAt.getTime() === new Date(a.startsAt).getTime()) return view;
  let updated: AppointmentView;
  try {
    updated = await repo.updateAppointment(a.id, { startsAt: slot.startsAt }, "patient");
  } catch (e) {
    if (e instanceof repo.ConflictError) throw new PublicError(409, "slot_taken", "Diese Zeit wurde gerade vergeben.");
    throw e;
  }
  // Der alte Platz ist frei → Warteliste, neuer Zeitpunkt → Mail mit neuer Kalenderdatei
  await enqueue({ kind: "waitlist.offer_next", payload: { typeId: a.typeId, startsAt: a.startsAt, freedFrom: a.id }, dedupeKey: `waitlist.offer:${a.id}:move:${updated.sequence}` });
  await afterRescheduled(updated);
  await audit({ action: "appointment.reschedule.patient", entity: "appointment", entityId: a.id, meta: { sequence: updated.sequence } });
  return toManageView(updated, now);
}

// ---------- Warteliste (öffentlich) ----------

const waitlistSchema = z.object({
  typeId: z.string().min(1).max(60),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  windowFrom: z.string().regex(dateRe).optional().nullable(),
  windowTo: z.string().regex(dateRe).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  consent: z.literal(true),
  formToken: z.string().min(10),
  hp: z.string().max(0).optional().or(z.literal("")),
});

export async function joinWaitlist(raw: unknown, ip: string, now = new Date()): Promise<{ ref: string | null }> {
  const rl = await hit("waitlist", ip, { limit: 6, windowSec: 3600 }, now);
  if (!rl.ok) throw new PublicError(429, "rate_limited", "Zu viele Anfragen. Bitte rufen Sie uns an.");
  await requireLive();
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) throw new PublicError(422, "validation", parsed.error.issues.map((i) => i.message).join(" "));
  const v = parsed.data;
  if (!verifyFormToken(v.formToken, now.getTime()).ok) throw new PublicError(400, "form_token", "Das Formular ist abgelaufen. Bitte neu laden.");
  const type = (await publicTypes()).find((t) => t.id === v.typeId);
  if (!type) throw new PublicError(404, "unknown_type", "Unbekannte Terminart.");
  const token = repo.newManageToken();
  const w = await repo.createWaitlistEntry({
    typeId: v.typeId,
    pii: { firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone || undefined },
    windowFrom: v.windowFrom ? startOfDay(v.windowFrom) : null,
    windowTo: v.windowTo ? zonedToUtc(v.windowTo, "23:59") : null,
    note: v.note ?? null,
    source: "web",
    manageToken: token,
  });
  await enqueue({ kind: "mail.waitlist_joined", payload: { waitlistId: w.id }, dedupeKey: `mail.waitlist_joined:${w.id}` });
  return { ref: w.ref };
}

export interface WaitlistManageView {
  kind: "waitlist";
  ref: string | null;
  typeLabel: string;
  status: WaitlistView["status"];
  firstName: string;
  canWithdraw: boolean;
}

export async function manageWaitlist(raw: unknown, ip: string, now = new Date()): Promise<WaitlistManageView> {
  const rl = await hit("manage", ip, { limit: 60, windowSec: 3600 }, now);
  if (!rl.ok) throw new PublicError(429, "rate_limited", "Zu viele Anfragen.");
  const parsed = z.object({ token: z.string().min(20).max(200), action: z.enum(["view", "withdraw"]) }).safeParse(raw);
  if (!parsed.success) throw new PublicError(422, "validation", "Ungültige Anfrage.");
  const w = await repo.findWaitlistByManageToken(parsed.data.token);
  if (!w) throw new PublicError(404, "not_found", "Dieser Link ist ungültig.");
  const view = (x: WaitlistView): WaitlistManageView => ({ kind: "waitlist", ref: x.ref, typeLabel: x.typeLabel, status: x.status, firstName: x.pii.firstName, canWithdraw: x.status === "open" });
  if (parsed.data.action === "view" || w.status !== "open") return view(w);
  return view(await repo.setWaitlistStatus(w.id, "withdrawn", null));
}
