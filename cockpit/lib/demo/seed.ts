import { randomUUID } from "node:crypto";
import { audit } from "../audit.ts";
import { ConflictError, createAppointment, createException, listTypes } from "../booking/repo.ts";
import { currentKeyVersion, encryptJson } from "../crypto/aead.ts";
import { emailHash } from "../crypto/blindIndex.ts";
import { getDb } from "../db/client.ts";
import * as t from "../db/schema.ts";
import { makeRef } from "../ref.ts";
import { addDays, dateKey, zonedToUtc } from "../time.ts";

/**
 * Vorführdaten für die Abnahme. Ausschließlich offensichtlich fiktive
 * Musternamen; jede Zeile trägt is_demo = true, ist mit einem Klick löschbar,
 * und solange sie existiert, lässt sich der Live-Betrieb nicht einschalten.
 */
const NAMES: Array<[string, string]> = [
  ["Max", "Mustermann"],
  ["Erika", "Musterfrau"],
  ["Otto", "Normalverbraucher"],
  ["Lieschen", "Müller"],
  ["Hans", "Beispiel"],
  ["Anna", "Beispiel"],
  ["Peter", "Testmann"],
  ["Petra", "Testfrau"],
  ["Mustafa", "Muster"],
  ["Julia", "Probe"],
];

export async function seedDemo(actorId: string | null, now = new Date()) {
  const today = dateKey(now);
  const types = await listTypes();
  let appointments = 0;
  let idx = 0;
  const pick = () => NAMES[idx++ % NAMES.length]!;
  const times = ["07:00", "07:30", "08:00", "08:45", "09:15", "10:00", "10:30", "11:15", "14:00", "15:00", "16:15", "17:00"];

  for (let d = -14; d <= 21; d++) {
    const date = addDays(today, d);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const perDay = 5 + ((d + 14) % 4);
    for (let k = 0; k < perDay; k++) {
      const time = times[(k * 2 + d + 14) % times.length]!;
      const startsAt = zonedToUtc(date, time);
      const type = types[(k + d + 14) % types.length]!;
      const [firstName, lastName] = pick();
      const past = startsAt.getTime() < now.getTime();
      const status = past ? (k % 7 === 6 ? "no_show" : "completed") : k % 5 === 0 ? "booked" : k % 3 === 0 ? "reminded" : "confirmed";
      try {
        await createAppointment({
          typeId: type.id,
          startsAt,
          pii: {
            firstName,
            lastName,
            email: `${firstName}.${lastName}@example.invalid`.toLowerCase(),
            phone: `040 000 ${String(1000 + idx).slice(1)}`,
          },
          note: k === 2 ? "Demo-Notiz: nur Vorführung" : undefined,
          source: k % 3 === 0 ? "web" : k % 3 === 1 ? "cockpit" : "telefon",
          status,
          isDemo: true,
          actorId,
          ignoreOpeningHours: true,
        });
        appointments++;
      } catch (e) {
        if (e instanceof ConflictError) continue;
        throw e;
      }
    }
  }

  const blockDay = addDays(today, 3);
  await createException(
    { kind: "blocker", startsAt: zonedToUtc(blockDay, "14:00"), endsAt: zonedToUtc(blockDay, "16:00"), label: "Fortbildung (Demo)", isDemo: true },
    actorId,
  );
  const urlaub = addDays(today, 10);
  await createException(
    { kind: "urlaub", startsAt: zonedToUtc(urlaub, "00:00"), endsAt: zonedToUtc(addDays(urlaub, 1), "00:00"), allDay: true, label: "Brückentag (Demo)", isDemo: true },
    actorId,
  );

  const db = await getDb();
  const kinds = ["rueckruf", "folgerezept", "ueberweisung", "befundkopie"] as const;
  for (let i = 0; i < 6; i++) {
    const [firstName, lastName] = pick();
    const id = randomUUID();
    await db.insert(t.requests).values({
      id,
      ref: makeRef("AN"),
      kind: kinds[i % kinds.length]!,
      status: i < 3 ? "neu" : i < 5 ? "in_arbeit" : "erledigt",
      piiEnc: encryptJson({ firstName, lastName, phone: "040 000 0000" }, `req:${id}`),
      messageEnc: encryptJson({ text: "Demo-Anfrage – nur Vorführung." }, `reqmsg:${id}`),
      slaDueAt: new Date(now.getTime() + (i + 1) * 6 * 3600_000),
      isDemo: true,
      keyVersion: currentKeyVersion(),
    });
  }
  const [wf, wl] = pick();
  const wid = randomUUID();
  await db.insert(t.waitlist).values({
    id: wid,
    typeId: types[0]!.id,
    piiEnc: encryptJson({ firstName: wf, lastName: wl, email: "warteliste@example.invalid" }, `wl:${wid}`),
    emailHash: emailHash("warteliste@example.invalid"),
    isDemo: true,
    keyVersion: currentKeyVersion(),
  });

  await audit({ actorId, action: "demo.seed", entity: "demo", meta: { appointments } });
  return { appointments, exceptions: 2, requests: 6, waitlist: 1 };
}
