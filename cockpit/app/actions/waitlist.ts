"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActorError, requireActor } from "@/lib/auth/actor";
import { offerEntry } from "@/lib/booking/lifecycle";
import type { WaitlistView } from "@/lib/booking/model";
import * as repo from "@/lib/booking/repo";
import { enqueue } from "@/lib/jobs/queue";
import { maybeTick } from "@/lib/jobs/tick";
import { startOfDay, zonedToUtc } from "@/lib/time";
import type { ActionResult } from "./appointments";

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

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  typeId: z.string().min(1, "Terminart wählen"),
  firstName: z.string().trim().min(1, "Vorname fehlt").max(80),
  lastName: z.string().trim().min(1, "Nachname fehlt").max(80),
  email: z.string().trim().email("E-Mail ungültig").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  windowFrom: z.string().regex(dateRe).optional().or(z.literal("")),
  windowTo: z.string().regex(dateRe).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional(),
  source: z.enum(["telefon", "cockpit"]).default("telefon"),
});

/** Eintrag am Empfang (Telefon/vor Ort). Mit E-Mail geht eine Bestätigung raus. */
export async function createWaitlistAction(input: z.input<typeof createSchema>): Promise<ActionResult<WaitlistView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = createSchema.parse(input);
    if (v.windowFrom && v.windowTo && v.windowFrom > v.windowTo) throw new Error("Das Wunschfenster endet vor seinem Beginn.");
    const token = v.email ? repo.newManageToken() : undefined;
    const w = await repo.createWaitlistEntry({
      typeId: v.typeId,
      pii: { firstName: v.firstName, lastName: v.lastName, email: v.email || undefined, phone: v.phone || undefined },
      windowFrom: v.windowFrom ? startOfDay(v.windowFrom) : null,
      windowTo: v.windowTo ? zonedToUtc(v.windowTo, "23:59") : null,
      note: v.note ?? null,
      source: v.source,
      manageToken: token,
      actorId: actor.id,
    });
    if (w.pii.email) {
      await enqueue({ kind: "mail.waitlist_joined", payload: { waitlistId: w.id }, dedupeKey: `mail.waitlist_joined:${w.id}` });
      void maybeTick();
    }
    revalidatePath("/warteliste");
    revalidatePath("/");
    return w;
  });
}

const statusSchema = z.object({ id: z.string().min(1), status: z.enum(["open", "withdrawn"]) });

export async function setWaitlistStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<WaitlistView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = statusSchema.parse(input);
    const w = await repo.setWaitlistStatus(v.id, v.status, actor.id);
    revalidatePath("/warteliste");
    revalidatePath("/");
    return w;
  });
}

const offerSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(dateRe, "Datum ungültig"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Uhrzeit ungültig"),
});

/** Gezieltes Angebot: dieser Person diesen Platz reservieren, Mail geht raus. */
export async function offerWaitlistAction(input: z.input<typeof offerSchema>): Promise<ActionResult<{ appointmentId: string; ref: string }>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = offerSchema.parse(input);
    const r = await offerEntry(v.id, zonedToUtc(v.date, v.time), actor.id);
    void maybeTick();
    revalidatePath("/warteliste");
    revalidatePath("/termine");
    revalidatePath("/");
    return r;
  });
}
