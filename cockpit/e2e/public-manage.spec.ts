import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIL_OUTBOX_DIR } from "../playwright.config";

/**
 * Patientenseite (/t/#…) über den Grundweg hinaus: Status in Patientenworten,
 * Verschieben über die freien Tage der nächsten vier Wochen, Telefon statt
 * Sackgasse, wenn die Online-Buchung ruht, Kalenderdatei mit derselben UID
 * wie die Mail, Absagen mit „Lieber verschieben?“, Wartelisten-Angebot mit
 * „Angebot ablehnen“, Verbindungsfehler getrennt vom ungültigen Link und die
 * Warteliste nur mit Rückfrage verlassen.
 */
const SECRET = process.env.E2E_SECRET;

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
const manageToken = (m: Mail) => m.text.match(/\/t\/#([A-Za-z0-9_-]{30,})/)?.[1] ?? null;

// Jede Prüfung kommt von einer eigenen Adresse – die öffentliche API begrenzt Buchungen je Absender
let ipSeq = 0;
const nextIp = () => `10.42.0.${++ipSeq}`;

async function e2e(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.post("/api/internal/e2e", { data: { secret: SECRET, ...body } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

async function live(request: APIRequestContext, paused = false) {
  await e2e(request, { action: "settings", settings: { bookingLive: true, bookingPaused: paused, bannerText: null } });
}

/** Bucht über die öffentliche API den frühesten freien Platz und liefert den Verwaltungslink aus der Bestätigung. */
async function book(request: APIRequestContext, email: string, typeId = "kontrolle") {
  const headers = { "x-forwarded-for": nextIp() };
  const av = await request.get(`/api/public/v1/availability?type=${typeId}`, { headers });
  expect(av.ok(), await av.text()).toBeTruthy();
  const j = (await av.json()) as { days: Array<{ date: string; slots: string[] }>; formToken: string };
  const day = j.days.find((d) => d.slots.length > 0)!;
  await new Promise((r) => setTimeout(r, 3300)); // Formular-Token braucht ein paar Sekunden Alter
  const b = await request.post("/api/public/v1/bookings", {
    headers,
    data: { typeId, date: day.date, time: day.slots[0], firstName: "Paula", lastName: "Probe", email, phone: "040 000 0002", consent: true, formToken: j.formToken },
  });
  expect(b.status(), await b.text()).toBe(201);
  await e2e(request, { action: "tick" });
  const mail = outbox().filter((m) => m.to === email).at(-1);
  expect(mail, `Bestätigung an ${email}`).toBeTruthy();
  return { token: manageToken(mail!)!, mail: mail!, date: day.date };
}

async function joinWaitlist(request: APIRequestContext, email: string, typeId: string) {
  const headers = { "x-forwarded-for": nextIp() };
  const av = await request.get(`/api/public/v1/availability?type=${typeId}`, { headers });
  const { formToken } = (await av.json()) as { formToken: string };
  await new Promise((r) => setTimeout(r, 3300));
  const r = await request.post("/api/public/v1/waitlist", { headers, data: { typeId, firstName: "Wanda", lastName: "Warte", email, consent: true, formToken } });
  expect(r.status(), await r.text()).toBe(201);
  await e2e(request, { action: "tick" });
}

/** Handy-Kontext mit eigener Absenderadresse. */
async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": nextIp() } });
  return { context, page: await context.newPage() };
}

const statusRow = (page: Page) => page.locator("dl > div").filter({ has: page.locator("dt", { hasText: "Status" }) }).locator("dd");

async function axeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`))).toEqual([]);
}

test.beforeAll(async ({ request }) => {
  // Wie die Praxis: Demo-Daten weg, Online-Buchung live (läuft die Datei allein, ist sonst nichts live)
  await e2e(request, { action: "golive" });
  await live(request);
});

test("Patientenworte, Kalenderdatei mit derselben UID wie die Mail, Anfahrt", async ({ request, browser }) => {
  const { token, mail } = await book(request, "paula.kalender@example.invalid");
  const { context, page } = await phone(browser);
  await page.goto(`/t/#${token}`);
  await expect(page.getByRole("heading", { name: "Ihr Termin" })).toBeVisible();
  await expect(statusRow(page)).toHaveText("Gebucht");
  await axeClean(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "In den Kalender" }).click()]);
  expect(download.suggestedFilename()).toBe("termin.ics");
  const ics = readFileSync((await download.path())!, "utf8");
  expect(ics).toContain("METHOD:PUBLISH");
  expect(ics).toContain("TZID=Europe/Berlin");
  expect(ics, "Datei zum Selbst-Eintragen ohne Teilnehmer").not.toContain("ATTENDEE");
  const uid = (s: string) => s.match(/^UID:(.+)$/m)?.[1]?.trim();
  const mailIcs = mail.attachments?.find((a) => a.filename === "termin.ics")?.content ?? "";
  expect(uid(ics)).toBeTruthy();
  expect(uid(ics), "ein Eintrag im Kalender, nicht zwei").toBe(uid(mailIcs));
  await expect(page.locator("#manage-notice")).toBeFocused();

  const directions = page.getByRole("link", { name: /Anfahrt/ });
  await expect(directions).toHaveAttribute("href", /\/#kontakt$/);
  await expect(directions).toHaveAttribute("target", "_blank");

  await page.getByRole("button", { name: "Termin bestätigen" }).click();
  await expect(page.getByRole("status")).toContainText("bestätigt");
  await expect(statusRow(page)).toHaveText("Bestätigt");
  await context.close();
});

