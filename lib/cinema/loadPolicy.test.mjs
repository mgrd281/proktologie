/**
 * Ladepolitik des Films – ohne Browser.
 * Ausführen:  node --experimental-strip-types --test lib/cinema/loadPolicy.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { filmLoadPolicy } = await import("./loadPolicy.ts");

test("Normales Gerät: voller Vorrat, Handy mit vier, Desktop mit acht Abrufen zugleich", () => {
  assert.deepEqual(filmLoadPolicy({ mobile: true, effectiveType: "4g", deviceMemory: 8 }), { full: true, fetchConcurrency: 4 });
  assert.deepEqual(filmLoadPolicy({ mobile: false, effectiveType: "4g", deviceMemory: 8 }), { full: true, fetchConcurrency: 8 });
});

test("Was der Browser nicht meldet (Safari, Firefox), schränkt nichts ein", () => {
  assert.equal(filmLoadPolicy({ mobile: true }).full, true);
  assert.equal(filmLoadPolicy({ mobile: false, saveData: false }).full, true);
});

test("Datensparmodus, langsames Netz oder wenig Speicher: nur die Leiter", () => {
  assert.equal(filmLoadPolicy({ mobile: true, saveData: true, effectiveType: "4g" }).full, false);
  for (const effectiveType of ["slow-2g", "2g", "3g"]) {
    assert.equal(filmLoadPolicy({ mobile: true, effectiveType }).full, false, effectiveType);
  }
  assert.equal(filmLoadPolicy({ mobile: false, deviceMemory: 2 }).full, false, "2 GB");
  assert.equal(filmLoadPolicy({ mobile: false, deviceMemory: 0.5 }).full, false, "0,5 GB");
  assert.equal(filmLoadPolicy({ mobile: false, deviceMemory: 4 }).full, true, "4 GB");
});
