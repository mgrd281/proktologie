/**
 * Datenmodell des Cockpits. Die Auth-Tabellen kommen aus auth-schema.ts
 * (Better-Auth-CLI), alles Fachliche steht hier.
 *
 * Grundsätze:
 * - Personenbezogene Felder liegen verschlüsselt in *_enc (AES-256-GCM,
 *   lib/crypto/aead.ts); gesucht wird über Blind-Indizes (*_hash).
 * - Kein Feld enthält Nachrichtentexte oder Gesundheitsdaten im Klartext.
 * - is_demo markiert Vorführdaten – sie sind jederzeit löschbar, und der
 *   Live-Betrieb lässt sich nicht einschalten, solange welche existieren.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export * from "./auth-schema.ts";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);

/** Singleton-Zeile (id = 'default'). */
export const practiceSettings = pgTable("practice_settings", {
  id: text("id").primaryKey().default("default"),
  slotStepMin: smallint("slot_step_min").notNull().default(15),
  bookingLive: boolean("booking_live").notNull().default(false),
  bookingPaused: boolean("booking_paused").notNull().default(false),
  pauseFrom: ts("pause_from"),
  pauseTo: ts("pause_to"),
  bannerText: text("banner_text"),
  autoReplyText: text("auto_reply_text"),
  powEnabled: boolean("pow_enabled").notNull().default(false),
  intakeRetentionDays: smallint("intake_retention_days").notNull().default(30),
  reminderOffsetsH: jsonb("reminder_offsets_h").$type<number[]>().notNull().default([48, 24]),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const invites = pgTable(
  "invites",
  {
    id: id(),
    email: text("email").notNull(),
    role: text("role").notNull().default("empfang"),
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by"),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invites_token_hash_idx").on(t.tokenHash)],
);

export const appointmentTypes = pgTable("appointment_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  note: text("note"),
  durationMin: smallint("duration_min").notNull().default(20),
  bufferMin: smallint("buffer_min").notNull().default(0),
  capacity: smallint("capacity").notNull().default(1),
  visibility: text("visibility").$type<"public" | "intern">().notNull().default("public"),
  leadTimeHours: smallint("lead_time_hours").notNull().default(24),
  maxAheadDays: smallint("max_ahead_days").notNull().default(56),
  prepTemplateId: text("prep_template_id"),
  color: text("color").$type<"green" | "moss" | "amber" | "slate" | "blue">().notNull().default("green"),
  sortOrder: smallint("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** Wochentag ISO (1 = Montag … 7 = Sonntag), Zeiten als "HH:MM" lokal (Europe/Berlin). */
export const openingHours = pgTable("opening_hours", {
  id: id(),
  weekday: smallint("weekday").notNull(),
  opens: text("opens").notNull(),
  closes: text("closes").notNull(),
  validFrom: ts("valid_from"),
  validTo: ts("valid_to"),
});

export const calendarExceptions = pgTable(
  "calendar_exceptions",
  {
    id: id(),
    kind: text("kind").$type<"closed" | "blocker" | "urlaub" | "extern">().notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    allDay: boolean("all_day").notNull().default(false),
    label: text("label"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("calendar_exceptions_span_idx").on(t.startsAt, t.endsAt)],
);

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "reminded"
  | "completed"
  | "no_show"
  | "cancelled";

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    ref: text("ref").notNull(),
    typeId: text("type_id")
      .notNull()
      .references(() => appointmentTypes.id),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    bufferMin: smallint("buffer_min").notNull().default(0),
    status: text("status").$type<AppointmentStatus>().notNull().default("booked"),
    source: text("source").$type<"web" | "cockpit" | "telefon">().notNull().default("cockpit"),
    /** { firstName, lastName, email, phone } – verschlüsselt, AAD = "appt:<id>" */
    piiEnc: text("pii_enc").notNull(),
    emailHash: text("email_hash"),
    phoneHash: text("phone_hash"),
    nameKey: text("name_key"),
    /** Interne Notiz des Teams – verschlüsselt (kann Gesundheitsbezug haben). */
    noteEnc: text("note_enc"),
    manageTokenHash: text("manage_token_hash"),
    remindedAt: ts("reminded_at"),
    confirmedByPatientAt: ts("confirmed_by_patient_at"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: text("cancelled_by").$type<"patient" | "praxis" | "system">(),
    isDemo: boolean("is_demo").notNull().default(false),
    keyVersion: smallint("key_version").notNull().default(1),
    createdBy: text("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("appointments_ref_idx").on(t.ref),
    index("appointments_starts_at_idx").on(t.startsAt),
    index("appointments_email_hash_idx").on(t.emailHash),
    index("appointments_phone_hash_idx").on(t.phoneHash),
    index("appointments_name_key_idx").on(t.nameKey),
    index("appointments_manage_token_idx").on(t.manageTokenHash),
  ],
);

export const waitlist = pgTable("waitlist", {
  id: id(),
  typeId: text("type_id")
    .notNull()
    .references(() => appointmentTypes.id),
  piiEnc: text("pii_enc").notNull(),
  emailHash: text("email_hash"),
  windowFrom: ts("window_from"),
  windowTo: ts("window_to"),
  offeredAppointmentId: text("offered_appointment_id"),
  offerExpiresAt: ts("offer_expires_at"),
  status: text("status").$type<"open" | "offered" | "booked" | "expired" | "withdrawn">().notNull().default("open"),
  isDemo: boolean("is_demo").notNull().default(false),
  keyVersion: smallint("key_version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const requests = pgTable(
  "requests",
  {
    id: id(),
    ref: text("ref").notNull(),
    kind: text("kind").$type<"rueckruf" | "folgerezept" | "ueberweisung" | "befundkopie" | "sonstiges">().notNull(),
    status: text("status").$type<"neu" | "in_arbeit" | "wartet" | "erledigt">().notNull().default("neu"),
    assigneeId: text("assignee_id"),
    piiEnc: text("pii_enc").notNull(),
    messageEnc: text("message_enc"),
    slaDueAt: ts("sla_due_at"),
    closedAt: ts("closed_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    keyVersion: smallint("key_version").notNull().default(1),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("requests_ref_idx").on(t.ref), index("requests_status_idx").on(t.status)],
);

export const messageTemplates = pgTable("message_templates", {
  key: text("key").primaryKey(),
  channel: text("channel").$type<"email" | "sms">().notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  variables: jsonb("variables").$type<string[]>().notNull().default([]),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Versandprotokoll – bewusst OHNE Nachrichtentext. */
export const messages = pgTable("messages", {
  id: id(),
  channel: text("channel").$type<"email" | "sms">().notNull(),
  kind: text("kind").notNull(),
  appointmentId: text("appointment_id"),
  requestId: text("request_id"),
  providerId: text("provider_id"),
  status: text("status").$type<"queued" | "sent" | "bounced" | "failed">().notNull().default("queued"),
  error: text("error"),
  sentAt: ts("sent_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const intakeForms = pgTable("intake_forms", {
  id: id(),
  appointmentId: text("appointment_id").notNull(),
  payloadEnc: text("payload_enc").notNull(),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
  deleteAfter: ts("delete_after").notNull(),
  keyVersion: smallint("key_version").notNull().default(1),
});

export const contentSnapshots = pgTable("content_snapshots", {
  id: id(),
  version: integer("version").notNull(),
  payload: jsonb("payload").notNull(),
  publishedBy: text("published_by"),
  publishedAt: ts("published_at").notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    runAt: ts("run_at").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    doneAt: ts("done_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("jobs_dedupe_idx").on(t.dedupeKey), index("jobs_due_idx").on(t.runAt, t.doneAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

/**
 * Revisionssicheres Protokoll: nur INSERT (Trigger in der Migration
 * verbietet UPDATE/DELETE), verkettet über prev_hash. Meta enthält nie PII.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    seq: integer("seq").generatedAlwaysAsIdentity(),
    at: ts("at").notNull().defaultNow(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)],
);
