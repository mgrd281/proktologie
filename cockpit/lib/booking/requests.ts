import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit.ts";
import { currentKeyVersion, decryptJson, encryptJson } from "../crypto/aead.ts";
import { getDb } from "../db/client.ts";
import * as t from "../db/schema.ts";
import { makeRef } from "../ref.ts";

/**
 * Anfragen der Patient:innen, die kein Termin sind: Rückruf, Folgerezept,
 * Überweisung, Befundkopie. Sie landen im Posteingang des Cockpits, nicht
 * in einem Mail-Fach – mit Frist, Status und verschlüsselten Kontaktdaten.
 *
 * Bewusst ohne Gesundheitsbezug: Es wird nie nach Symptomen, Diagnosen
 * oder Medikamenten gefragt. Was die Patientin von sich aus schreibt,
 * steht verschlüsselt in `messageEnc` und verlässt den Server nur an
 * angemeldete Cockpit-Nutzer.
 */
export type RequestKind = "rueckruf" | "folgerezept" | "ueberweisung" | "befundkopie" | "sonstiges";
export type RequestStatus = "neu" | "in_arbeit" | "wartet" | "erledigt";

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  rueckruf: "Rückruf",
  folgerezept: "Folgerezept",
  ueberweisung: "Überweisung",
  befundkopie: "Befundkopie",
  sonstiges: "Sonstiges",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  neu: "Neu",
  in_arbeit: "In Arbeit",
  wartet: "Wartet",
  erledigt: "Erledigt",
};

/** Offen = liegt noch beim Team. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ["neu", "in_arbeit", "wartet"];

export interface RequestPii {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

export interface RequestMessage {
  /** Freitext der Patientin – kann leer sein */
  text: string;
  source: "chat" | "web";
  /** Wunschzeit für den Rückruf */
  preferredTime?: "egal" | "vormittags" | "nachmittags";
  locale?: "de" | "en";
}

export interface RequestView {
  id: string;
  ref: string;
  kind: RequestKind;
  status: RequestStatus;
  assigneeId: string | null;
  pii: RequestPii;
  message: RequestMessage | null;
  slaDueAt: string | null;
  closedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Standardfrist, bis sich das Team gemeldet haben soll. */
const DEFAULT_SLA_HOURS = 24;

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string }; message?: string };
  const code = err?.code ?? err?.cause?.code;
  return code === "23505" || /requests_ref_idx/.test(`${err?.message ?? ""}`);
};

function safeJson<T>(env: string | null, aad: string): T | null {
  if (!env) return null;
  try {
    return decryptJson<T>(env, aad);
  } catch {
    return null;
  }
}

function toView(r: typeof t.requests.$inferSelect): RequestView {
  return {
    id: r.id,
    ref: r.ref,
    kind: r.kind,
    status: r.status,
    assigneeId: r.assigneeId,
    pii: safeJson<RequestPii>(r.piiEnc, `req:${r.id}`) ?? { firstName: "—", lastName: "" },
    message: safeJson<RequestMessage>(r.messageEnc, `reqmsg:${r.id}`),
    slaDueAt: r.slaDueAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    isDemo: r.isDemo,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export interface CreateRequestInput {
  kind: RequestKind;
  pii: RequestPii;
  message?: RequestMessage | null;
  slaHours?: number;
  isDemo?: boolean;
  actorId?: string | null;
}

export async function createRequest(input: CreateRequestInput): Promise<RequestView> {
  const db = await getDb();
  const id = randomUUID();
  const pii: RequestPii = {
    firstName: input.pii.firstName.trim(),
    lastName: input.pii.lastName.trim(),
    phone: input.pii.phone?.trim() || undefined,
    email: input.pii.email?.trim() || undefined,
  };
  const now = new Date();
  const values = {
    id,
    kind: input.kind,
    status: "neu" as const,
    piiEnc: encryptJson(pii, `req:${id}`),
    messageEnc: input.message ? encryptJson(input.message, `reqmsg:${id}`) : null,
    slaDueAt: new Date(now.getTime() + (input.slaHours ?? DEFAULT_SLA_HOURS) * 3600_000),
    isDemo: input.isDemo ?? false,
    keyVersion: currentKeyVersion(),
  };
  // Referenz kollidiert praktisch nie; der Unique-Index entscheidet, wir wiederholen
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await db.insert(t.requests).values({ ...values, ref: makeRef("AN") });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 5) continue;
      throw e;
    }
  }
  await audit({
    actorId: input.actorId ?? null,
    action: "request.create",
    entity: "request",
    entityId: id,
    meta: { kind: input.kind, source: input.message?.source ?? "cockpit", isDemo: values.isDemo },
  });
  const view = await getRequest(id);
  if (!view) throw new Error("Anfrage konnte nicht gelesen werden");
  return view;
}

export async function getRequest(id: string): Promise<RequestView | null> {
  const db = await getDb();
  const [row] = await db.select().from(t.requests).where(eq(t.requests.id, id));
  return row ? toView(row) : null;
}

