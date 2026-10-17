import { test } from "node:test";
import assert from "node:assert/strict";

const { firstNameOf, initialsOf } = await import("./names.ts");

test("Titel fallen weg – in der Begrüßung und im Kürzel", () => {
  assert.equal(firstNameOf("Dr. med. Kai Kunstreich"), "Kai");
  assert.equal(initialsOf("Dr. med. Kai Kunstreich"), "KK");
  assert.equal(initialsOf("Prof. Dr. Anna Maria Schulz"), "AS");
  assert.equal(initialsOf("Dr.-Ing. Lea Berg"), "LB");
});

test("Ohne Titel und einteilige Namen", () => {
  assert.equal(firstNameOf("Erika Musterfrau"), "Erika");
  assert.equal(initialsOf("Erika Musterfrau"), "EM");
  assert.equal(initialsOf("Empfang"), "E");
  assert.equal(firstNameOf("  "), "");
});
