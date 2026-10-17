import { test } from "node:test";
import assert from "node:assert/strict";

const { freshLoginHref, returnPath, safeNext } = await import("./next.ts");

test("Rücksprung nach der Anmeldung: Pfade dieser App bleiben, samt Abfrage", () => {
  assert.equal(safeNext("/termine?d=2026-10-19&id=abc"), "/termine?d=2026-10-19&id=abc");
  assert.equal(safeNext("/"), "/");
});

test("Rücksprung nach der Anmeldung: fremde Adressen landen auf der Startseite", () => {
  for (const evil of ["//boese.example/login", "/\\boese.example", "https://boese.example", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeNext(evil), "/", String(evil));
  }
});

test("Volle Adresse: Abfrage bleibt, Nexts interner Parameter fällt weg", () => {
  assert.equal(returnPath("/termine", "?v=woche&d=2026-10-19&_rsc=1x2y3"), "/termine?v=woche&d=2026-10-19");
  assert.equal(returnPath("/anfragen", ""), "/anfragen");
  assert.equal(returnPath("/", "?_rsc=abc"), "/");
});

test("Jetzt neu anmelden: mit Hinweis und Rücksprung an dieselbe Stelle", () => {
  assert.equal(freshLoginHref("/einstellungen/benutzer"), "/login?grund=frisch&weiter=%2Feinstellungen%2Fbenutzer");
  assert.equal(freshLoginHref("/termine?d=2026-10-19"), "/login?grund=frisch&weiter=%2Ftermine%3Fd%3D2026-10-19");
  assert.equal(freshLoginHref("/"), "/login?grund=frisch");
  assert.equal(freshLoginHref("//boese.example"), "/login?grund=frisch");
});
