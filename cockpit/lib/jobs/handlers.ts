import { offerNext } from "../booking/lifecycle.ts";
import { markReminded } from "../booking/repo.ts";
import { sendAppointmentMail, sendWaitlistJoinedMail } from "../messaging/send.ts";
import { registerHandler } from "./queue.ts";

/**
 * Job-Handler registrieren. Wird vom Tick importiert; die Warteschlange
 * selbst kennt keine Fachlogik.
 */
let registered = false;

export function registerAllHandlers() {
  if (registered) return;
  registered = true;

  registerHandler("mail.confirmation", async (p) => {
    const r = await sendAppointmentMail("confirmation", String(p.appointmentId));
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("mail.rescheduled", async (p) => {
    const r = await sendAppointmentMail("rescheduled", String(p.appointmentId));
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("mail.cancellation", async (p) => {
    const r = await sendAppointmentMail("cancellation", String(p.appointmentId), { by: (p.by as "patient" | "praxis" | "system") ?? "praxis" });
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("mail.reminder", async (p) => {
    const hours = Number(p.hoursBefore ?? 24);
    const r = await sendAppointmentMail("reminder", String(p.appointmentId), { hoursBefore: hours });
    if (r.sent) await markReminded(String(p.appointmentId));
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("mail.waitlist_offer", async (p) => {
    const r = await sendAppointmentMail("waitlist_offer", String(p.appointmentId));
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("mail.waitlist_joined", async (p) => {
    const r = await sendWaitlistJoinedMail(String(p.waitlistId));
    if (!r.sent && r.reason === "failed") throw new Error(r.error ?? "Versand fehlgeschlagen");
  });
  registerHandler("waitlist.offer_next", async (p, ctx) => {
    await offerNext(String(p.typeId), new Date(String(p.startsAt)), ctx.now);
  });
}
