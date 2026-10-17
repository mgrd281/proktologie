/**
 * Ladereihenfolge des Film-Speichers (components/hero/sequence/frameStore.ts)
 * – mit gestelltem fetch/createImageBitmap, ohne Browser.
 * Ausführen:  node --experimental-strip-types --test lib/cinema/frameStore.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { FrameStore, DEFAULT_STORE_CONFIG } = await import("../../components/hero/sequence/frameStore.ts");

function setup(count) {
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(Number(/(\d+)$/.exec(url)[1]));
    return new Response(new Blob([new Uint8Array(4)]));
  };
  globalThis.createImageBitmap = async () => ({ close() {} });
  const store = new FrameStore({ ...DEFAULT_STORE_CONFIG, count, path: (i) => `frame/${i}` });
  return { store, fetched };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("Beim Start nur die Leiter: jedes 8. Bild und das letzte", async () => {
  const { store, fetched } = setup(40);
  store.start();
  await settle();
  assert.deepEqual([...fetched].sort((a, b) => a - b), [1, 9, 17, 25, 33, 40]);
  store.destroy();
});

test("Freigegeben: der Rest ab der Abspielposition, voraus zuerst", async () => {
  const { store, fetched } = setup(80);
  store.start();
  await settle();
  fetched.length = 0;
  store.setPlayhead(50, 1);
  store.unlockFull();
  // Die ersten acht Abrufe starten sofort – rund um Bild 50 (49 und 57 sind Leiter)
  assert.deepEqual(fetched.slice(0, 8), [50, 51, 52, 48, 53, 54, 47, 55]);
  await settle();
  assert.equal(new Set(fetched).size, 80 - 11, "am Ende alle übrigen Bilder");
  store.destroy();
});

test("Außer Sicht startet nichts – erst resume() holt den Rest", async () => {
  const { store, fetched } = setup(40);
  store.start();
  await settle();
  store.pause();
  fetched.length = 0;
  // Früher lief hier die Start-Schleife endlos (Worker kehrten sofort zurück)
  store.unlockFull();
  await settle();
  assert.equal(fetched.length, 0);
  store.resume();
  await settle();
  assert.equal(fetched.length, 40 - 6);
  store.destroy();
});
