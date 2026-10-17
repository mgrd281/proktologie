import { test } from "node:test";
import assert from "node:assert/strict";

const { addMonths } = await import("./time.ts");

test("addMonths: Kontrolle in drei Monaten, am Monatsende gekappt", () => {
  assert.equal(addMonths("2026-10-17", 3), "2027-01-17");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("2027-11-30", 3), "2028-02-29");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-12-15", 0), "2026-12-15");
});
