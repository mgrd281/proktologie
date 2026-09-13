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

// ------------------------------------------------- Sprachkanal am Automaten

const SECRET = process.env.E2E_SECRET;
const ipFor = (sessionId: string) => `198.51.100.${(Number(sessionId.slice(-6)) % 250) + 1}`;

/**
 * Was der Automat tut, wenn der Text aus dem Mikrofon kommt – über die echte
 * Route, ohne Mikrofon und ohne Schlüssel: `channel: "voice"` ist alles, was
 * der Browser dazu mitschickt.
 */
test("Im Sprachkanal bleibt ein Wortfetzen still, ein Terminwunsch bekommt die Fensterfrage – und Kontaktdaten werden erfragt, nicht abgefragt", async ({ request }) => {
  const enable = await request.post("/api/internal/e2e", {
    data: { secret: SECRET, action: "settings", settings: { bookingLive: true, bookingPaused: false, bannerText: null, chatEnabled: true } },
  });
  expect(enable.ok(), await enable.text()).toBeTruthy();

  const sessionId = "11111111-2222-4333-8444-000000000077";
  const say = async (state: unknown, message: string) => {
    const r = await request.post("/api/public/v1/chat", {
      data: { v: 1, sessionId, state, channel: "voice", message },
      headers: { Origin: SITE, "X-Forwarded-For": ipFor(sessionId) },
    });
    expect(r.status(), await r.text()).toBe(200);
    return (await r.json()) as { reply: string; state: unknown; form?: { id: string }; quick?: Array<{ id: string }>; flags: { silent?: true } };
  };

  const aside = await say(null, "Wochen.");
  expect(aside.reply).toBe("");
  expect(aside.flags.silent).toBe(true);

  const wish = await say(aside.state, "Ich hätte gern einen Kontrolltermin am Dienstag");
  expect(wish.flags.silent).toBeUndefined();
  expect(wish.reply).toMatch(/vormittags oder nachmittags\?$/);
  expect(wish.quick?.map((q) => q.id)).toEqual(["vormittags", "nachmittags", "egal"]);

  // Getippt bekommt derselbe Fetzen sofort eine Antwort.
  const typed = await request.post("/api/public/v1/chat", {
    data: { v: 1, sessionId, state: null, message: "Wochen." },
    headers: { Origin: SITE, "X-Forwarded-For": ipFor(sessionId) },
  });
  const typedBody = (await typed.json()) as { reply: string; flags: { silent?: true } };
  expect(typedBody.flags.silent).toBeUndefined();
  expect(typedBody.reply.length).toBeGreaterThan(0);
});
