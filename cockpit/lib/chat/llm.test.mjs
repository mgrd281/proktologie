/**
 * Die Modell-Kette – geprüft ohne einen einzigen echten Netzaufruf.
 *
 * Der wichtigste Test ist der Kostenriegel: Bei OpenRouter darf niemals
 * eine Modell-Id ohne „:free“ aufgerufen werden, und ein Anbieter ohne
 * Schlüssel darf gar nicht erst ins Netz gehen.
 *
 * Ausführen:  node --test lib/chat/llm.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { complete, parseChain, isAllowed, DEFAULT_CHAIN, BASE_URLS } = await import("./llm.ts");

const okBody = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });
const call = { messages: [{ role: "user", content: "Wann haben Sie geöffnet?" }] };

/** Sammelt jeden Aufruf, damit der Test beweisen kann, was NICHT passiert ist. */
function spy(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls.length);
  };
  return { calls, fetchImpl };
}

// ---- Kette lesen ----

test("Standardkette: NVIDIA zuerst, OpenRouter nur mit :free", () => {
  const chain = parseChain(DEFAULT_CHAIN);
  assert.equal(chain.length, 4);
  assert.deepEqual(
    chain.map((c) => c.provider),
    ["nvidia", "nvidia", "openrouter", "openrouter"],
  );
  assert.ok(chain.filter((c) => c.provider === "openrouter").every((c) => c.model.endsWith(":free")));
});

test("Kostenpflichtige OpenRouter-Modelle werden aus der Kette entfernt", () => {
  const chain = parseChain("openrouter:anthropic/claude-opus-4,openrouter:minimax/minimax-m3:free,nvidia:x/y");
  assert.deepEqual(
    chain.map((c) => `${c.provider}:${c.model}`),
    ["openrouter:minimax/minimax-m3:free", "nvidia:x/y"],
  );
  assert.equal(isAllowed({ provider: "openrouter", model: "meta/llama-4" }), false);
  assert.equal(isAllowed({ provider: "openrouter", model: "meta/llama-4:free" }), true);
  assert.equal(isAllowed({ provider: "nvidia", model: "irgendwas" }), true);
});

test("Fehlformen und unbekannte Anbieter werden verworfen", () => {
  assert.deepEqual(parseChain("kaputt, :nur-doppelpunkt, openai:gpt-5, nvidia:"), []);
  assert.deepEqual(parseChain("").length, 0);
});

// ---- Kein Schlüssel ----

