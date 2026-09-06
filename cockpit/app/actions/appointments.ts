"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActorError, requireActor } from "@/lib/auth/actor";
import { afterBooked, afterCancelled, afterRescheduled, resendConfirmation } from "@/lib/booking/lifecycle";
import * as repo from "@/lib/booking/repo";
import type { AppointmentView, ExceptionView } from "@/lib/booking/model";
import { maybeTick } from "@/lib/jobs/tick";
import { zonedToUtc } from "@/lib/time";

/**
 * Server Actions des Terminmotors. Jede Action: Sitzung + Rolle prüfen,
 * Eingabe mit Zod validieren, an die Repo-Schicht delegieren, Pfade
 * invalidieren. Fehler kommen als { ok:false, error } zurück – keine
 * Stacktraces im Client.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActorError) return { ok: false, error: e.message };
    if (e instanceof repo.ConflictError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Unbekannter Fehler" };
  }
}

const piiSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname fehlt").max(80),
  lastName: z.string().trim().min(1, "Nachname fehlt").max(80),
  email: z.string().trim().email("E-Mail ungültig").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

const createSchema = z.object({
  typeId: z.string().min(1, "Terminart wählen"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit ungültig"),
  pii: piiSchema,
  note: z.string().trim().max(2000).optional(),
  source: z.enum(["cockpit", "telefon"]).default("cockpit"),
  ignoreOpeningHours: z.boolean().optional(),
});

export async function createAppointmentAction(input: z.input<typeof createSchema>): Promise<ActionResult<AppointmentView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = createSchema.parse(input);
    const email = v.pii.email || undefined;
    const view = await repo.createAppointment({
      typeId: v.typeId,
      startsAt: zonedToUtc(v.date, v.time),
      pii: { ...v.pii, email, phone: v.pii.phone || undefined },
      note: v.note,
      source: v.source,
      actorId: actor.id,
      ignoreOpeningHours: v.ignoreOpeningHours,
      // Mit E-Mail bekommt auch der Telefontermin Bestätigung, Kalenderdatei und Verwaltungslink
      manageToken: email ? repo.newManageToken() : undefined,
    });
    await afterBooked(view);
    void maybeTick();
    revalidatePath("/");
    revalidatePath("/termine");
    return view;
  });
}

const updateSchema = z.object({
  id: z.string().min(1),
  typeId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  pii: piiSchema.optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export async function updateAppointmentAction(input: z.input<typeof updateSchema>): Promise<ActionResult<AppointmentView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = updateSchema.parse(input);
    const before = await repo.getAppointment(v.id);
    const view = await repo.updateAppointment(
      v.id,
      {
        typeId: v.typeId,
        startsAt: v.date && v.time ? zonedToUtc(v.date, v.time) : undefined,
        pii: v.pii ? { ...v.pii, email: v.pii.email || undefined, phone: v.pii.phone || undefined } : undefined,
        note: v.note,
      },
      actor.id,
    );
    // Verschoben → neue Kalenderdatei an die Person, alter Platz an die Warteliste
    if (before && view.sequence > before.sequence) {
      await afterRescheduled(view);
      await afterCancelled({ ...before, holdUntil: null }, "praxis", { notify: false });
      void maybeTick();
    }
    revalidatePath("/");
    revalidatePath("/termine");
    return view;
  });
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["booked", "confirmed", "reminded", "completed", "no_show", "cancelled"]),
});

export async function setStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<AppointmentView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = statusSchema.parse(input);
    const before = await repo.getAppointment(v.id);
    const view = await repo.setStatus(v.id, v.status, actor.id, "praxis");
    if (v.status === "cancelled" && before && before.status !== "cancelled") {
      await afterCancelled({ ...view, holdUntil: before.holdUntil }, "praxis");
      void maybeTick();
    }
    revalidatePath("/");
    revalidatePath("/termine");
    revalidatePath("/warteliste");
    return view;
  });
}

/** „Bestätigung erneut senden“ – auch für Telefontermine, die nachträglich eine E-Mail bekommen haben. */
export async function resendConfirmationAction(id: string): Promise<ActionResult<{ sent: boolean; detail: string }>> {
  return guard(async () => {
    const actor = await requireActor();
    const r = await resendConfirmation(z.string().min(1).parse(id), actor.id);
    revalidatePath("/termine");
    if (r.sent) return { sent: true, detail: "Bestätigung mit Kalenderdatei verschickt." };
    const detail =
      r.reason === "no_email" ? "Keine E-Mail-Adresse hinterlegt." : r.reason === "failed" ? `Versand fehlgeschlagen: ${r.error ?? "unbekannt"}` : "Nicht verschickt.";
    return { sent: false, detail };
  });
}

const exceptionSchema = z.object({
  kind: z.enum(["closed", "blocker", "urlaub", "extern"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().default(false),
  label: z.string().trim().max(120).optional(),
});

export async function createExceptionAction(input: z.input<typeof exceptionSchema>): Promise<ActionResult<ExceptionView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = exceptionSchema.parse(input);
    const startsAt = zonedToUtc(v.fromDate, v.allDay ? "00:00" : (v.fromTime ?? "00:00"));
    const endsAt = v.allDay
      ? zonedToUtc(addDay(v.toDate), "00:00")
      : zonedToUtc(v.toDate, v.toTime ?? "23:59");
    const view = await repo.createException({ kind: v.kind, startsAt, endsAt, allDay: v.allDay, label: v.label }, actor.id);
    revalidatePath("/termine");
    revalidatePath("/einstellungen/sprechzeiten");
    return view;
  });
}

function addDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return x.toISOString().slice(0, 10);
}

export async function deleteExceptionAction(id: string): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor();
    await repo.deleteException(z.string().min(1).parse(id), actor.id);
    revalidatePath("/termine");
    revalidatePath("/einstellungen/sprechzeiten");
    return null;
  });
}

export async function availabilityAction(typeId: string, date: string): Promise<ActionResult<string[]>> {
  return guard(async () => {
    await requireActor();
    const slots = await repo.availability(z.string().parse(typeId), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date));
    return slots.map((s) => s.time);
  });
}
