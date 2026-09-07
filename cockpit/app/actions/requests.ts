"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActorError, requireActor } from "@/lib/auth/actor";
import { setRequestStatus, type RequestView } from "@/lib/booking/requests";
import type { ActionResult } from "./appointments";

/**
 * Anfragen im Posteingang bearbeiten. Bewusst ohne Rollenfilter: Der
 * Posteingang ist Empfangsarbeit – wer im Cockpit angemeldet ist, darf den
 * Stand einer Rückrufbitte ändern. Jede Änderung steht im Audit-Log.
 */
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

const statusSchema = z.object({
  id: z.string().uuid("Unbekannte Anfrage"),
  status: z.enum(["neu", "in_arbeit", "wartet", "erledigt"]),
});

export async function setRequestStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<RequestView>> {
  return guard(async () => {
    const actor = await requireActor();
    const v = statusSchema.parse(input);
    const view = await setRequestStatus(v.id, v.status, actor.id);
    revalidatePath("/anfragen");
    revalidatePath("/");
    return view;
  });
}
