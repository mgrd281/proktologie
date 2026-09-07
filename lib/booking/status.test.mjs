/**
 * Provider-Wahl der Terminkarte – ohne Browser.
 *
 * Ausführen:  node --experimental-strip-types --test lib/booking/status.test.mjs
 *
 * Geprüft wird die eine Entscheidung, die den Unterschied macht: Nur ein
 * lebendiges, nicht pausiertes Cockpit schaltet auf verbindliche Buchung.
 * Alles andere – nicht live, pausiert, keine oder kaputte Antwort, Zeitablauf –
 * lässt die Website beim Wunschtermin, still und ohne falsches Versprechen.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { chooseProvider, fetchCockpitStatus, STATUS_TIMEOUT_MS } = await import("./status.ts");

const PAUSED = "Pausiert – bitte anrufen.";
const status = (over = {}) => ({ bookingLive: true, bookingPaused: false, banner: null, ...over });

// ---- chooseProvider -------------------------------------------------------

test("unbekannter Zustand: Wunschtermin ohne Hinweis", () => {
  assert.deepEqual(chooseProvider(null, PAUSED), { kind: "request" });
});

test("nicht live – auch mit Banner: Wunschtermin ohne Hinweis", () => {
  assert.deepEqual(chooseProvider(status({ bookingLive: false, banner: "Bald geht es los." }), PAUSED), { kind: "request" });
});

test("nicht live und pausiert: Wunschtermin ohne Hinweis", () => {
  assert.deepEqual(chooseProvider(status({ bookingLive: false, bookingPaused: true }), PAUSED), { kind: "request" });
});

test("live, pausiert, kein Text: Wunschtermin mit Standard-Hinweis", () => {
  assert.deepEqual(chooseProvider(status({ bookingPaused: true }), PAUSED), { kind: "request", notice: PAUSED });
});

test("live, pausiert, eigener Text: Wunschtermin mit dem Text der Praxis", () => {
  const banner = "Vom 12. bis 23. August ist die Praxis geschlossen.";
  assert.deepEqual(chooseProvider(status({ bookingPaused: true, banner }), PAUSED), { kind: "request", notice: banner });
});

test("live: verbindlich, ohne Hinweis", () => {
  assert.deepEqual(chooseProvider(status(), PAUSED), { kind: "cockpit" });
});

test("live mit Banner: verbindlich – der Text gehört zur Pause, nicht zum Betrieb", () => {
  assert.deepEqual(chooseProvider(status({ banner: "Altlast" }), PAUSED), { kind: "cockpit" });
});

// ---- fetchCockpitStatus ---------------------------------------------------

const jsonResponse = (body, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => body });

test("leere Basis-URL: kein Aufruf, kein Zustand", async () => {
  let calls = 0;
  const r = await fetchCockpitStatus("", {
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(status());
    },
  });
  assert.equal(r, null);
  assert.equal(calls, 0);
});

test("gültige Antwort: Zustand übernommen, Aufruf ohne Cookies und ohne Cache", async () => {
  let seen = null;
  const r = await fetchCockpitStatus("https://cockpit.example//", {
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return jsonResponse({ bookingLive: true, bookingPaused: true, banner: "  Geschlossen.  ", pauseFrom: null });
    },
  });
  assert.deepEqual(r, { bookingLive: true, bookingPaused: true, banner: "Geschlossen." });
  assert.equal(seen.url, "https://cockpit.example/api/public/v1/status");
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.headers.Accept, "application/json");
  assert.ok(seen.init.signal instanceof AbortSignal, "Abbruchsignal für die Frist");
});

test("leeres Banner wird zu null", async () => {
  const r = await fetchCockpitStatus("https://cockpit.example", {
    fetchImpl: async () => jsonResponse({ bookingLive: false, bookingPaused: false, banner: "   " }),
  });
  assert.deepEqual(r, { bookingLive: false, bookingPaused: false, banner: null });
});

test("HTTP-Fehler: kein Zustand", async () => {
  const r = await fetchCockpitStatus("https://cockpit.example", { fetchImpl: async () => jsonResponse({ error: "down" }, false) });
  assert.equal(r, null);
});

test("Netzfehler: kein Zustand", async () => {
  const r = await fetchCockpitStatus("https://cockpit.example", {
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  assert.equal(r, null);
});

test("unbrauchbarer Körper: kein Zustand", async () => {
  for (const body of [{}, "text", null, { bookingLive: "ja", bookingPaused: false }, { bookingLive: true }]) {
    const r = await fetchCockpitStatus("https://cockpit.example", { fetchImpl: async () => jsonResponse(body) });
    assert.equal(r, null, JSON.stringify(body));
  }
});

test("Zeitablauf: kein Zustand – und kein Warten auf das Cockpit", async () => {
  const t0 = Date.now();
  const r = await fetchCockpitStatus("https://cockpit.example", {
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  assert.equal(r, null);
  assert.ok(Date.now() - t0 < 1000, "Frist greift, nicht die Geduld");
  assert.equal(STATUS_TIMEOUT_MS, 4000);
});
