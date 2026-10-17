/**
 * Rückrufbitte – ohne Browser.
 * Ausführen:  node --experimental-strip-types --test lib/booking/callback.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { callbackChannel, sendCallback, MIN_TOKEN_AGE_MS } = await import("./callback.ts");

const status = (over) => ({ bookingLive: true, bookingPaused: false, banner: null, chatEnabled: true, voice: false, hours: null, ...over });
const input = { firstName: " Erika ", lastName: "Probe", phone: "040 000 0000", preferredTime: "vormittags", consent: true, hp: "" };

/** Unechter Server: zählt Abrufe, merkt sich die Sendungen, antwortet nach Plan. */
function fakeServer(answers) {
  const calls = [];
  let tokens = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null });
    if (!init.method) return new Response(JSON.stringify({ formToken: `t${++tokens}` }), { status: 200 });
    const [status, body] = answers.shift();
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

test("Kanal: ins Cockpit, sobald es die Online-Buchung betreibt – auch pausiert", () => {
  assert.equal(callbackChannel(null), "mailto");
  assert.equal(callbackChannel(status({ bookingLive: false })), "mailto");
  assert.equal(callbackChannel(status()), "cockpit");
  assert.equal(callbackChannel(status({ bookingPaused: true })), "cockpit");
});

test("Absenden: nur Name, Telefon, Wunschzeit – und ein Token, das alt genug ist", async () => {
  const { calls, fetchImpl } = fakeServer([[201, { ref: "AN-7K2M" }]]);
  const waits = [];
  let clock = 10_000;
  const r = await sendCallback("https://cockpit.test", input, { value: "frisch", issuedAt: clock - 1000 }, {
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
  });
  assert.deepEqual(r, { ok: true, ref: "AN-7K2M" });
  assert.deepEqual(waits, [MIN_TOKEN_AGE_MS - 1000], "wartet den Rest der drei Sekunden");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://cockpit.test/api/public/v1/requests");
  assert.deepEqual(calls[0].body, {
    kind: "rueckruf",
    firstName: "Erika",
    lastName: "Probe",
    phone: "040 000 0000",
    preferredTime: "vormittags",
    consent: true,
    formToken: "frisch",
    hp: "",
  });
});

test("Verworfenes Token: einmal neu holen und erneut senden", async () => {
  const { calls, fetchImpl } = fakeServer([
    [400, { error: { code: "form_token", message: "Das Formular ist abgelaufen." } }],
    [201, { ref: "AN-2B9X" }],
  ]);
  let clock = 50_000;
  const r = await sendCallback("https://cockpit.test", input, { value: "alt", issuedAt: clock - 5000 }, {
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  assert.deepEqual(r, { ok: true, ref: "AN-2B9X" });
  assert.deepEqual(calls.map((c) => c.method), ["POST", "GET", "POST"]);
  assert.equal(calls[2].body.formToken, "t1");
});

test("Fehler kommen mit Code und Meldung des Cockpits zurück, Netzfehler ohne Meldung", async () => {
  const { fetchImpl } = fakeServer([[429, { error: { code: "rate_limited", message: "Zu viele Anfragen. Bitte rufen Sie uns an." } }]]);
  const opts = { fetchImpl, now: () => 99_000, sleep: async () => {} };
  const limited = await sendCallback("https://cockpit.test", input, { value: "x", issuedAt: 0 }, opts);
  assert.deepEqual(limited, { ok: false, code: "rate_limited", message: "Zu viele Anfragen. Bitte rufen Sie uns an." });
  const offline = await sendCallback("https://cockpit.test", input, null, {
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
    sleep: async () => {},
  });
  assert.deepEqual(offline, { ok: false, code: "network", message: null });
});
