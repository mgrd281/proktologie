import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FORM_TOKEN_SECRET = "test-secret-form-token";
const ft = await import("./formToken.ts");

test("Token: gültig zwischen 3 s und 30 min", () => {
  const t0 = 1_800_000_000_000;
  const tok = ft.issueFormToken(t0);
  assert.equal(ft.verifyFormToken(tok, t0 + 1000).ok, false);
  assert.equal(ft.verifyFormToken(tok, t0 + 1000).reason, "too_young");
  assert.equal(ft.verifyFormToken(tok, t0 + 5000).ok, true);
  assert.equal(ft.verifyFormToken(tok, t0 + 31 * 60_000).reason, "expired");
});

test("Token: Manipulation und Fremdformat werden abgewiesen", () => {
  const t0 = 1_800_000_000_000;
  const tok = ft.issueFormToken(t0);
  const [ts, nonce, sig] = tok.split(".");
  assert.equal(ft.verifyFormToken(`${Number(ts) - 60_000}.${nonce}.${sig}`, t0 + 5000).reason, "signature");
  assert.equal(ft.verifyFormToken(`${ts}.${nonce}.${sig}x`, t0 + 5000).reason, "signature");
  assert.equal(ft.verifyFormToken("abc", t0).reason, "malformed");
  assert.equal(ft.verifyFormToken(null, t0).reason, "malformed");
  assert.equal(ft.verifyFormToken("", t0).reason, "malformed");
});

test("Token: zwei Ausgaben sind verschieden (Nonce)", () => {
  const t0 = 1_800_000_000_000;
  assert.notEqual(ft.issueFormToken(t0), ft.issueFormToken(t0));
});
