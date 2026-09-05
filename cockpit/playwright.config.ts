import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";

/**
 * Browser-Suite gegen einen frischen PGlite-Stand: Der Dev-Server bekommt
 * eigene Schlüssel und ein leeres Datenverzeichnis, der Test-Einstieg
 * (/api/internal/e2e) ist nur mit E2E_SECRET erreichbar.
 */
// Die Konfiguration wird je Worker erneut geladen – das Geheimnis darf
// deshalb nur einmal entstehen und wandert über die Umgebung weiter.
process.env.E2E_SECRET ??= randomBytes(16).toString("hex");
const E2E_SECRET = process.env.E2E_SECRET;
// Datenverzeichnis nur im Hauptprozess leeren – im Worker läuft der Server schon darauf
if (!process.env.E2E_DB_RESET) {
  rmSync(".pglite/e2e", { recursive: true, force: true });
  process.env.E2E_DB_RESET = "1";
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PGLITE_DIR: ".pglite/e2e",
      COCKPIT_URL: "http://localhost:3100",
      BETTER_AUTH_SECRET: randomBytes(48).toString("base64"),
      DATA_KEY_V1: randomBytes(32).toString("base64"),
      INDEX_KEY: randomBytes(32).toString("base64"),
      E2E_SECRET,
      DATABASE_URL: "",
    },
  },
});
