import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIL_OUTBOX_DIR } from "../playwright.config";

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

interface Mail {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string }>;
}

function outbox(): Mail[] {
  if (!existsSync(MAIL_OUTBOX_DIR)) return [];
  return readdirSync(MAIL_OUTBOX_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(MAIL_OUTBOX_DIR, f), "utf8")) as Mail);
}

async function tick(request: APIRequestContext) {
  const r = await request.post("/api/internal/e2e", { data: { secret: process.env.E2E_SECRET, action: "tick" } });
  expect(r.ok(), await r.text()).toBeTruthy();
}

/** „Mo., 19. Oktober“ – wie Knopf und Fahrt-Zeile den Tag nennen. */
const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));

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
  // Der Kalender öffnet im Monat des frühesten freien Tages – zurück bis zum heutigen
  const prev = card.getByRole("button", { name: "Vorheriger Monat" });
  for (let i = 0; i < 2 && (await prev.getAttribute("aria-disabled")) !== "true"; i++) {
    await prev.click();
    await expect(card.locator('[role="grid"]:not([aria-busy])')).toBeVisible();
  }
  await expect(prev).toHaveAttribute("aria-disabled", "true");
  const next = card.getByRole("button", { name: "Nächster Monat" });
  // Horizont 56 Tage: spätestens nach drei Monaten ist Schluss
  for (let i = 0; i < 3 && (await next.getAttribute("aria-disabled")) !== "true"; i++) {
    await next.click();
    await expect(card.locator('[role="grid"]:not([aria-busy])')).toBeVisible();
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
});

test("Frühester freier Tag: Zeile in der Fahrt, Kalender im richtigen Monat, ein Tipp zu den Zeiten", async ({ page, request }) => {
  const r = await request.get("/api/public/v1/availability?type=unklar");
  const first = ((await r.json()) as { days: Array<{ date: string; slots: string[] }> }).days.find((d) => d.slots.length > 0);
  expect(first, "ein freier Tag in den nächsten Wochen").toBeTruthy();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await expect(page.locator(".cinema-text").first().getByText(`Freie Termine ab ${shortDay(first!.date)}`)).toBeVisible({ timeout: 30_000 });

  const card = page.locator("[data-booking-card]");
  await page.getByRole("link", { name: /Einführung überspringen/ }).click();
  await card.getByRole("button", { name: /Beschwerden \/ unklar/ }).click();
  const earliest = card.getByRole("button", { name: `Frühester freier Tag: ${shortDay(first!.date)}` });
  await expect(earliest).toBeVisible({ timeout: 20_000 });
  const month = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", month: "long", year: "numeric" }).format(new Date(`${first!.date}T12:00:00Z`));
  await expect(card.locator('p[aria-live="polite"]')).toHaveText(month);
  await earliest.click();
  await expect(card.locator("button[data-slot]").first()).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(/Freie Zeiten am/)).toContainText(String(Number(first!.date.slice(8, 10))));
});

test("Zurück-Geste: ein Schritt zurück statt weg von der Seite – Eingaben bleiben", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
  const card = page.locator("[data-booking-card]");
  await expect(card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Kontrolltermin/ }).click();
  await card.getByRole("button", { name: /Frühester freier Tag/ }).click();
  await card.locator("button[data-slot]").first().click();
  await card.getByLabel(/Vorname/).fill("Greta");
  await page.goBack();
  await expect(card.getByRole("heading", { name: "Wählen Sie Ihre Wunschzeit" })).toBeVisible();
  await page.goBack();
  await expect(card.getByRole("heading", { name: "Wählen Sie Ihren Wunschtag" })).toBeVisible();
  expect(new URL(page.url()).pathname, "noch auf der Startseite").toBe("/");
  await card.getByRole("button", { name: /Frühester freier Tag/ }).click();
  await card.locator("button[data-slot]").first().click();
  await expect(card.getByLabel(/Vorname/)).toHaveValue("Greta");
  await context.close();
});

