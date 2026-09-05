import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
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
} from "./model.ts";

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
  };
}

export async function updateSettings(
  patch: Partial<Pick<SettingsView, "slotStepMin" | "bookingPaused" | "bannerText" | "autoReplyText">> & {
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

  const set: Partial<typeof t.appointments.$inferInsert> = { typeId, startsAt, endsAt, bufferMin: type.bufferMin };
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
  await db.update(t.appointments).set(set).where(eq(t.appointments.id, id));
  await audit({ actorId, action: `appointment.${status}`, entity: "appointment", entityId: id, meta: { by } });
  return (await getAppointment(id))!;
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

  return {
    date,
    appointments,
    counts,
    weekLoad,
    openRequests: Number(openRequests ?? 0),
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
