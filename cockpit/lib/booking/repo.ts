import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { audit } from "../audit.ts";
import { currentKeyVersion, decryptJson, encrypt, decrypt, encryptJson } from "../crypto/aead.ts";
import { emailHash, nameKey, phoneHash } from "../crypto/blindIndex.ts";
import { getDb } from "../db/client.ts";
import * as t from "../db/schema.ts";
import { makeRef } from "../ref.ts";
import { addDays, dateKey, startOfDay, startOfWeek } from "../time.ts";
import { findConflicts, generateSlots, withinOpeningHours, type BusySpan, type ExceptionSpan } from "./engine.ts";
import {
  ACTIVE_STATUSES,
  type AppointmentSource,
  type AppointmentStatus,
  type AppointmentView,
  type ExceptionKind,
  type ExceptionView,
  type HoursRow,
  type Pii,
  type SettingsView,
  type TypeColor,
  type TypeView,
  type WaitlistStatus,
  type WaitlistView,
} from "./model.ts";

/** Token für Verwaltungslinks: 32 zufällige Bytes, gespeichert nur als SHA-256 + verschlüsselt. */
export const newManageToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Datenzugriff des Terminmotors. Verschlüsselung und Blind-Indizes passieren
 * ausschließlich hier; Seiten und Actions sehen nur Ansichtsmodelle.
 */

export class ConflictError extends Error {
  constructor(message = "Der Zeitraum ist bereits belegt.") {
    super(message);
    this.name = "ConflictError";
  }
}

const isExclusionViolation = (e: unknown) => {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err.code ?? err.cause?.code;
  const msg = `${err.message ?? ""} ${err.cause?.message ?? ""}`;
  return code === "23P01" || /appointments_no_overlap/.test(msg);
};
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err.code ?? err.cause?.code;
  const msg = `${err.message ?? ""} ${err.cause?.message ?? ""}`;
  return code === "23505" || /appointments_ref_idx|requests_ref_idx/.test(msg);
};

// ---------- Einstellungen ----------

export async function getSettings(): Promise<SettingsView & { pauseFrom: Date | null; pauseTo: Date | null }> {
  const db = await getDb();
  const [row] = await db.select().from(t.practiceSettings).where(eq(t.practiceSettings.id, "default"));
  if (!row) throw new Error("practice_settings fehlt – Migrationen ausführen");
  return {
    slotStepMin: row.slotStepMin,
    bookingLive: row.bookingLive,
    bookingPaused: row.bookingPaused,
    pauseFrom: row.pauseFrom,
    pauseTo: row.pauseTo,
    bannerText: row.bannerText,
    autoReplyText: row.autoReplyText,
    intakeRetentionDays: row.intakeRetentionDays,
    reminderOffsetsH: row.reminderOffsetsH,
    siteUrl: row.siteUrl,
    waitlistHoldHours: row.waitlistHoldHours,
    maxFuturePerEmail: row.maxFuturePerEmail,
  };
}

export async function updateSettings(
  patch: Partial<
    Pick<SettingsView, "slotStepMin" | "bookingPaused" | "bannerText" | "autoReplyText" | "siteUrl" | "waitlistHoldHours" | "maxFuturePerEmail" | "reminderOffsetsH">
  > & {
    bookingLive?: boolean;
  },
  actorId: string,
) {
  const db = await getDb();
  if (patch.bookingLive) {
    const demo = await countDemo();
    if (demo > 0) throw new Error(`Live-Betrieb nicht möglich: ${demo} Demo-Datensätze vorhanden. Bitte zuerst löschen.`);
  }
  await db
    .update(t.practiceSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(t.practiceSettings.id, "default"));
  await audit({ actorId, action: "settings.update", entity: "practice_settings", entityId: "default", meta: { keys: Object.keys(patch) } });
}

// ---------- Terminarten ----------

const toTypeView = (r: typeof t.appointmentTypes.$inferSelect): TypeView => ({
  id: r.id,
  label: r.label,
  note: r.note,
  durationMin: r.durationMin,
  bufferMin: r.bufferMin,
  visibility: r.visibility,
  leadTimeHours: r.leadTimeHours,
  maxAheadDays: r.maxAheadDays,
  color: r.color,
  sortOrder: r.sortOrder,
  active: r.active,
});

export async function listTypes(includeInactive = false): Promise<TypeView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t.appointmentTypes)
    .where(includeInactive ? undefined : eq(t.appointmentTypes.active, true))
    .orderBy(asc(t.appointmentTypes.sortOrder), asc(t.appointmentTypes.label));
  return rows.map(toTypeView);
}

export async function getType(id: string): Promise<TypeView | null> {
  const db = await getDb();
  const [row] = await db.select().from(t.appointmentTypes).where(eq(t.appointmentTypes.id, id));
  return row ? toTypeView(row) : null;
}

