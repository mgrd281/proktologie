import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.DATA_KEY_V1 = randomBytes(32).toString("base64");
process.env.INDEX_KEY = randomBytes(32).toString("base64");
delete process.env.DATA_KEY_V2;

const aead = await import("./aead.ts");
const idx = await import("./blindIndex.ts");

beforeEach(() => {
  delete process.env.DATA_KEY_V2;
});

test("Roundtrip mit Umschlagformat v1:iv:ct:tag", () => {
  const env = aead.encrypt("Erika Musterfrau, +49 40 1234", "appt:42");
  assert.match(env, /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(aead.decrypt(env, "appt:42"), "Erika Musterfrau, +49 40 1234");
  assert.equal(aead.envelopeVersion(env), 1);
});

test("AAD bindet den Umschlag an seinen Datensatz", () => {
  const env = aead.encrypt("geheim", "appt:1");
  assert.throws(() => aead.decrypt(env, "appt:2"));
});

test("Manipulation am Ciphertext wird erkannt", () => {
  const env = aead.encrypt("geheim");
  const [v, iv, ct, tag] = env.split(":");
  const flipped = Buffer.from(ct, "base64url");
  flipped[0] ^= 0x01;
  assert.throws(() => aead.decrypt(`${v}:${iv}:${flipped.toString("base64url")}:${tag}`));
});

test("Zwei Verschlüsselungen desselben Klartexts sind verschieden (IV)", () => {
  assert.notEqual(aead.encrypt("x"), aead.encrypt("x"));
});

test("Rotation: neuer Schlüssel für neue Daten, alte bleiben lesbar", () => {
  const old = aead.encrypt("alt");
  process.env.DATA_KEY_V2 = randomBytes(32).toString("base64");
  assert.equal(aead.currentKeyVersion(), 2);
  const fresh = aead.encrypt("neu");
  assert.equal(aead.envelopeVersion(fresh), 2);
  assert.equal(aead.decrypt(old), "alt");
  assert.equal(aead.decrypt(fresh), "neu");
});

test("JSON-Komfort", () => {
  const env = aead.encryptJson({ a: 1, b: "ü" });
  assert.deepEqual(aead.decryptJson(env), { a: 1, b: "ü" });
});

test("Blind-Index: Normalisierung macht gleiche Eingaben gleich", () => {
  assert.equal(idx.emailHash(" Erika@Example.DE "), idx.emailHash("erika@example.de"));
  assert.equal(idx.phoneHash("040 490 80 21"), idx.phoneHash("+49 40 4908021"));
  assert.equal(idx.phoneHash("0049 40 4908021"), idx.phoneHash("+49404908021"));
  assert.equal(idx.nameKey("Müller", "Jörg"), idx.nameKey("Muller", "Jorg"));
  assert.equal(idx.normalizeName("Straßer"), "strasser");
  assert.notEqual(idx.emailHash("a@b.de"), idx.emailHash("b@b.de"));
});

test("Blind-Index ist nicht umkehrbar sichtbar (64 Hex-Zeichen, kein Klartext)", () => {
  const h = idx.emailHash("erika@example.de");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes("erika"));
});
