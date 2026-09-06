"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActorError, requireActor } from "@/lib/auth/actor";
import * as repo from "@/lib/booking/repo";
import type { HoursRow, TypeView } from "@/lib/booking/model";
import { seedDemo } from "@/lib/demo/seed";
import type { ActionResult } from "./appointments";

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActorError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof Error) return { ok: false, error: e.message };
    return { ok: false, error: "Unbekannter Fehler" };
  }
}

const typeSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(2, "Bezeichnung fehlt").max(80),
  note: z.string().trim().max(200).nullable().optional(),
  durationMin: z.number().int().min(5).max(240),
  bufferMin: z.number().int().min(0).max(120),
  visibility: z.enum(["public", "intern"]),
  leadTimeHours: z.number().int().min(0).max(24 * 30),
  maxAheadDays: z.number().int().min(1).max(365),
  color: z.enum(["green", "moss", "amber", "slate", "blue"]),
  sortOrder: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

export async function saveTypeAction(input: z.input<typeof typeSchema>): Promise<ActionResult<TypeView>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["arzt", "admin"] });
    const v = typeSchema.parse(input);
    const view = await repo.saveType({ ...v, note: v.note ?? null }, actor.id);
    revalidatePath("/einstellungen");
    revalidatePath("/termine");
    return view;
  });
}

const hoursSchema = z.array(
  z.object({
    weekday: z.number().int().min(1).max(7),
    opens: z.string().regex(/^\d{2}:\d{2}$/),
    closes: z.string().regex(/^\d{2}:\d{2}$/),
  }),
);

export async function replaceHoursAction(rows: HoursRow[]): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["arzt", "admin"] });
    await repo.replaceHours(hoursSchema.parse(rows), actor.id);
    revalidatePath("/einstellungen/sprechzeiten");
    revalidatePath("/termine");
    return null;
  });
}

const settingsSchema = z.object({
  slotStepMin: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]).optional(),
  bookingPaused: z.boolean().optional(),
  bookingLive: z.boolean().optional(),
  bannerText: z.string().trim().max(300).nullable().optional(),
  autoReplyText: z.string().trim().max(1000).nullable().optional(),
  siteUrl: z.string().trim().url().max(200).nullable().optional(),
  waitlistHoldHours: z.number().int().min(1).max(72).optional(),
  maxFuturePerEmail: z.number().int().min(1).max(10).optional(),
  reminderOffsetsH: z.array(z.number().int().min(1).max(24 * 14)).max(4).optional(),
});

export async function updateSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["arzt", "admin"], fresh: input.bookingLive === true });
    await repo.updateSettings(settingsSchema.parse(input), actor.id);
    revalidatePath("/");
    revalidatePath("/einstellungen/demo");
    return null;
  });
}

export async function seedDemoAction(): Promise<ActionResult<{ appointments: number }>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["arzt", "admin"] });
    const settings = await repo.getSettings();
    if (settings.bookingLive) throw new Error("Im Live-Betrieb werden keine Demo-Daten angelegt.");
    const r = await seedDemo(actor.id);
    revalidatePath("/", "layout");
    return { appointments: r.appointments };
  });
}

export async function purgeDemoAction(): Promise<ActionResult<{ removed: number }>> {
  return guard(async () => {
    const actor = await requireActor({ roles: ["arzt", "admin"], fresh: true });
    const removed = await repo.purgeDemo(actor.id);
    revalidatePath("/", "layout");
    return { removed };
  });
}