export async function saveType(
  input: Omit<TypeView, "id"> & { id?: string },
  actorId: string,
): Promise<TypeView> {
  const db = await getDb();
  const id =
    input.id ??
    input.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  const values = {
    id,
    label: input.label.trim(),
    note: input.note?.trim() || null,
    durationMin: input.durationMin,
    bufferMin: input.bufferMin,
    visibility: input.visibility,
    leadTimeHours: input.leadTimeHours,
    maxAheadDays: input.maxAheadDays,
    color: input.color as TypeColor,
    sortOrder: input.sortOrder,
    active: input.active,
  };
  const [row] = await db
    .insert(t.appointmentTypes)
    .values(values)
    .onConflictDoUpdate({ target: t.appointmentTypes.id, set: values })
    .returning();
  await audit({ actorId, action: input.id ? "type.update" : "type.create", entity: "appointment_type", entityId: id });
  return toTypeView(row!);
}

// ---------- Sprechzeiten & Ausnahmen ----------

export async function listHours(): Promise<HoursRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ weekday: t.openingHours.weekday, opens: t.openingHours.opens, closes: t.openingHours.closes })
    .from(t.openingHours)
    .orderBy(asc(t.openingHours.weekday), asc(t.openingHours.opens));
  return rows;
}

export async function replaceHours(rows: HoursRow[], actorId: string) {
  const db = await getDb();
  for (const r of rows) {
    if (r.weekday < 1 || r.weekday > 7) throw new Error("Ungültiger Wochentag");
    if (!/^\d{2}:\d{2}$/.test(r.opens) || !/^\d{2}:\d{2}$/.test(r.closes)) throw new Error("Zeit als HH:MM");
    if (r.opens >= r.closes) throw new Error(`Öffnet nach Schluss (${r.opens}–${r.closes})`);
  }
  await db.transaction(async (tx) => {
    await tx.delete(t.openingHours);
    if (rows.length) await tx.insert(t.openingHours).values(rows);
  });
  await audit({ actorId, action: "hours.replace", entity: "opening_hours", meta: { rows: rows.length } });
}

const toExceptionView = (r: typeof t.calendarExceptions.$inferSelect): ExceptionView => ({
  id: r.id,
  kind: r.kind,
  startsAt: r.startsAt.toISOString(),
  endsAt: r.endsAt.toISOString(),
  allDay: r.allDay,
  label: r.label,
  isDemo: r.isDemo,
});

export async function listExceptions(from: Date, to: Date): Promise<ExceptionView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t.calendarExceptions)
    .where(and(lt(t.calendarExceptions.startsAt, to), gt(t.calendarExceptions.endsAt, from)))
    .orderBy(asc(t.calendarExceptions.startsAt));
  return rows.map(toExceptionView);
}

export async function createException(
  input: { kind: ExceptionKind; startsAt: Date; endsAt: Date; allDay?: boolean; label?: string; isDemo?: boolean },
  actorId: string | null,
): Promise<ExceptionView> {
  if (input.endsAt <= input.startsAt) throw new Error("Ende liegt vor Beginn");
  const db = await getDb();
  const [row] = await db
    .insert(t.calendarExceptions)
    .values({ ...input, label: input.label?.trim() || null, createdBy: actorId })
    .returning();
  await audit({ actorId, action: "exception.create", entity: "calendar_exception", entityId: row!.id, meta: { kind: input.kind } });
  return toExceptionView(row!);
}

export async function deleteException(id: string, actorId: string) {
  const db = await getDb();
  await db.delete(t.calendarExceptions).where(eq(t.calendarExceptions.id, id));
  await audit({ actorId, action: "exception.delete", entity: "calendar_exception", entityId: id });
}

// ---------- Belegung & Verfügbarkeit ----------

export async function busySpans(from: Date, to: Date, exceptId?: string): Promise<BusySpan[]> {
  const db = await getDb();
  const appts = await db
    .select({ id: t.appointments.id, startsAt: t.appointments.startsAt, endsAt: t.appointments.endsAt, bufferMin: t.appointments.bufferMin })
    .from(t.appointments)
    .where(and(inArray(t.appointments.status, ACTIVE_STATUSES), lt(t.appointments.startsAt, to), gt(t.appointments.endsAt, from)));
  return appts.filter((a) => a.id !== exceptId).map(({ startsAt, endsAt, bufferMin }) => ({ startsAt, endsAt, bufferMin }));
}

async function exceptionSpans(from: Date, to: Date): Promise<ExceptionSpan[]> {
  const rows = await listExceptions(from, to);
  return rows.map((r) => ({ kind: r.kind, startsAt: new Date(r.startsAt), endsAt: new Date(r.endsAt), allDay: r.allDay }));
}

