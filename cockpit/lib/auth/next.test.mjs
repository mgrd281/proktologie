import { test } from "node:test";
import assert from "node:assert/strict";

const { safeNext } = await import("./next.ts");

test("Rücksprung nach der Anmeldung: Pfade dieser App bleiben, samt Abfrage", () => {
  assert.equal(safeNext("/termine?d=2026-10-19&id=abc"), "/termine?d=2026-10-19&id=abc");
  assert.equal(safeNext("/"), "/");
});

test("Rücksprung nach der Anmeldung: fremde Adressen landen auf der Startseite", () => {
  for (const evil of ["//boese.example/login", "/\\boese.example", "https://boese.example", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeNext(evil), "/", String(evil));
  }
});