test("Verschieben: freie Tage der nächsten vier Wochen, Knopf nennt Tag und Uhrzeit, vergebene Zeit lädt neu", async ({ request, browser }) => {
  const { token } = await book(request, "paula.verschieben@example.invalid");
  const { context, page } = await phone(browser);
  await page.goto(`/t/#${token}`);
  const row = (k: string) => page.locator("dl > div").filter({ has: page.locator("dt", { hasText: k }) }).locator("dd");
  const before = (await row("Datum").textContent()) ?? "";
  await page.getByRole("button", { name: "Verschieben" }).click();
  const panel = page.getByRole("group", { name: "Neuen Zeitpunkt wählen" });
  await expect(panel).toBeFocused();
  const days = panel.getByRole("group", { name: "Freie Tage" }).getByRole("button");
  await expect(days.first()).toBeVisible();
  expect(await days.count(), "mehrere freie Tage auf einen Blick").toBeGreaterThan(5);
  await expect(days.first()).toHaveAttribute("aria-pressed", "true");
  await axeClean(page);

  // Zurück bringt den Fokus auf „Verschieben“
  await panel.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("button", { name: "Verschieben" })).toBeFocused();

  await page.getByRole("button", { name: "Verschieben" }).click();
  await days.nth(1).click();
  await expect(days.nth(1)).toHaveAttribute("aria-pressed", "true");
  // Der Hauptknopf nennt erst die fehlende Uhrzeit, dann Tag und Uhrzeit
  const submit = panel.getByRole("button", { name: /verschieben$|^Bitte Uhrzeit wählen$/ });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText("Bitte Uhrzeit wählen");
  await panel.getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  await expect(submit).toHaveText(/^Auf [A-Z][a-z]\., \d\d\.\d\d\., \d\d:\d\d Uhr verschieben$/);

  // Erst ist die Zeit „gerade vergeben“: Fehler rot und angesagt, die freien Tage laden neu
  let fail = true;
  await page.route("**/api/public/v1/manage", async (route) => {
    const body = route.request().postDataJSON() as { action?: string };
    if (fail && body.action === "reschedule") {
      fail = false;
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "slot_taken", message: "Diese Zeit wurde gerade vergeben." } }) });
    }
    return route.continue();
  });
  await submit.click();
  // (Next.js hat einen eigenen, leeren role="alert" für Seitenwechsel – deshalb gezielt)
  const notice = page.locator("#manage-notice");
  await expect(notice).toHaveAttribute("role", "alert");
  await expect(notice).toHaveText("Diese Zeit wurde gerade vergeben.");
  await expect(notice).toBeFocused();
  await expect(submit).toHaveText("Bitte Uhrzeit wählen");

  await panel.getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  const time = (await submit.textContent())?.match(/(\d\d:\d\d) Uhr/)?.[1];
  await submit.click();
  await expect(page.getByRole("status")).toContainText("verschoben");
  await expect(row("Uhrzeit")).toHaveText(new RegExp(`^${time} – `));
  await expect(row("Datum"), "anderer Tag als vorher").not.toHaveText(before);
  await context.close();
});

