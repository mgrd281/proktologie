import { expect, test, type Page } from "@playwright/test";

/**
 * Tempo der Website: Der Film holt beim Laden nur seine Leiter (jedes 8.
 * Bild), den Rest erst nach der ersten Bewegung oder im Leerlauf – ab der
 * Stelle, an der man gerade ist, und nie im Datensparmodus. Beim zweiten
 * Besuch kommen die Filmbilder aus dem Browser-Speicher (Header wie in
 * vercel.json, siehe e2e/site-server.mjs). Gewichtetes Scrollen nur auf der
 * Startseite, und eine Buchungskarte, die nach einem Ladefehler nicht
 * aufgibt. Gemessen an der ausgelieferten Website (out/).
 */
test.describe.configure({ mode: "serial" });

const SITE = "http://localhost:3000";

// Online-Buchung an: Die Karte lädt dann den Cockpit-Provider nach (letzter Test)
test.beforeAll(async ({ request }) => {
  const r = await request.post("/api/internal/e2e", {
    data: { secret: process.env.E2E_SECRET, action: "settings", settings: { bookingLive: true, bookingPaused: false, bannerText: null, chatEnabled: true } },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
});

/** Bildnummer aus „/sequence/desktop/frame_0123.webp?v=1“. */
const frameIndex = (url: string) => Number(/frame_(\d{4})\.webp/.exec(url)?.[1] ?? Number.NaN);
/** Wie FrameStore.isLadderIndex: jedes 8. Bild ab dem ersten, dazu das letzte. */
const isLadder = (i: number, count: number) => (i - 1) % 8 === 0 || i === count;

/** Abrufe von Filmbildern mitschreiben (auch aus dem Browser-Speicher). */
function recordFilm(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/sequence/")) urls.push(r.url());
  });
  return urls;
}

test("Film: ohne Eingabe nur die Leiter – nach einem Sprung lädt der Rest ab der neuen Stelle", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const film = recordFilm(page);
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2_000);
  const early = film.map(frameIndex);
  expect(early.length, "die Leiter lädt").toBeGreaterThan(0);
  expect(film.every((u) => u.includes("/sequence/desktop/")), "nur die Desktop-Fassung").toBe(true);
  expect(early.filter((i) => !isLadder(i, 500)), "in den ersten zwei Sekunden nur Leiterbilder").toEqual([]);

  // Sprung in die Mitte der Fahrt: Der übrige Vorrat beginnt dort – nicht bei Bild 2
  const before = film.length;
  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>(".cinema-track")!;
    window.scrollTo(0, track.offsetTop + track.offsetHeight * 0.5);
  });
  const rest = () => film.slice(before).map(frameIndex).filter((i) => !isLadder(i, 500));
  await expect.poll(() => rest().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(40);
  const playhead = await page.evaluate(() => Math.round((window as unknown as { __cinema: { f: number } }).__cinema.f));
  expect(playhead, "die Fahrt steht in der Mitte").toBeGreaterThan(150);
  const near = rest()
    .slice(0, 40)
    .filter((i) => Math.abs(i - playhead) <= 60).length;
  expect(near, `die ersten 40 Abrufe liegen um Bild ${playhead}`).toBeGreaterThanOrEqual(32);
});

test("Datensparmodus: Es bleibt bei der Leiter – auch nach Bewegung und Leerlauf", async ({ browser }) => {
  // Bildschirm wie am Handy – mit dem Desktop-Bildschirm der Vorgaben wählt der Browser das erste Bild sonst in Desktop-Größe
  const phone = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport: phone, screen: phone, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g", addEventListener() {}, removeEventListener() {} },
    });
  });
  const page = await context.newPage();
  const film = recordFilm(page);
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await page.mouse.wheel(0, 900);
  await page.keyboard.press("ArrowDown");
  // Länger als die Leerlauf-Frist (4 s nach dem Laden, dann höchstens 3 s)
  await page.waitForTimeout(9_000);
  const frames = [...new Set(film.map(frameIndex))];
  expect(frames.length, "die Leiter lädt").toBeGreaterThan(0);
  expect(film.every((u) => u.includes("/sequence/mobile/")), "nur die Handy-Fassung").toBe(true);
  expect(frames.filter((i) => !isLadder(i, 250)), "keine Bilder außerhalb der Leiter").toEqual([]);
  expect(frames.length).toBeLessThanOrEqual(33);
  await context.close();
});