export async function availability(typeId: string, date: string, now = new Date()) {
  const type = await getType(typeId);
  if (!type || !type.active) return [];
  const settings = await getSettings();
  const from = startOfDay(date);
  const to = startOfDay(addDays(date, 1));
  const [hours, exceptions, busy] = await Promise.all([listHours(), exceptionSpans(from, to), busySpans(from, to)]);
  return generateSlots({
    date,
    type: { id: type.id, durationMin: type.durationMin, bufferMin: type.bufferMin, leadTimeHours: type.leadTimeHours, maxAheadDays: type.maxAheadDays },
    hours,
    exceptions,
    busy,
    stepMin: settings.slotStepMin,
    now,
  });
}

/**
 * Verfügbarkeit über mehrere Tage in einem Rutsch: Stammdaten und Belegung
 * werden einmal geladen, der Motor läuft je Tag. Für die öffentliche API.
 */
export async function availabilityRange(typeId: string, fromDate: string, toDate: string, now = new Date()) {
  const type = await getType(typeId);
  if (!type || !type.active) return [] as Array<{ date: string; slots: string[] }>;
  const settings = await getSettings();
  const from = startOfDay(fromDate);
  const to = startOfDay(addDays(toDate, 1));
  const [hours, exceptions, busy] = await Promise.all([listHours(), exceptionSpans(from, to), busySpans(from, to)]);
  const spec = { id: type.id, durationMin: type.durationMin, bufferMin: type.bufferMin, leadTimeHours: type.leadTimeHours, maxAheadDays: type.maxAheadDays };
  const out: Array<{ date: string; slots: string[] }> = [];
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    const slots = generateSlots({ date, type: spec, hours, exceptions, busy, stepMin: settings.slotStepMin, now });
    out.push({ date, slots: slots.map((s) => s.time) });
  }
  return out;
}

// ---------- Termine ----------

function decryptPii(row: { id: string; piiEnc: string }): Pii {
  try {
    return decryptJson<Pii>(row.piiEnc, `appt:${row.id}`);
  } catch {
    return { firstName: "—", lastName: "(nicht lesbar)" };
  }
}

function toView(
  a: typeof t.appointments.$inferSelect,
  type: { label: string; color: TypeColor } | null,
): AppointmentView {
  return {
    id: a.id,
    ref: a.ref,
    typeId: a.typeId,
    typeLabel: type?.label ?? a.typeId,
    color: type?.color ?? "slate",
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    bufferMin: a.bufferMin,
    status: a.status,
    source: a.source,
    pii: decryptPii(a),
    note: a.noteEnc ? safeDecrypt(a.noteEnc, `note:${a.id}`) : null,
    isDemo: a.isDemo,
    remindedAt: a.remindedAt?.toISOString() ?? null,
    confirmedByPatientAt: a.confirmedByPatientAt?.toISOString() ?? null,
    holdUntil: a.holdUntil?.toISOString() ?? null,
    sequence: a.sequence,
    hasManageLink: Boolean(a.manageTokenHash),
    createdAt: a.createdAt.toISOString(),
  };
}

function safeDecrypt(env: string, aad: string): string | null {
  try {
    return decrypt(env, aad);
  } catch {
    return null;
  }
}

export async function listAppointments(from: Date, to: Date, opts: { includeCancelled?: boolean } = {}): Promise<AppointmentView[]> {
  const db = await getDb();
  const rows = await db
    .select({ a: t.appointments, type: { label: t.appointmentTypes.label, color: t.appointmentTypes.color } })
    .from(t.appointments)
    .leftJoin(t.appointmentTypes, eq(t.appointments.typeId, t.appointmentTypes.id))
    .where(
      and(
        gte(t.appointments.startsAt, from),
        lt(t.appointments.startsAt, to),
        opts.includeCancelled ? undefined : inArray(t.appointments.status, [...ACTIVE_STATUSES, "completed", "no_show"]),
      ),
    )
    .orderBy(asc(t.appointments.startsAt));
  return rows.map((r) => toView(r.a, r.type));
}

export async function getAppointment(id: string): Promise<AppointmentView | null> {
  const db = await getDb();
  const [r] = await db
    .select({ a: t.appointments, type: { label: t.appointmentTypes.label, color: t.appointmentTypes.color } })
    .from(t.appointments)
    .leftJoin(t.appointmentTypes, eq(t.appointments.typeId, t.appointmentTypes.id))
    .where(eq(t.appointments.id, id));
  return r ? toView(r.a, r.type) : null;
}

