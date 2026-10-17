import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Bedienung der Website über die Buchung hinaus: Wege über die Kamerafahrt,
 * Kopfzeile in der ruhigen Fassung, Handy-Menü und Chat als Dialog,
 * ehrliche Ladefehler im Kalender, deutsche 404 und eine Fehlergrenze, die
 * nur die Fahrt ersetzt. Gemessen wird an der ausgelieferten Website (out/).
 */
test.describe.configure({ mode: "serial" });

const SITE = "http://localhost:3000";

async function live(request: APIRequestContext) {
  const r = await request.post("/api/internal/e2e", {
    data: { secret: process.env.E2E_SECRET, action: "settings", settings: { bookingLive: true, bookingPaused: false, bannerText: null, chatEnabled: true } },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
}

/** Lage der Termin-Sektion unter dem Header und wohin der Fokus ging. */
async function kontaktState(page: Page) {
  return page.evaluate(() => ({
    top: Math.round(document.getElementById("kontakt")!.getBoundingClientRect().top),
    focus: document.activeElement?.id ?? "",
  }));
}

test.beforeAll(async ({ request }) => {
  await live(request);
});

test("„Einführung überspringen“ springt sofort zur Buchung – ohne Durchspulen, mit Fokus", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  const skip = page.getByRole("link", { name: /Einführung überspringen/ });
  await expect(skip).toBeVisible({ timeout: 30_000 });
  // Film-Bilder zwischen Anfang und Ende dürfen beim Sprung nicht durchlaufen werden
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __cinema?: { f: number } };
    w.__frames = [];
    const tick = () => {
      if (w.__cinema) w.__frames.push(Math.round(w.__cinema.f));
      if (w.__frames.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await skip.click();
  await expect.poll(() => kontaktState(page), { timeout: 3_000 }).toEqual({ top: 80, focus: "kontakt" });
  const between = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.filter((f) => f > 20 && f < 480).length);
  expect(between, "keine Zwischenbilder").toBe(0);
});

test("Film-Knöpfe landen wie alle Anker unter dem Header und nehmen den Fokus mit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  const cta = page.locator(".cinema-text").first().getByRole("link").first();
  await expect(cta).toBeVisible({ timeout: 30_000 });
  await cta.click();
  await expect.poll(() => kontaktState(page), { timeout: 3_000 }).toEqual({ top: 64, focus: "kontakt" });
});

test("Tastatur: zweiter Sprunglink führt direkt zur Terminbuchung", async ({ page }) => {
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Zur Terminbuchung");
  await page.keyboard.press("Enter");
  await expect.poll(() => kontaktState(page)).toMatchObject({ focus: "kontakt" });
});

test("Ruhige Fassung: Der Header wird deckend, sobald der dunkle Eröffnungsblock vorbei ist", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  const header = page.locator("#site-header");
  await expect(header).toHaveAttribute("data-solid", "false");
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
  await expect(header).toHaveAttribute("data-solid", "true");
  await context.close();
});

test("Unterseiten liefern den Header schon im HTML deckend aus", async ({ request }) => {
  const html = await (await request.get(`${SITE}/impressum/`)).text();
  expect(html).toMatch(/<header[^>]*data-solid="true"/);
});

test("Handy-Menü: Termin und Telefon stehen oben, das Menü scrollt", async ({ browser }) => {
  // Unter 1280 px gibt es das Menü; ein niedriges Fenster erzwingt Scrollen
  const context = await browser.newContext({ viewport: { width: 1100, height: 520 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  const menu = page.locator("#mobile-menu");
  const cta = menu.getByRole("link", { name: /Termin vereinbaren/ });
  await expect(cta).toBeInViewport();
  const box = await menu.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.7);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await context.close();
});

test("Handy-Chat: echter Dialog – Seite gesperrt, 16-px-Feld, Tippen daneben schließt", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" });
  const open = page.getByRole("navigation", { name: "Schnellzugriff" }).getByRole("button", { name: "Chat öffnen" });
  await open.waitFor({ timeout: 30_000 });
  const dialog = page.locator("#site-chat-window");
  await expect(async () => {
    if (!(await dialog.isVisible())) await open.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("log")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.getElementById("main")!.inert)).toBe(true);
  await expect(dialog.locator("#site-chat-input")).toHaveCSS("font-size", "16px");
  await page.mouse.click(195, 30);
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.getElementById("main")!.inert)).toBe(false);
  await context.close();
});

test("Kalender: Ladefehler steht als Fehler da – mit „Erneut versuchen“ und Telefon", async ({ page }) => {
  let fail = false;
  await page.route("**/api/public/v1/availability**", (route) => (fail ? route.abort("failed") : route.continue()));
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
  const card = page.locator("#kontakt");
  await expect(card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible({ timeout: 30_000 });
  fail = true;
  await card.getByRole("button", { name: /Kontrolltermin/ }).click();
  const alert = card.getByRole("alert");
  await expect(alert).toContainText("Die freien Termine konnten gerade nicht geladen werden.");
  await expect(alert.locator('a[href^="tel:"]')).toHaveCount(1);
  fail = false;
  await alert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(card.locator('[role="gridcell"][data-date]:not([aria-disabled="true"])').first()).toBeVisible();
});

test("Kalender: Blättern nur, wo es etwas zu buchen gibt", async ({ page }) => {
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
  const card = page.locator("#kontakt");
  await expect(card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Kontrolltermin/ }).click();
  await expect(card.locator('[role="grid"]:not([aria-busy])')).toBeVisible();
  await expect(card.getByRole("button", { name: "Vorheriger Monat" })).toHaveAttribute("aria-disabled", "true");
  const next = card.getByRole("button", { name: "Nächster Monat" });
  // Horizont 56 Tage: spätestens nach drei Monaten ist Schluss
  for (let i = 0; i < 3 && (await next.getAttribute("aria-disabled")) !== "true"; i++) {
    await next.click();
    await expect(card.locator('[role="grid"]:not([aria-busy])')).toBeVisible();
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
});

test("Unbekannte Adresse: deutsche 404 mit Weg zum Termin", async ({ page }) => {
  const res = await page.goto(`${SITE}/alte-seite/`);
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diese Seite gibt es nicht (mehr).");
  await expect(page.getByRole("link", { name: /Termin vereinbaren/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Zur Startseite", exact: true })).toBeVisible();
});

test("Bricht die Kamerafahrt, bleibt die Seite – nur der Film wird zur ruhigen Fassung", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await context.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error("Canvas defekt (Test)");
    };
  });
  const page = await context.newPage();
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await expect(page.locator("#hero h1").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cinema-track")).toHaveCount(0);
  await expect(page.locator("#kontakt").getByText("Online-Terminbuchung", { exact: true })).toBeVisible({ timeout: 30_000 });
  await context.close();
});
