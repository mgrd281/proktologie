/**
 * Der Verlauf im Browser: Was gespeichert wird, was verworfen wird und
 * was passiert, wenn der Speicher gesperrt ist (privater Modus).
 *
 * Ausführen:  node --experimental-strip-types --test lib/chat/session.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MESSAGES, STORAGE_KEY, append, browserStore, clear, isEmail, load, newSession, parseSession, randomId, save } from "./session.ts";

/** Ein Speicher wie sessionStorage – im Test aus einer Map. */
function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

test("Eine neue Sitzung hat eine zufällige Kennung und keinen Verlauf", () => {
  const s = newSession("de");
  assert.equal(s.v, 1);
  assert.match(s.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(s.messages, []);
  assert.equal(s.state, null);
  assert.notEqual(newSession("de").sessionId, newSession("de").sessionId);
});

test("Speichern und Laden erhalten den Verlauf", () => {
  const store = fakeStore();
  let s = newSession("de");
  s = append(s, "user", "Wann haben Sie geöffnet?", 1000);
  s = append(s, "assistant", "Sprechzeiten: …", 1001);
  save(store, s);
  const back = load(store);
  assert.equal(back.messages.length, 2);
  assert.equal(back.messages[0].role, "user");
  assert.equal(back.sessionId, s.sessionId);
  assert.ok(store.map.has(STORAGE_KEY));
});

test("Der Verlauf ist gedeckelt – ältere Nachrichten fallen heraus", () => {
  let s = newSession("de");
  for (let i = 0; i < MAX_MESSAGES + 10; i++) s = append(s, i % 2 ? "assistant" : "user", `Nachricht ${i}`, i);
  assert.equal(s.messages.length, MAX_MESSAGES);
  assert.equal(s.messages.at(-1).text, `Nachricht ${MAX_MESSAGES + 9}`);
});

test("Kaputte oder fremde Daten werden verworfen, nicht geladen", () => {
  assert.equal(parseSession(null), null);
  assert.equal(parseSession("kein json"), null);
  assert.equal(parseSession(JSON.stringify({ v: 2, sessionId: randomId(), lang: "de" })), null, "andere Version");
  assert.equal(parseSession(JSON.stringify({ v: 1, sessionId: "nicht-uuid", lang: "de" })), null);
  assert.equal(parseSession(JSON.stringify({ v: 1, sessionId: randomId(), lang: "fr" })), null);
  const gemischt = parseSession(
    JSON.stringify({ v: 1, sessionId: randomId(), lang: "de", messages: [{ role: "user", text: "ok", at: 1 }, { role: "system", text: "böse", at: 2 }, "kaputt"] }),
  );
  assert.equal(gemischt.messages.length, 1, "nur gültige Nachrichten bleiben");
});

test("Ein gesperrter Speicher bricht nichts ab", () => {
  const gesperrt = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(load(gesperrt), null);
  assert.doesNotThrow(() => save(gesperrt, newSession("de")));
  assert.doesNotThrow(() => clear(gesperrt));
  assert.equal(load(null), null);
  assert.doesNotThrow(() => save(null, newSession("de")));
});

test("Ohne sessionStorage gibt es keinen Speicher – und keinen Fehler", () => {
  assert.equal(browserStore(), null, "Node hat kein sessionStorage");
});

test("Löschen entfernt den Verlauf", () => {
  const store = fakeStore();
  save(store, append(newSession("de"), "user", "Hallo", 1));
  clear(store);
  assert.equal(load(store), null);
});

test("E-Mail-Prüfung wie im Buchungsformular", () => {
  assert.equal(isEmail("erika@example.de"), true);
  assert.equal(isEmail("  erika@example.de  "), true);
  assert.equal(isEmail("erika@example"), false);
  assert.equal(isEmail("erika"), false);
  assert.equal(isEmail(""), false);
});