export interface CreateAppointmentInput {
  typeId: string;
  startsAt: Date;
  pii: Pii;
  note?: string;
  source: AppointmentSource;
  status?: AppointmentStatus;
  isDemo?: boolean;
  actorId?: string | null;
  /** Interne Anlage: Konflikt mit Sprechzeiten nur warnen, nicht sperren. */
  ignoreOpeningHours?: boolean;
  /** Verwaltungslink für Patient:innen (Website-Buchung, Wartelisten-Angebot) */
  manageToken?: string;
  /** Wartelisten-Angebot: reserviert bis */
  holdUntil?: Date | null;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentView> {
  const type = await getType(input.typeId);
  if (!type) throw new Error("Unbekannte Terminart");
  const endsAt = new Date(input.startsAt.getTime() + type.durationMin * 60_000);
  const bufferMin = type.bufferMin;

  // Freundliche Vorprüfung – die harte Garantie gibt der Ausschluss-Constraint
  const busy = await busySpans(input.startsAt, new Date(endsAt.getTime() + bufferMin * 60_000));
  if (findConflicts({ startsAt: input.startsAt, endsAt, bufferMin }, busy).length) throw new ConflictError();
  if (!input.ignoreOpeningHours) {
    const hours = await listHours();
    if (!withinOpeningHours(input.startsAt, endsAt, hours)) {
      throw new Error("Der Termin liegt außerhalb der Sprechzeiten.");
    }
  }

  const db = await getDb();
  const id = randomUUID();
  const pii: Pii = {
    firstName: input.pii.firstName.trim(),
    lastName: input.pii.lastName.trim(),
    email: input.pii.email?.trim() || undefined,
    phone: input.pii.phone?.trim() || undefined,
  };
  const values = {
    id,
    typeId: type.id,
    startsAt: input.startsAt,
    endsAt,
    bufferMin,
    status: input.status ?? "booked",
    source: input.source,
    piiEnc: encryptJson(pii, `appt:${id}`),
    emailHash: pii.email ? emailHash(pii.email) : null,
    phoneHash: pii.phone ? phoneHash(pii.phone) : null,
    nameKey: nameKey(pii.lastName, pii.firstName),
    noteEnc: input.note?.trim() ? encrypt(input.note.trim(), `note:${id}`) : null,
    manageTokenHash: input.manageToken ? hashToken(input.manageToken) : null,
    manageTokenEnc: input.manageToken ? encrypt(input.manageToken, `mtok:${id}`) : null,
    holdUntil: input.holdUntil ?? null,
    isDemo: input.isDemo ?? false,
    keyVersion: currentKeyVersion(),
    createdBy: input.actorId ?? null,
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db.insert(t.appointments).values({ ...values, ref: makeRef("PE") });
      break;
    } catch (e) {
      if (isExclusionViolation(e)) throw new ConflictError();
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
  await audit({
    actorId: input.actorId ?? null,
    action: "appointment.create",
    entity: "appointment",
    entityId: id,
    meta: { typeId: type.id, source: input.source, isDemo: values.isDemo },
  });
  return (await getAppointment(id))!;
}

export async function updateAppointment(
  id: string,
  patch: { typeId?: string; startsAt?: Date; pii?: Pii; note?: string | null },
  actorId: string,
): Promise<AppointmentView> {
  const db = await getDb();
  const current = await getAppointment(id);
  if (!current) throw new Error("Termin nicht gefunden");
  const typeId = patch.typeId ?? current.typeId;
  const type = await getType(typeId);
  if (!type) throw new Error("Unbekannte Terminart");
  const startsAt = patch.startsAt ?? new Date(current.startsAt);
  const endsAt = new Date(startsAt.getTime() + type.durationMin * 60_000);

  if (patch.startsAt || patch.typeId) {
    const busy = await busySpans(startsAt, new Date(endsAt.getTime() + type.bufferMin * 60_000), id);
    if (findConflicts({ startsAt, endsAt, bufferMin: type.bufferMin }, busy).length) throw new ConflictError();
  }

  const moved = Boolean(patch.startsAt) && startsAt.getTime() !== new Date(current.startsAt).getTime();
  const set: Partial<typeof t.appointments.$inferInsert> = { typeId, startsAt, endsAt, bufferMin: type.bufferMin };
  // Verschiebung: iCalendar-Sequenz erhöhen, damit Kalender-Apps die Änderung übernehmen
  if (moved) set.sequence = current.sequence + 1;
  if (patch.pii) {
    const pii: Pii = {
      firstName: patch.pii.firstName.trim(),
      lastName: patch.pii.lastName.trim(),
      email: patch.pii.email?.trim() || undefined,
      phone: patch.pii.phone?.trim() || undefined,
    };
    set.piiEnc = encryptJson(pii, `appt:${id}`);
    set.emailHash = pii.email ? emailHash(pii.email) : null;
    set.phoneHash = pii.phone ? phoneHash(pii.phone) : null;
    set.nameKey = nameKey(pii.lastName, pii.firstName);
    set.keyVersion = currentKeyVersion();
  }
  if (patch.note !== undefined) {
    set.noteEnc = patch.note?.trim() ? encrypt(patch.note.trim(), `note:${id}`) : null;
  }
  try {
    await db.update(t.appointments).set(set).where(eq(t.appointments.id, id));
  } catch (e) {
    if (isExclusionViolation(e)) throw new ConflictError();
    throw e;
  }
  await audit({
    actorId,
    action: "appointment.update",
    entity: "appointment",
    entityId: id,
    meta: { moved: Boolean(patch.startsAt), retyped: Boolean(patch.typeId), note: patch.note !== undefined },
  });
  return (await getAppointment(id))!;
}

export async function setStatus(
  id: string,
  status: AppointmentStatus,
  actorId: string | null,
  by: "patient" | "praxis" | "system" = "praxis",
): Promise<AppointmentView> {
  const db = await getDb();
  const set: Partial<typeof t.appointments.$inferInsert> = { status };
  if (status === "cancelled") {
    set.cancelledAt = new Date();
    set.cancelledBy = by;
  }
  if (status === "confirmed" && by === "patient") set.confirmedByPatientAt = new Date();
  // Eine Reservierung endet mit jeder Entscheidung (Annahme, Absage, Ablauf)
  if (status !== "booked") set.holdUntil = null;
  await db.update(t.appointments).set(set).where(eq(t.appointments.id, id));
  await audit({ actorId, action: `appointment.${status}`, entity: "appointment", entityId: id, meta: { by } });
  return (await getAppointment(id))!;
}

// ---------- Verwaltungslinks & Missbrauchsschutz ----------

export async function findAppointmentByManageToken(token: string): Promise<AppointmentView | null> {
  const db = await getDb();
  const [row] = await db.select({ id: t.appointments.id }).from(t.appointments).where(eq(t.appointments.manageTokenHash, hashToken(token)));
  return row ? getAppointment(row.id) : null;
}

/** Das Klartext-Token eines Termins (für Erinnerungen); null, wenn keins vergeben. */
export async function manageTokenFor(id: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ enc: t.appointments.manageTokenEnc }).from(t.appointments).where(eq(t.appointments.id, id));
  if (!row?.enc) return null;
  return safeDecrypt(row.enc, `mtok:${id}`);
}

