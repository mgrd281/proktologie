import { test } from "node:test";
import assert from "node:assert/strict";

const { planSearch } = await import("./search.ts");

test("Name in beiden Reihenfolgen – „Müller Anna“ wie „Anna Müller“, auch mit Komma", () => {
  const expected = [
    { last: "muller", first: "anna" },
    { last: "anna", first: "muller" },
  ];
  assert.deepEqual(planSearch("Müller Anna").names, expected);
  assert.deepEqual(planSearch("  müller,  ANNA ").names, expected);
});

test("Mehrteilige Namen: jede Trennstelle, ohne Doppel", () => {
  const names = planSearch("van der Berg Lea").names.map((n) => `${n.last}|${n.first}`);
  assert.deepEqual(names, [
    "van|der berg lea",
    "der berg lea|van",
    "van der|berg lea",
    "berg lea|van der",
    "van der berg|lea",
    "lea|van der berg",
  ]);
});

test("Telefon, E-Mail und Referenz werden erkannt – dann keine Namenssuche", () => {
  assert.equal(planSearch("040 490 80 21").phone, "040 490 80 21");
  assert.equal(planSearch("+49 (40) 4908-021").phone, "+49 (40) 4908-021");
  assert.equal(planSearch("anna.mueller@example.org").email, "anna.mueller@example.org");
  assert.equal(planSearch("pe-7k2m").ref, "PE-7K2M");
  assert.deepEqual(planSearch("pe-7k2m").names, []);
});

test("Zu kurz, eine Ziffernfolge unter sechs Stellen oder ein einzelnes Wort", () => {
  assert.deepEqual(planSearch("a"), { names: [] });
  assert.equal(planSearch("12345").phone, undefined);
  assert.deepEqual(planSearch("Müller"), { names: [], needsFullName: true });
});