export async function listRequests(opts: { open?: boolean; limit?: number } = {}): Promise<RequestView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t.requests)
    .where(opts.open ? inArray(t.requests.status, OPEN_REQUEST_STATUSES) : undefined)
    // Offene zuerst nach Frist, damit das Team sieht, was drängt
    .orderBy(asc(t.requests.closedAt), asc(t.requests.slaDueAt), desc(t.requests.createdAt))
    .limit(opts.limit ?? 200);
  return rows.map(toView);
}

export async function setRequestStatus(id: string, status: RequestStatus, actorId: string | null): Promise<RequestView> {
  const db = await getDb();
  const rows = await db
    .update(t.requests)
    .set({ status, closedAt: status === "erledigt" ? new Date() : null, updatedAt: new Date() })
    .where(eq(t.requests.id, id))
    .returning({ id: t.requests.id });
  if (!rows.length) throw new Error("Anfrage nicht gefunden");
  await audit({ actorId, action: `request.${status}`, entity: "request", entityId: id, meta: {} });
  const view = await getRequest(id);
  if (!view) throw new Error("Anfrage nicht gefunden");
  return view;
}

export async function countOpenRequests(): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ id: t.requests.id }).from(t.requests).where(inArray(t.requests.status, OPEN_REQUEST_STATUSES));
  return rows.length;
}

export async function purgeDemoRequests(): Promise<number> {
  const db = await getDb();
  const rows = await db.delete(t.requests).where(eq(t.requests.isDemo, true)).returning({ id: t.requests.id });
  return rows.length;
}

/** Eingabe einer Rückrufbitte – dieselbe Form für Website und Chat. */
export const callbackSchema = z.object({
  kind: z.enum(["rueckruf", "folgerezept", "ueberweisung", "befundkopie", "sonstiges"]).default("rueckruf"),
  firstName: z.string().trim().min(1, "Vorname fehlt").max(80),
  lastName: z.string().trim().min(1, "Nachname fehlt").max(80),
  phone: z.string().trim().min(5, "Telefonnummer fehlt").max(40),
  email: z.string().trim().email("E-Mail ungültig").max(200).optional().or(z.literal("")),
  preferredTime: z.enum(["egal", "vormittags", "nachmittags"]).default("egal"),
  /** Freitext; Gesundheitsangaben werden vom Aufrufer vorher gefiltert. */
  note: z.string().trim().max(500).optional().or(z.literal("")),
  locale: z.enum(["de", "en"]).default("de"),
});
export type CallbackInput = z.input<typeof callbackSchema>;

/**
 * Fehler mit Absicht: Der Aufrufer bestimmt Status und Code der Antwort.
 * Felder werden bewusst einzeln zugewiesen statt als Parameter-Properties –
 * nur so lässt sich diese Datei mit `node --test` laden (strip-only-Modus
 * kennt keine Parameter-Properties).
 */
export class RequestError extends Error {
  readonly status: number;
  readonly code: "rate_limited" | "validation" | "blocked";

  constructor(status: number, code: "rate_limited" | "validation" | "blocked", message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface CallbackContext {
  ip: string;
  source: "chat" | "web";
  now?: Date;
  /** Gesperrte Adressen: der Aufrufer entscheidet, hier wird nur gefragt. */
  isBlocked?: (email: string | undefined, phone: string) => boolean;
}

/**
 * Rückrufbitte von außen: Rate-Limit je IP, Prüfung, Sperrliste, Anlage.
 * Der Versand der Praxis-Meldung geschieht über die Job-Warteschlange –
 * eingereiht vom Aufrufer, damit dieses Modul ohne Mail-Abhängigkeit
 * (und damit ohne Import von send.ts) in Node-Tests läuft.
 */
export async function createCallbackRequest(raw: unknown, ctx: CallbackContext): Promise<RequestView> {
  const now = ctx.now ?? new Date();
  const { hit } = await import("../ratelimit.ts");
  const rl = await hit("request", ctx.ip, { limit: 6, windowSec: 3600 }, now);
  if (!rl.ok) throw new RequestError(429, "rate_limited", "Zu viele Anfragen. Bitte rufen Sie uns an.");

  const parsed = callbackSchema.safeParse(raw);
  if (!parsed.success) throw new RequestError(422, "validation", parsed.error.issues.map((i) => i.message).join(" "));
  const v = parsed.data;
  const email = v.email || undefined;
  if (ctx.isBlocked?.(email, v.phone)) {
    throw new RequestError(403, "blocked", "Bitte rufen Sie uns an: 040 490 80 21.");
  }

  return createRequest({
    kind: v.kind,
    pii: { firstName: v.firstName, lastName: v.lastName, phone: v.phone, email },
    message: { text: v.note || "", source: ctx.source, preferredTime: v.preferredTime, locale: v.locale },
  });
}
