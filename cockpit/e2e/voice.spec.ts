import { expect, test, type Page } from "@playwright/test";

const SITE = "http://localhost:3000";

async function openChat(page: Page) {
  await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" });
  const launcher = page.getByRole("button", { name: "Chat öffnen" });
  await launcher.waitFor({ state: "visible", timeout: 30_000 });
  const dialog = page.locator("#site-chat-window");
  await expect(async () => {
    if (!(await dialog.isVisible())) await launcher.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  return dialog;
}

test("Ohne Sprachanbieter meldet der Zustand kein Mikrofon", async ({ request }) => {
  const res = await request.get("/api/public/v1/status");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.voice, "ohne OPENAI_API_KEY ist Sprache aus").toBe(false);
});

test("Ohne Sprachanbieter gibt es keinen Mikrofonknopf im Fenster", async ({ page }) => {
  const dialog = await openChat(page);
  await expect(dialog.locator("#site-chat-input")).toBeVisible({ timeout: 20_000 });
  // Ein Knopf, hinter dem nichts passiert, wäre schlimmer als kein Knopf.
  await expect(dialog.getByRole("button", { name: "Sprechen" })).toHaveCount(0);
});

test("Die Ausweis-Route gibt ohne Schlüssel keinen Ausweis aus", async ({ request }) => {
  const res = await request.post("/api/public/v1/voice/token", {
    data: { v: 1, sessionId: "11111111-2222-4333-8444-555555555555", lang: "de" },
  });
  expect(res.status()).toBe(503);
  const body = await res.json();
  expect(body.error.code).toBe("voice_disabled");
  expect(JSON.stringify(body)).not.toContain("ek_");
});

test("Die Sprech-Route weist zu langen Text ab, statt alles vorzulesen", async ({ request }) => {
  const res = await request.post("/api/public/v1/voice/speak", {
    data: { v: 1, sessionId: "11111111-2222-4333-8444-555555555555", lang: "de", text: "a".repeat(5000) },
  });
  expect(res.status()).toBe(400);
});