/** Neues Token vergeben (z. B. „Bestätigung erneut senden“ für einen Telefontermin). */
export async function issueManageToken(id: string, actorId: string | null): Promise<string> {
  const db = await getDb();
  const token = newManageToken();
  await db
    .update(t.appointments)
    .set({ manageTokenHash: hashToken(token), manageTokenEnc: encrypt(token, `mtok:${id}`) })
    .where(eq(t.appointments.id, id));
  await audit({ actorId, action: "appointment.token", entity: "appointment", entityId: id });
  return token;
}

/** Offene Zukunftstermine je E-Mail – Grundlage für „höchstens N“ bei Website-Buchungen. */
export async function countFutureActiveByEmail(email: string, now = new Date()): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(t.appointments)
    .where(and(eq(t.appointments.emailHash, emailHash(email)), inArray(t.appointments.status, ACTIVE_STATUSES), gt(t.appointments.startsAt, now)));
  return row?.n ?? 0;
}

/** Reservierte Wartelisten-Termine, deren Frist abgelaufen ist. */
export async function expiredHolds(now = new Date()): Promise<AppointmentView[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: t.appointments.id })
    .from(t.appointments)
    .where(and(isNotNull(t.appointments.holdUntil), lt(t.appointments.holdUntil, now), eq(t.appointments.status, "booked")));
  const out: AppointmentView[] = [];
  for (const r of rows) {
    const v = await getAppointment(r.id);
    if (v) out.push(v);
  }
  return out;
}

/** Aktive Termine in einem Zeitfenster, die noch nicht an eine Erinnerung gedacht wurden. */
export async function appointmentsForReminder(from: Date, to: Date): Promise<AppointmentView[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: t.appointments.id })
    .from(t.appointments)
    .where(and(inArray(t.appointments.status, ["booked", "confirmed", "reminded"]), gte(t.appointments.startsAt, from), lt(t.appointments.startsAt, to), isNull(t.appointments.holdUntil)));
  const out: AppointmentView[] = [];
  for (const r of rows) {
    const v = await getAppointment(r.id);
    if (v && v.pii.email && !v.isDemo) out.push(v);
  }
  return out;
}

