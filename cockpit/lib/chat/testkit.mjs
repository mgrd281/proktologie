/**
 * Gestellte Abhängigkeiten für die Chat-Tests – keine Datenbank, kein Netz,
 * kein Mailversand, kein Modell. Geteilt von orchestrator.test.mjs und
 * corpus.test.mjs, damit beide dasselbe messen.
 *
 * Feste Bühne: Montag, 13. Juli 2026, 08:00 Berliner Zeit. Dienstag ist der
 * 14. Juli; frei sind 07:00 bis 09:00 in halben Stunden.
 */

process.env.PGLITE_DIR = ":memory:";
process.env.DATA_KEY_V1 = process.env.DATA_KEY_V1 ?? Buffer.alloc(32, 5).toString("base64");
process.env.INDEX_KEY = process.env.INDEX_KEY ?? Buffer.alloc(32, 6).toString("base64");
delete process.env.DATABASE_URL;

export const NOW = new Date("2026-07-13T06:00:00Z");
export const DIENSTAG = "2026-07-14";
export const SESSION = "11111111-2222-4333-8444-555555555555";
export const SLOTS = ["07:00", "07:30", "08:00", "08:30", "09:00"];
export const HOURS_DE = "Mo, Mi, Fr 07:00–12:00 · Di, Do 07:00–12:00, 14:00–18:00 Uhr";
export const HOURS_EN = "Mon, Tue, Wed 07:00–12:00";

/** Dieselben sieben Terminarten wie in der Datenbank (0001_constraints_and_seed.sql). */
export const TYPES = [
  { id: "unklar", label: "Beschwerden / unklar", durationMin: 20 },
  { id: "erstuntersuchung", label: "Proktologische Erstuntersuchung", durationMin: 30 },
  { id: "kontrolle", label: "Kontrolltermin", durationMin: 15 },
  { id: "haemorrhoiden", label: "Hämorrhoiden", durationMin: 20 },
  { id: "analfissur", label: "Analfissur", durationMin: 20 },
  { id: "analfistel", label: "Analfistel", durationMin: 20 },
  { id: "nachsorge", label: "Nachsorge", durationMin: 15 },
];

export const KONTAKT = { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid", phone: "040 123456", consent: "true" };

export function makeDeps(over = {}) {
  const calls = { classify: [], phrase: [], book: [], callback: [], audit: [], availability: [], nextFree: [] };
  const deps = {
    now: () => NOW,
    types: async () => TYPES,
    availability: async (args, ctx) => {
      calls.availability.push(args);
      if (!args.datum) return { kind: "next_days", days: [{ date: DIENSTAG, slots: SLOTS.slice(0, 3) }] };
      if (args.uhrzeit) {
        return SLOTS.includes(args.uhrzeit)
          ? { kind: "time_free", date: args.datum, time: args.uhrzeit }
          : { kind: "time_taken", date: args.datum, time: args.uhrzeit, alternatives: SLOTS.slice(0, 3) };
      }
      void ctx;
      return { kind: "day_slots", date: args.datum, slots: SLOTS };
    },
    nextFree: async (args) => {
      calls.nextFree.push(args);
      return { kind: "next_days", days: [{ date: DIENSTAG, slots: SLOTS.slice(0, 3) }] };
    },
    info: async (lang) => ({ hoursText: lang === "de" ? HOURS_DE : HOURS_EN, banner: null }),
    classify: async (call) => {
      calls.classify.push(call);
      return null;
    },
    phrase: async (call) => {
      calls.phrase.push(call);
      return null;
    },
    book: async (input) => {
      calls.book.push(input);
      return { ok: true, ref: "PE-4F7K", typeLabel: "Kontrolltermin", mail: "sent" };
    },
    callback: async (input) => {
      calls.callback.push(input);
      return { ok: true, ref: "AN-7T2M" };
    },
    bookingsToday: async () => true,
    isBlocked: () => false,
    audit: (event, data) => calls.audit.push([event, data]),
    ...over,
  };
  return { deps, calls };
}

export const msg = (state, message, extra = {}) => ({ v: 1, sessionId: SESSION, state, message, ...extra });
export const click = (state, id) => ({ v: 1, sessionId: SESSION, state, action: { kind: "quick", id } });
export const form = (state, formId, values) => ({ v: 1, sessionId: SESSION, state, action: { kind: "form", formId, values } });

/** Ein gültiger Browserzustand mitten in der Buchung – so, wie ihn der Client zurückschickt. */
export function stateAt(stage, lang = "de", draft = {}) {
  const inConfirm = stage === "confirm";
  return {
    v: 1,
    lang,
    stage,
    intent: "booking",
    draft: {
      typeId: draft.typeId ?? "kontrolle",
      date: draft.date ?? DIENSTAG,
      time: inConfirm ? (draft.time ?? "09:00") : null,
      contact: inConfirm ? { firstName: "Erika", lastName: "Musterfrau", email: "erika@example.invalid", phone: "040 123456" } : null,
    },
    lastOffer: [],
    callbackKind: null,
    failures: 0,
    turns: 3,
  };
}