test("Absagen: „Lieber verschieben?“, danach Patientenworte statt Knöpfe", async ({ request, browser }) => {
  const { token } = await book(request, "paula.absage@example.invalid");
  const { context, page } = await phone(browser);
  await page.goto(`/t/#${token}`);
  await page.getByRole("button", { name: "Absagen" }).click();
  const box = page.getByRole("group", { name: "Möchten Sie diesen Termin wirklich absagen?" });
  await expect(box).toBeFocused();
  await axeClean(page);
  await box.getByRole("button", { name: "Lieber verschieben?" }).click();
  await expect(page.getByRole("group", { name: "Neuen Zeitpunkt wählen" })).toBeVisible();
  await page.getByRole("button", { name: "Zurück" }).click();

  await page.getByRole("button", { name: "Absagen" }).click();
  await page.getByRole("button", { name: "Nein, behalten" }).click();
  await expect(page.getByRole("button", { name: "Absagen" })).toBeFocused();
  await page.getByRole("button", { name: "Absagen" }).click();
  await page.getByRole("button", { name: "Ja, Termin absagen" }).click();
  await expect(page.getByRole("heading", { name: "Termin abgesagt" })).toBeVisible();
  await expect(statusRow(page)).toHaveText("Abgesagt (durch Sie)");
  await expect(page.getByText("Sie haben diesen Termin abgesagt.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Verschieben|Absagen|In den Kalender/ })).toHaveCount(0);
  await context.close();
});

test("Online-Buchung pausiert: Verschieben per Telefon statt Sackgasse", async ({ request, browser }) => {
  const { token } = await book(request, "paula.telefon@example.invalid");
  await live(request, true);
  try {
    const { context, page } = await phone(browser);
    await page.goto(`/t/#${token}`);
    await expect(page.getByRole("heading", { name: "Ihr Termin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verschieben" })).toHaveCount(0);
    await expect(page.getByText("Zum Verschieben bitte anrufen:")).toBeVisible();
    await expect(page.getByRole("link", { name: "040 490 80 21", exact: true }).first()).toHaveAttribute("href", "tel:0404908021");
    await page.getByRole("button", { name: "Absagen" }).click();
    await expect(page.getByText(/Lieber verschieben\? Rufen Sie uns an/)).toBeVisible();
    await axeClean(page);
    // Auch der Server lässt das Verschieben nicht durch – mit Telefon in der Antwort
    const r = await request.post("/api/public/v1/manage", { headers: { "x-forwarded-for": nextIp() }, data: { token, action: "reschedule", date: "2030-01-07", time: "09:00" } });
    expect(r.status()).toBe(409);
    expect((await r.json()).error.message).toContain("040 490 80 21");
    await context.close();
  } finally {
    await live(request);
  }
});

test("Wartelisten-Angebot: „Angebot ablehnen“ statt „Absagen“, abgelaufene Reservierung in Patientenworten", async ({ request, browser }) => {
  // Eigene Terminart, damit kein Eintrag aus anderen Prüfungen das Angebot bekommt
  await joinWaitlist(request, "wanda.warte@example.invalid", "nachsorge");
  const { token: other } = await book(request, "bert.frei@example.invalid", "nachsorge");
  const cancel = await request.post("/api/public/v1/manage", { headers: { "x-forwarded-for": nextIp() }, data: { token: other, action: "cancel" } });
  expect(cancel.ok(), await cancel.text()).toBeTruthy();
  await e2e(request, { action: "tick" });
  const offer = outbox()
    .filter((m) => m.to === "wanda.warte@example.invalid")
    .find((m) => /reserviert/i.test(m.text));
  expect(offer, `Angebot an die Warteliste. Zustand: ${JSON.stringify(await e2e(request, { action: "state" }))}`).toBeTruthy();

  const { context, page } = await phone(browser);
  await page.goto(`/t/#${manageToken(offer!)}`);
  await expect(page.getByRole("heading", { name: "Ihr Terminangebot" })).toBeVisible();
  await expect(statusRow(page)).toHaveText(/^Reserviert bis .+ Uhr – bitte annehmen$/);
  await expect(page.getByRole("button", { name: "Termin annehmen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Absagen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "In den Kalender" }), "erst nach der Annahme verbindlich").toHaveCount(0);
  await page.getByRole("button", { name: "Angebot ablehnen" }).click();
  await expect(page.getByText(/Der Termin geht dann an die nächste Person auf der Warteliste/)).toBeVisible();
  await axeClean(page);
  await page.getByRole("button", { name: "Nein, zurück" }).click();
  await expect(page.getByRole("button", { name: "Angebot ablehnen" })).toBeFocused();

  await e2e(request, { action: "expire-holds" });
  await e2e(request, { action: "tick" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Reservierung abgelaufen" })).toBeVisible();
  await expect(statusRow(page)).toHaveText("Reservierung abgelaufen");
  await context.close();
});

test("Ungültiger Link und Verbindungsfehler sind zwei Dinge – mit „Erneut versuchen“", async ({ request, browser }) => {
  const { context, page } = await phone(browser);
  await page.goto("/t/#das-ist-kein-gueltiger-link-0000000000");
  await expect(page.getByRole("heading", { name: "Link nicht gültig" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Erneut versuchen" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "040 490 80 21", exact: true })).toBeVisible();

  const { token } = await book(request, "paula.netz@example.invalid");
  let offline = true;
  await page.route("**/api/public/v1/manage", (route) => (offline ? route.abort("failed") : route.continue()));
  await page.goto(`/t/#${token}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Gerade keine Verbindung" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Internetverbindung" })).toBeVisible();
  await axeClean(page);
  offline = false;
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByRole("heading", { name: "Ihr Termin" })).toBeVisible();
  await context.close();
});

test("Warteliste verlassen nur mit Rückfrage", async ({ request, browser }) => {
  await joinWaitlist(request, "walter.liste@example.invalid", "erstuntersuchung");
  const joined = outbox()
    .filter((m) => m.to === "walter.liste@example.invalid")
    .at(-1);
  expect(joined, "Eintrags-Mail mit Verwaltungslink").toBeTruthy();
  const { context, page } = await phone(browser);
  await page.goto(`/t/#${manageToken(joined!)}`);
  await expect(page.getByRole("heading", { name: "Ihre Warteliste" })).toBeVisible();
  await page.getByRole("button", { name: "Von der Warteliste streichen" }).click();
  await expect(page.getByText("Sie bekommen danach keine Angebote mehr für frei werdende Termine.")).toBeVisible();
  await page.getByRole("button", { name: "Nein, auf der Liste bleiben" }).click();
  await expect(page.getByRole("button", { name: "Von der Warteliste streichen" })).toBeFocused();
  await expect(page.getByText("wartend")).toBeVisible();
  await page.getByRole("button", { name: "Von der Warteliste streichen" }).click();
  await page.getByRole("button", { name: "Ja, streichen" }).click();
  await expect(page.getByRole("status")).toContainText("gestrichen");
  await expect(page.getByText("zurückgezogen")).toBeVisible();
  await context.close();
});