test("Zweiter Besuch: Die Filmbilder kommen aus dem Browser-Speicher", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const first = await context.newPage();
  const loaded = new Set<number>();
  first.on("requestfinished", (r) => {
    if (r.url().includes("/sequence/")) loaded.add(frameIndex(r.url()));
  });
  await first.goto(`${SITE}/`, { waitUntil: "load" });
  // Die ganze Leiter ist da (64 Bilder), mehr wird ohne Eingabe nicht geholt
  await expect.poll(() => loaded.size, { timeout: 20_000 }).toBeGreaterThanOrEqual(64);
  await first.close();

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const fromCache = new Set<string>();
  const film: Array<{ url: string; cached: boolean }> = [];
  cdp.on("Network.requestServedFromCache", (e) => fromCache.add(e.requestId));
  cdp.on("Network.responseReceived", (e) => {
    if (!e.response.url.includes("/sequence/")) return;
    film.push({ url: e.response.url, cached: e.response.fromDiskCache || fromCache.has(e.requestId) });
  });
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await expect.poll(() => film.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(64);
  expect(film.filter((f) => !f.cached).map((f) => f.url), "keine Filmbilder übers Netz").toEqual([]);
  await context.close();
});

test("Unterseiten scrollen nativ – das gewichtete Scrollen gibt es nur auf der Startseite", async ({ page }) => {
  const hydrated = () =>
    page.waitForFunction(() => Object.keys(document.querySelector("header")!).some((k) => k.startsWith("__reactFiber")));
  await page.goto(`${SITE}/`, { waitUntil: "load" });
  await expect(page.locator("html")).toHaveClass(/(^|\s)lenis(\s|$)/);
  // Wechsel im Browser (ohne Neuladen): Lenis geht mit der Startseite
  await page.locator("footer").getByRole("link", { name: "Impressum" }).click();
  await expect(page).toHaveURL(/\/impressum\/$/);
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)lenis(\s|$)/);
  // Direkt geöffnet: nach dem Hydrieren ebenso ohne
  await page.goto(`${SITE}/datenschutz/`, { waitUntil: "load" });
  await hydrated();
  await page.waitForTimeout(500);
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)lenis(\s|$)/);
});

test("Buchungskarte: Lädt der Kalender-Teil nicht, versucht sie es erneut – danach ehrlich mit Telefon", async ({ browser }) => {
  /** Öffnet die Startseite und lässt die ersten `failures` Abrufe des Kalender-Teils scheitern. */
  const open = async (failures: number) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const state = { attempts: 0, failures };
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      // Nur der nachgeladene Teil des Cockpit-Providers kennt diese Adresse
      if (body.includes("/api/public/v1/appointment-types")) {
        state.attempts++;
        if (state.attempts <= state.failures) return route.abort("failed");
      }
      return route.fulfill({ response, body });
    });
    await page.goto(`${SITE}/#kontakt`, { waitUntil: "load" });
    return { context, page, state, card: page.locator("[data-booking-card]") };
  };
  const calendar = '[role="gridcell"][data-date]:not([aria-disabled="true"])';

  // Der erste Anlauf scheitert (der Browser versucht es selbst einmal nach) – die Karte holt ihn nach
  const once = await open(2);
  await once.card.getByRole("button", { name: /Kontrolltermin/ }).click();
  await expect(once.card.locator(calendar).first()).toBeVisible({ timeout: 20_000 });
  await expect(once.card.getByRole("alert")).toHaveCount(0);
  expect(once.state.attempts, "ein neuer Anlauf nach dem Fehler").toBeGreaterThanOrEqual(3);
  await expect(once.card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible();
  await once.context.close();

  // Bleibt das Netz weg: kein endloses „Kalender wird geladen …“, sondern Fehler, neuer Versuch und Telefon
  const down = await open(Number.POSITIVE_INFINITY);
  await down.card.getByRole("button", { name: /Kontrolltermin/ }).click();
  const alert = down.card.getByRole("alert");
  await expect(alert).toContainText("Die freien Termine konnten gerade nicht geladen werden.", { timeout: 20_000 });
  await expect(alert.locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(down.card.getByText("Kalender wird geladen …")).toHaveCount(0);
  down.state.failures = 0;
  await alert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(down.card.locator(calendar).first()).toBeVisible({ timeout: 20_000 });
  await expect(down.card.getByText("Online-Terminbuchung", { exact: true })).toBeVisible();
  await down.context.close();
});