export async function markReminded(id: string) {
  const db = await getDb();
  await db
    .update(t.appointments)
    .set({ remindedAt: new Date(), status: sql`CASE WHEN ${t.appointments.status} = 'booked' THEN 'reminded' ELSE ${t.appointments.status} END` })
    .where(eq(t.appointments.id, id));
}

// ---------- Warteliste ----------

interface WaitlistPii extends Pii {
  email?: string;
}

function toWaitlistView(r: typeof t.waitlist.$inferSelect, type: { label: string; color: TypeColor } | null): WaitlistView {
  let pii: Pii;
  try {
    pii = decryptJson<WaitlistPii>(r.piiEnc, `wl:${r.id}`);
  } catch {
    pii = { firstName: "—", lastName: "(nicht lesbar)" };
  }
  return {
    id: r.id,
    ref: r.ref,
    typeId: r.typeId,
    typeLabel: type?.label ?? r.typeId,
    color: type?.color ?? "slate",
    pii,
    windowFrom: r.windowFrom?.toISOString() ?? null,
    windowTo: r.windowTo?.toISOString() ?? null,
    note: r.noteEnc ? safeDecrypt(r.noteEnc, `wlnote:${r.id}`) : null,
    status: r.status,
    source: r.source,
    offeredAppointmentId: r.offeredAppointmentId,
    offeredAt: r.offeredAt?.toISOString() ?? null,
    offerExpiresAt: r.offerExpiresAt?.toISOString() ?? null,
    isDemo: r.isDemo,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listWaitlist(opts: { includeClosed?: boolean } = {}): Promise<WaitlistView[]> {
  const db = await getDb();
  const rows = await db
    .select({ w: t.waitlist, type: { label: t.appointmentTypes.label, color: t.appointmentTypes.color } })
    .from(t.waitlist)
    .leftJoin(t.appointmentTypes, eq(t.waitlist.typeId, t.appointmentTypes.id))
    .where(opts.includeClosed ? undefined : inArray(t.waitlist.status, ["open", "offered"]))
    .orderBy(asc(t.waitlist.createdAt));
  return rows.map((r) => toWaitlistView(r.w, r.type));
}

export async function getWaitlistEntry(id: string): Promise<WaitlistView | null> {
  const db = await getDb();
  const [r] = await db
    .select({ w: t.waitlist, type: { label: t.appointmentTypes.label, color: t.appointmentTypes.color } })
    .from(t.waitlist)
    .leftJoin(t.appointmentTypes, eq(t.waitlist.typeId, t.appointmentTypes.id))
    .where(eq(t.waitlist.id, id));
  return r ? toWaitlistView(r.w, r.type) : null;
}

export async function findWaitlistByManageToken(token: string): Promise<WaitlistView | null> {
  const db = await getDb();
  const [row] = await db.select({ id: t.waitlist.id }).from(t.waitlist).where(eq(t.waitlist.manageTokenHash, hashToken(token)));
  return row ? getWaitlistEntry(row.id) : null;
}

export async function waitlistManageTokenFor(id: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ enc: t.waitlist.manageTokenEnc }).from(t.waitlist).where(eq(t.waitlist.id, id));
  return row?.enc ? safeDecrypt(row.enc, `wltok:${id}`) : null;
}

export interface CreateWaitlistInput {
  typeId: string;
  pii: Pii;
  windowFrom?: Date | null;
  windowTo?: Date | null;
  note?: string | null;
  source: "web" | "cockpit" | "telefon";
  manageToken?: string;
  isDemo?: boolean;
  actorId?: string | null;
}