test("Ohne Schlüssel gibt es keinen Netzaufruf", async () => {
  const { calls, fetchImpl } = spy(() => okBody("nie"));
  const r = await complete(call, { env: {}, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_provider");
  assert.deepEqual(calls, []);
});

test("Nur OpenRouter-Schlüssel: NVIDIA wird still übersprungen", async () => {
  const { calls, fetchImpl } = spy(() => okBody("Antwort"));
  const r = await complete(call, { env: { OPENROUTER_API_KEY: "or-key" }, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.model.provider, "openrouter");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith(BASE_URLS.openrouter), calls[0].url);
});

test("Ein OpenRouter-Modell ohne :free wird auch mit Schlüssel nie aufgerufen", async () => {
  const { calls, fetchImpl } = spy(() => okBody("darf nicht passieren"));
  const r = await complete(call, {
    env: { OPENROUTER_API_KEY: "or-key", CHAT_MODEL_CHAIN: "openrouter:teuer/modell,openrouter:frei/modell:free" },
    fetchImpl,
  });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.match(JSON.parse(calls[0].init.body).model, /:free$/);
  assert.ok(!JSON.stringify(calls).includes("teuer/modell"));
});

// ---- Reihenfolge und Ausfälle ----

test("Reihenfolge: NVIDIA vor OpenRouter, Bearer-Kopf gesetzt", async () => {
  const { calls, fetchImpl } = spy(() => okBody("Guten Tag"));
  const r = await complete(call, { env: { NVIDIA_API_KEY: "nv", OPENROUTER_API_KEY: "or" }, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.model.provider, "nvidia");
  assert.equal(r.text, "Guten Tag");
  assert.equal(calls.length, 1, "Beim ersten Erfolg wird nicht weitergefragt");
  assert.equal(calls[0].init.headers.Authorization, "Bearer nv");
  assert.ok(calls[0].url.startsWith(BASE_URLS.nvidia));
});

test("Fehlerantwort, leerer Inhalt und Zeitüberschreitung führen zum nächsten Modell", async () => {
  const { calls, fetchImpl } = spy(async (_url, init, n) => {
    if (n === 1) return { ok: false, status: 500, json: async () => ({}) };
    if (n === 2) return { ok: true, status: 200, json: async () => ({ choices: [] }) };
    if (n === 3) {
      // Zeitüberschreitung: lehnt erst beim Abbruch ab
      return new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
    }
    return okBody("endlich");
  });
  const r = await complete(call, {
    env: { NVIDIA_API_KEY: "nv", OPENROUTER_API_KEY: "or", CHAT_LLM_TIMEOUT_MS: "20" },
    fetchImpl,
  });
  assert.equal(r.ok, true);
  assert.equal(r.text, "endlich");
  assert.equal(calls.length, 4);
});

test("Fällt alles aus, sagt die Kette das – mit Liste der Versuche", async () => {
  const { fetchImpl } = spy(() => ({ ok: false, status: 429, json: async () => ({}) }));
  const r = await complete(call, { env: { NVIDIA_API_KEY: "nv", OPENROUTER_API_KEY: "or" }, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "all_failed");
  assert.equal(r.tried.length, 4);
});

test("Zeitbudget: nach Ablauf wird kein weiteres Modell mehr versucht", async () => {
  let clock = 0;
  const { calls, fetchImpl } = spy(() => {
    clock += 10_000; // jeder Versuch kostet 10 s
    return { ok: false, status: 500, json: async () => ({}) };
  });
  const r = await complete(call, {
    env: { NVIDIA_API_KEY: "nv", OPENROUTER_API_KEY: "or", CHAT_LLM_BUDGET_MS: "15000" },
    fetchImpl,
    now: () => clock,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "budget");
  assert.equal(calls.length, 2, "nach zwei Versuchen ist das Budget aufgebraucht");
});

// ---- Aufrufform ----

test("Basis-URL lässt sich für Tests umbiegen; JSON-Modus wird mitgeschickt", async () => {
  const { calls, fetchImpl } = spy(() => okBody('{"intent":"booking"}'));
  await complete({ ...call, json: true, temperature: 0, maxTokens: 120 }, {
    env: { NVIDIA_API_KEY: "nv", CHAT_NVIDIA_BASE_URL: "http://localhost:3200/v1", CHAT_MODEL_CHAIN: "nvidia:fake/one" },
    fetchImpl,
  });
  assert.equal(calls[0].url, "http://localhost:3200/v1/chat/completions");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "fake/one");
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 120);
  assert.deepEqual(body.response_format, { type: "json_object" });
});

test("Protokoll nennt Anbieter und Dauer, aber nie den Inhalt", async () => {
  const lines = [];
  const original = console.info;
  console.info = (...args) => lines.push(args.join(" "));
  try {
    const { fetchImpl } = spy(() => okBody("Geheimer Patiententext"));
    await complete(
      { messages: [{ role: "user", content: "Mein Name ist Erika Musterfrau" }] },
      { env: { NVIDIA_API_KEY: "nv", CHAT_MODEL_CHAIN: "nvidia:fake/one" }, fetchImpl },
    );
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /provider=nvidia model=fake\/one status=200 ms=\d+/);
  assert.ok(!lines[0].includes("Erika"), lines[0]);
  assert.ok(!lines[0].includes("Geheimer"), lines[0]);
});