test("Gebucht: Tag, Zeit, Adresse – „In den Kalender“ mit der Kennung der Mail-Einladung", async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
  const page = await context.newPage();
  // Langsame Antwort: „Wird gebucht …“ steht da, ein zweiter Klick bucht nicht noch einmal
  let posts = 0;
  await page.route("**/api/public/v1/bookings", async (route) => {
    posts++;
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
  const card = page.locator("[data-booking-card]");
  await expect(card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Kontrolltermin/ }).click();
  await card.getByRole("button", { name: /Frühester freier Tag/ }).click();
  const slot = card.locator("button[data-slot]").last();
  const time = (await slot.getAttribute("data-slot"))!;
  await slot.click();
  const email = "kalender.test@example.invalid";
  await card.getByLabel(/Vorname/).fill("Karla");
  await card.getByLabel(/Nachname/).fill("Kalender");
  await card.getByLabel(/E-Mail/).fill(email);
  await card.getByLabel(/Telefon/).fill("040 000 0002");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: /Weiter zur Übersicht/ }).click();
  await card.getByRole("button", { name: /Termin verbindlich buchen/ }).click();
  const busy = card.getByRole("button", { name: "Wird gebucht …" });
  await expect(busy).toHaveAttribute("aria-disabled", "true");
  await busy.click({ force: true });
  await expect(card.getByText(/Termin verbindlich gebucht/)).toBeVisible({ timeout: 30_000 });
  expect(posts, "nur eine Buchung").toBe(1);
  await expect(card.getByText(`${time} Uhr`)).toBeVisible();
  await expect(card.getByText("Schäferkampsallee 56, 20357 Hamburg")).toBeVisible();
  await expect(card.getByRole("link", { name: "Anfahrt" })).toHaveAttribute("href", "#praxis");
  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "In den Kalender" }).click()]);
  const ics = readFileSync((await download.path())!, "utf8");
  expect(ics).toContain("SUMMARY:Termin · Proktologie Eimsbüttel");
  expect(ics).toMatch(new RegExp(`DTSTART;TZID=Europe/Berlin:\\d{8}T${time.replace(":", "")}00`));
  const uid = ics.match(/^UID:(.+)$/m)?.[1]?.trim();
  expect(uid).toBeTruthy();
  await context.close();

  await tick(request);
  const invite = outbox().filter((m) => m.to === email).at(-1)?.attachments?.find((a) => a.filename === "termin.ics");
  expect(invite, "Einladung in der Bestätigungs-Mail").toBeTruthy();
  expect(invite!.content).toContain(`UID:${uid}`);
});

test("Rückruf landet im Posteingang des Cockpits – mit Referenz und Hinweis an die Praxis", async ({ page, request }) => {
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
  const toggle = page.locator('button[aria-controls="callback-form"]');
  await expect(async () => {
    if (!(await page.locator("#callback-firstName").isVisible())) await toggle.click();
    await expect(page.locator("#callback-firstName")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // Einwilligung gehört zum Cockpit-Weg
  await expect(page.locator("#callback-consent")).toBeVisible();
  await page.locator("#callback-firstName").fill("Rita");
  await page.locator("#callback-lastName").fill("Rückruf");
  await page.locator("#callback-phone").fill("040 000 0003");
  await page.locator("#callback-time").selectOption("Vormittags");
  await page.locator("#callback-consent").check();
  await page.locator("#callback-form").getByRole("button", { name: /Rückruf anfordern/ }).click();
  const done = page.getByText(/Danke – wir rufen Sie zurück/);
  await expect(done).toBeVisible({ timeout: 20_000 });
  const ref = (await done.innerText()).match(/AN-[A-Z0-9]{4}/)?.[0];
  expect(ref).toBeTruthy();
  await tick(request);
  const notice = outbox().find((m) => m.subject.includes(ref!));
  expect(notice, "Hinweis-Mail an die Praxis").toBeTruthy();
  expect(notice!.text).toContain("Rita Rückruf");
  expect(notice!.text).toMatch(/vormittags/i);
});

test("FAQ ohne JavaScript: mehrere Antworten offen, darunter Telefon und Notfallnummern", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  const faq = page.locator("#faq");
  await faq.locator("summary").nth(1).click();
  await faq.locator("summary").nth(2).click();
  await expect(faq.locator("details[open]")).toHaveCount(3);
  await expect(faq.locator('a[href^="tel:+49"]')).toBeVisible();
  await expect(faq.locator('a[href="tel:116117"]')).toBeVisible();
  await expect(faq.locator('a[href="tel:112"]')).toBeVisible();
  await context.close();
});

test("Wischreihen am Handy: Zähler, sofort sichtbare Karten – am Desktop kein zusätzlicher Tab-Halt", async ({ browser }) => {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await mobile.newPage();
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  const row = page.locator("#leistungen ul").first();
  await row.scrollIntoViewIfNeeded();
  await expect(page.locator("#leistungen").getByText("1 / 8")).toBeVisible({ timeout: 20_000 });
  await expect(row).toHaveAttribute("tabindex", "0");
  await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(page.locator("#leistungen").getByText("8 / 8")).toBeVisible();
  expect(await row.locator(".reveal-init:not(.reveal-in)").count(), "keine leeren Karten beim Wischen").toBe(0);
  // Vier Beschwerden: untereinander, nicht zum Wischen
  const lefts = await page.locator("#beschwerden ul > li").evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
  await mobile.close();

  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const wide = await desktop.newPage();
  await wide.goto(`${SITE}/`, { waitUntil: "load" });
  await expect(wide.locator("#leistungen ul").first()).not.toHaveAttribute("tabindex", /.*/);
  await desktop.close();
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
