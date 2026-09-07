/**
 * Der Aufruf der Chat-Route: richtige Adresse, keine Cookies, kein Cache,
 * und aus jeder Störung wird ein benannter Fehler statt einer Ausnahme.
 *
 * Ausführen:  node --experimental-strip-types --test lib/chat/api.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_TIMEOUT_MS, sendChat } from "./api.ts";

const OK = {
  reply: "Sprechzeiten: Mo, Mi, Fr 07:00–12:00.",
  lang: "de",
  state: { v: 1, stage: "idle" },
  quick: [{ id: "book", label: "Termin vereinbaren" }],
  flags: { llm: "none" },
};

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const BODY = { sessionId: "11111111-2222-4333-8444-555555555555", state: null, message: "Wann haben Sie geöffnet?" };

test("Gültige Antwort: Adresse, Methode, keine Cookies, kein Cache", async () => {
  let seen = null;
  const r = await sendChat("https://cockpit.example//", BODY, {
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return response(OK);
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.answer.reply, OK.reply);
  assert.equal(r.answer.quick.length, 1);
  assert.equal(seen.url, "https://cockpit.example/api/public/v1/chat");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.credentials, "omit");
  assert.ok(seen.init.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(seen.init.body), { v: 1, ...BODY });
});

test("Ohne Cockpit-Adresse wird nichts aufgerufen", async () => {
  let called = false;
  const r = await sendChat("", BODY, {
    fetchImpl: async () => {
      called = true;
      return response(OK);
    },
  });
  assert.equal(called, false, "kein Netzaufruf ins Leere");
  assert.deepEqual(r, { ok: false, error: "chat_disabled" });
});

test("429 und 503 werden unterschieden", async () => {
  const limit = await sendChat("https://cockpit.example", BODY, { fetchImpl: async () => response({}, false, 429) });
  assert.deepEqual(limit, { ok: false, error: "rate_limited" });
  const aus = await sendChat("https://cockpit.example", BODY, { fetchImpl: async () => response({}, false, 503) });
  assert.deepEqual(aus, { ok: false, error: "chat_disabled" });
  const kaputt = await sendChat("https://cockpit.example", BODY, { fetchImpl: async () => response({}, false, 400) });
  assert.deepEqual(kaputt, { ok: false, error: "invalid" });
});

test("Netzfehler und Zeitüberschreitung enden nicht in einer Ausnahme", async () => {
  const netz = await sendChat("https://cockpit.example", BODY, {
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.deepEqual(netz, { ok: false, error: "network" });

  const frist = await sendChat("https://cockpit.example", BODY, {
    timeoutMs: 10,
    fetchImpl: (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("abgebrochen")));
      }),
  });
  assert.deepEqual(frist, { ok: false, error: "network" });
});

test("Unsinnige Antworten werden verworfen", async () => {
  for (const body of [null, {}, { reply: "" }, { reply: "Hallo" }, { reply: "Hallo", lang: "fr" }]) {
    const r = await sendChat("https://cockpit.example", BODY, { fetchImpl: async () => response(body) });
    assert.deepEqual(r, { ok: false, error: "invalid" }, `sollte scheitern: ${JSON.stringify(body)}`);
  }
});

test("Flaggen und Formulare werden nur übernommen, wenn sie stimmen", async () => {
  const r = await sendChat("https://cockpit.example", BODY, {
    fetchImpl: async () =>
      response({
        reply: "Gebucht.",
        lang: "de",
        state: null,
        form: { id: "kontakt-fremd", title: "X", fields: [] },
        flags: { llm: "erfunden", emergency: "ja", booked: { ref: "PE-1", mail: "sent" } },
      }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.answer.form, undefined, "unbekanntes Formular wird verworfen");
  assert.equal(r.answer.flags.llm, "none", "unbekannter Wert fällt auf none zurück");
  assert.equal(r.answer.flags.emergency, undefined, "nur echtes true zählt");
  assert.deepEqual(r.answer.flags.booked, { ref: "PE-1", mail: "sent" });
});

test("Die Frist ist großzügig genug für langsame Modelle", () => {
  assert.ok(CHAT_TIMEOUT_MS >= 30_000);
});
