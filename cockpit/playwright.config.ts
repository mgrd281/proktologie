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
// Datenverzeichnis und Mail-Ausgang nur im Hauptprozess leeren – im Worker läuft der Server schon darauf
export const MAIL_OUTBOX_DIR = ".mail-outbox-e2e";
if (!process.env.E2E_DB_RESET) {
  rmSync(".pglite/e2e", { recursive: true, force: true });
  rmSync(MAIL_OUTBOX_DIR, { recursive: true, force: true });
  process.env.E2E_DB_RESET = "1";
}
// Beide Server teilen sich die Geheimnisse; die Website spricht mit dem Cockpit über CORS (localhost:3000 → 3100)
process.env.E2E_AUTH_SECRET ??= randomBytes(48).toString("base64");
process.env.E2E_DATA_KEY ??= randomBytes(32).toString("base64");
process.env.E2E_INDEX_KEY ??= randomBytes(32).toString("base64");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
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
  webServer: [
    {
      command: "npx next dev -p 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        PGLITE_DIR: ".pglite/e2e",
        COCKPIT_URL: "http://localhost:3100",
        BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
        DATA_KEY_V1: process.env.E2E_DATA_KEY,
        INDEX_KEY: process.env.E2E_INDEX_KEY,
        E2E_SECRET,
        DATABASE_URL: "",
        MAIL_OUTBOX_DIR,
        CRON_SECRET: "e2e-cron-secret",
        SITE_ORIGINS: "http://localhost:3000",
      },
    },
    {
      // Die statische Website im Dev-Modus, gebaut gegen das Cockpit (Provider „cockpit“)
      command: "npx next dev -p 3000",
      cwd: "..",
      url: "http://localhost:3000/",
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_BOOKING_PROVIDER: "cockpit",
        NEXT_PUBLIC_COCKPIT_API: "http://localhost:3100",
      },
    },
  ],
});
