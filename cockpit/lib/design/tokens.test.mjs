/**
 * Token-Parität: Der Marken-@theme-Block des Cockpits muss dem der Website
 * (/app/globals.css) exakt entsprechen. Kein Monorepo, kein Cross-Import –
 * dieser Test ist die Klammer, die beide Projekte zusammenhält.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const site = readFileSync(join(here, "../../../app/globals.css"), "utf8");
const cockpit = readFileSync(join(here, "../../app/tokens.css"), "utf8");

/** Erster @theme { … }-Block → Map aus --token → Wert (Kommentare entfernt). */
function brandTokens(css) {
  const m = css.match(/@theme\s*\{([\s\S]*?)\}/);
  assert.ok(m, "kein @theme-Block gefunden");
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map();
  for (const line of body.split("\n")) {
    const d = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*;\s*$/);
    if (d) tokens.set(d[1], d[2]);
  }
  return tokens;
}

test("Cockpit-Markentokens sind byte-gleich mit der Website", () => {
  const a = brandTokens(site);
  const b = brandTokens(cockpit);
  assert.ok(a.size >= 10, `Website: nur ${a.size} Tokens gelesen`);
  assert.deepEqual([...b.entries()], [...a.entries()]);
});