export async function createWaitlistEntry(input: CreateWaitlistInput): Promise<WaitlistView> {
  const type = await getType(input.typeId);
  if (!type) throw new Error("Unbekannte Terminart");
  const db = await getDb();
  const id = randomUUID();
  const pii: Pii = {
    firstName: input.pii.firstName.trim(),
    lastName: input.pii.lastName.trim(),
    email: input.pii.email?.trim() || undefined,
    phone: input.pii.phone?.trim() || undefined,
  };
  const values = {
    id,
    typeId: type.id,
    piiEnc: encryptJson(pii, `wl:${id}`),
    emailHash: pii.email ? emailHash(pii.email) : null,
    phoneHash: pii.phone ? phoneHash(pii.phone) : null,
    manageTokenHash: input.manageToken ? hashToken(input.manageToken) : null,
    manageTokenEnc: input.manageToken ? encrypt(input.manageToken, `wltok:${id}`) : null,
    windowFrom: input.windowFrom ?? null,
    windowTo: input.windowTo ?? null,
    noteEnc: input.note?.trim() ? encrypt(input.note.trim(), `wlnote:${id}`) : null,
    source: input.source,
    isDemo: input.isDemo ?? false,
    keyVersion: currentKeyVersion(),
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db.insert(t.waitlist).values({ ...values, ref: makeRef("WL") });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
  await audit({ actorId: input.actorId ?? null, action: "waitlist.create", entity: "waitlist", entityId: id, meta: { typeId: type.id, source: input.source } });
  return (await getWaitlistEntry(id))!;
}

export async function setWaitlistStatus(
  id: string,
  status: WaitlistStatus,
  actorId: string | null,
  extra: { offeredAppointmentId?: string | null; offerExpiresAt?: Date | null } = {},
): Promise<WaitlistView> {
  const db = await getDb();
  const set: Partial<typeof t.waitlist.$inferInsert> = { status };
  if (status === "offered") {
    set.offeredAppointmentId = extra.offeredAppointmentId ?? null;
    set.offeredAt = new Date();
    set.offerExpiresAt = extra.offerExpiresAt ?? null;
  }
  if (status === "open") {
    set.offeredAppointmentId = null;
    set.offerExpiresAt = null;
  }
  await db.update(t.waitlist).set(set).where(eq(t.waitlist.id, id));
  await audit({ actorId, action: `waitlist.${status}`, entity: "waitlist", entityId: id });
  return (await getWaitlistEntry(id))!;
}

export async function waitlistByOfferedAppointment(appointmentId: string): Promise<WaitlistView | null> {
  const db = await getDb();
  const [row] = await db.select({ id: t.waitlist.id }).from(t.waitlist).where(and(eq(t.waitlist.offeredAppointmentId, appointmentId), eq(t.waitlist.status, "offered")));
  return row ? getWaitlistEntry(row.id) : null;
}

/**
 * Älteste offene Person, deren Wunschfenster den freien Zeitpunkt umfasst
 * (oder die kein Fenster gesetzt hat) – und die eine E-Mail hinterlassen hat.
 */
export async function nextWaitlistCandidate(typeId: string, slotStart: Date): Promise<WaitlistView | null> {
  const db = await getDb();
  const rows = await db
    .select({ id: t.waitlist.id })
    .from(t.waitlist)
    .where(
      and(
        eq(t.waitlist.typeId, typeId),
        eq(t.waitlist.status, "open"),
        isNotNull(t.waitlist.emailHash),
        or(isNull(t.waitlist.windowFrom), lte(t.waitlist.windowFrom, slotStart)),
        or(isNull(t.waitlist.windowTo), gte(t.waitlist.windowTo, slotStart)),
      ),
    )
    .orderBy(asc(t.waitlist.createdAt))
    .limit(1);
  return rows[0] ? getWaitlistEntry(rows[0].id) : null;
}

export async function countWaitlistOpen(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(t.waitlist).where(inArray(t.waitlist.status, ["open", "offered"]));
  return row?.n ?? 0;
}

// ---------- Versandprotokoll ----------

export interface MessageLogRow {
  id: string;
  channel: "email" | "sms";
  kind: string;
  appointmentId: string | null;
  status: "queued" | "sent" | "bounced" | "failed";
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export async function recentMessages(limit = 25): Promise<MessageLogRow[]> {
  const db = await getDb();
  const rows = await db.select().from(t.messages).orderBy(desc(t.messages.createdAt)).limit(limit);
  return rows.map((m) => ({
    id: m.id,
    channel: m.channel,
    kind: m.kind,
    appointmentId: m.appointmentId,
    status: m.status,
    error: m.error,
    sentAt: m.sentAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function messageSent(appointmentId: string, kind: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(t.messages)
    .where(and(eq(t.messages.appointmentId, appointmentId), eq(t.messages.kind, kind), inArray(t.messages.status, ["sent", "queued"])));
  return (row?.n ?? 0) > 0;
}

export async function logMessage(input: {
  channel: "email" | "sms";
  kind: string;
  appointmentId?: string | null;
  requestId?: string | null;
  waitlistId?: string | null;
  status: "sent" | "failed";
  providerId?: string | null;
  error?: string | null;
}) {
  const db = await getDb();
  await db.insert(t.messages).values({
    channel: input.channel,
    kind: input.kind,
    appointmentId: input.appointmentId ?? null,
    requestId: input.requestId ?? null,
    waitlistId: input.waitlistId ?? null,
    providerId: input.providerId ?? null,
    status: input.status,
    error: input.error ?? null,
    sentAt: input.status === "sent" ? new Date() : null,
  });
}

/** Vorbereitungshinweis je Terminart – von der Praxis gepflegt, sonst leer. */
export async function prepTextFor(typeId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ body: t.messageTemplates.body }).from(t.messageTemplates).where(eq(t.messageTemplates.key, `prep:${typeId}`));
  return row?.body?.trim() || null;
}

// ---------- Demo ----------

export async function countDemo(): Promise<number> {
  const db = await getDb();
  const [[a], [e], [r], [w]] = await Promise.all([
    db.select({ n: count() }).from(t.appointments).where(eq(t.appointments.isDemo, true)),
    db.select({ n: count() }).from(t.calendarExceptions).where(eq(t.calendarExceptions.isDemo, true)),
    db.select({ n: count() }).from(t.requests).where(eq(t.requests.isDemo, true)),
    db.select({ n: count() }).from(t.waitlist).where(eq(t.waitlist.isDemo, true)),
  ]);
  return (a?.n ?? 0) + (e?.n ?? 0) + (r?.n ?? 0) + (w?.n ?? 0);
}

export async function purgeDemo(actorId: string): Promise<number> {
  const db = await getDb();
  const before = await countDemo();
  await db.transaction(async (tx) => {
    await tx.delete(t.appointments).where(eq(t.appointments.isDemo, true));
    await tx.delete(t.calendarExceptions).where(eq(t.calendarExceptions.isDemo, true));
    await tx.delete(t.requests).where(eq(t.requests.isDemo, true));
    await tx.delete(t.waitlist).where(eq(t.waitlist.isDemo, true));
  });
  await audit({ actorId, action: "demo.purge", entity: "demo", meta: { removed: before } });
  return before;
}

// ---------- Dashboard ----------

export interface TodayOverview {
  date: string;
  appointments: AppointmentView[];
  counts: Record<"total" | "open" | "confirmed" | "completed" | "noShow" | "cancelled", number>;
  weekLoad: Array<{ date: string; count: number }>;
  openRequests: number;
  /** Website-Buchungen der letzten 7 Tage */
  webBookingsWeek: number;
  waitlistOpen: number;
  demoCount: number;
  bookingLive: boolean;
  bookingPaused: boolean;
}

export async function todayOverview(now = new Date()): Promise<TodayOverview> {
  const date = dateKey(now);
  const from = startOfDay(date);
  const to = startOfDay(addDays(date, 1));
  const [appointments, settings, demoCount] = await Promise.all([
    listAppointments(from, to, { includeCancelled: true }),
    getSettings(),
    countDemo(),
  ]);
  const counts = { total: 0, open: 0, confirmed: 0, completed: 0, noShow: 0, cancelled: 0 };
  for (const a of appointments) {
    if (a.status === "cancelled") {
      counts.cancelled++;
      continue;
    }
    counts.total++;
    if (a.status === "booked" || a.status === "reminded") counts.open++;
    if (a.status === "confirmed") counts.confirmed++;
    if (a.status === "completed") counts.completed++;
    if (a.status === "no_show") counts.noShow++;
  }

  const monday = startOfWeek(date);
  const db = await getDb();
  const weekRows = await db
    .select({ day: sql<string>`to_char(${t.appointments.startsAt} at time zone 'Europe/Berlin', 'YYYY-MM-DD')`, n: count() })
    .from(t.appointments)
    .where(
      and(
        gte(t.appointments.startsAt, startOfDay(monday)),
        lt(t.appointments.startsAt, startOfDay(addDays(monday, 7))),
        inArray(t.appointments.status, [...ACTIVE_STATUSES, "completed", "no_show"]),
      ),
    )
    .groupBy(sql`1`);
  const weekMap = new Map(weekRows.map((r) => [r.day, Number(r.n)]));
  const weekLoad = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: d, count: weekMap.get(d) ?? 0 };
  });

  const [openRow] = await db
    .select({ n: count() })
    .from(t.requests)
    .where(inArray(t.requests.status, ["neu", "in_arbeit", "wartet"]));
  const openRequests = openRow?.n ?? 0;
  const [webRow] = await db
    .select({ n: count() })
    .from(t.appointments)
    .where(and(eq(t.appointments.source, "web"), gte(t.appointments.createdAt, new Date(now.getTime() - 7 * 86_400_000))));
  const waitlistOpen = await countWaitlistOpen();

  return {
    date,
    appointments,
    counts,
    weekLoad,
    openRequests: Number(openRequests ?? 0),
    webBookingsWeek: Number(webRow?.n ?? 0),
    waitlistOpen,
    demoCount,
    bookingLive: settings.bookingLive,
    bookingPaused: settings.bookingPaused,
  };
}

/** Nächster freier Slot ab jetzt für eine Terminart – für den Schnellblick im Dashboard. */
export async function nextFreeSlot(typeId: string, now = new Date(), horizonDays = 21) {
  let date = dateKey(now);
  for (let i = 0; i < horizonDays; i++) {
    const slots = await availability(typeId, date, now);
    if (slots.length) return slots[0]!;
    date = addDays(date, 1);
  }
  return null;
}

export const helpers = { lte };
