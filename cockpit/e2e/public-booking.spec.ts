import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIL_OUTBOX_DIR } from "../playwright.config";

/**
 * Der Weg einer Patientin ohne Cockpit-Konto:
 * Website (Provider „cockpit“) → verbindliche Buchung → Bestätigungs-Mail mit
 * Kalenderdatei und Verwaltungslink → bestätigen → Warteliste → absagen →
 * automatisches Angebot an die Warteliste → annehmen. Dazu Missbrauchsschutz
 * (Honigtopf, Formular-Token, Doppelbuchung) und Barrierefreiheit der
 * Patientenseite.
 */
test.describe.configure({ mode: "serial" });

const SECRET = process.env.E2E_SECRET;
const SITE = "http://localhost:3000";

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

async function e2e(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.post("/api/internal/e2e", { data: { secret: SECRET, ...body } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

async function firstFreeSlot(request: APIRequestContext, typeId = "kontrolle") {
  const r = await request.get(`/api/public/v1/availability?type=${typeId}`);
  expect(r.ok(), await r.text()).toBeTruthy();
  const j = (await r.json()) as { days: Array<{ date: string; slots: string[] }>; formToken: string };
  const day = j.days.find((d) => d.slots.length > 0);
  expect(day, "mindestens ein Tag mit freien Zeiten").toBeTruthy();
  return { date: day!.date, slots: day!.slots, formToken: j.formToken };
}

const patient = { firstName: "Erika", lastName: "Musterfrau", email: "erika.musterfrau@example.invalid", phone: "040 000 0000", consent: true };

let confirmationToken = "";
let bookedRef = "";
let bookedDate = "";
let bookedTime = "";

test("Live schalten geht erst ohne Demo-Daten; Status und Terminarten sind öffentlich", async ({ request }) => {
  const seeded = await e2e(request, { action: "seed-demo" });
  expect(seeded.appointments).toBeGreaterThan(0);
  // Wie in der Praxis: Solange Demo-Zeilen existieren, verweigert die App den Live-Betrieb
  const go = await e2e(request, { action: "golive" });
  expect(go.blockedWhileDemo, "Live-Schalter muss bei vorhandenen Demo-Daten sperren").toBe(true);
  expect(go.demoRemoved).toBeGreaterThan(0);
  const s = await request.get("/api/public/v1/status");
  expect(s.ok()).toBeTruthy();
  expect(await s.json()).toMatchObject({ bookingLive: true, bookingPaused: false });
  const t = await request.get("/api/public/v1/appointment-types");
  const { types } = (await t.json()) as { types: Array<{ id: string; label: string }> };
  expect(types.map((x) => x.id)).toContain("kontrolle");
  // Interne Terminarten bleiben draußen, und es steht kein Personenbezug in der Antwort
  expect(JSON.stringify(types)).not.toMatch(/Mustermann|@/);
});

test("Missbrauchsschutz: Honigtopf, frisches Token, CORS nur für die Website", async ({ request }) => {
  const { date, slots, formToken } = await firstFreeSlot(request);
  // Token jünger als 3 s → abgelehnt
  const tooFast = await request.post("/api/public/v1/bookings", { data: { ...patient, typeId: "kontrolle", date, time: slots[0], formToken } });
  expect(tooFast.status()).toBe(400);
  expect((await tooFast.json()).error.code).toBe("form_token");
  await new Promise((r) => setTimeout(r, 3300));
  // Honigtopf gefüllt → Validierungsfehler ohne Hinweis
  const bot = await request.post("/api/public/v1/bookings", { data: { ...patient, typeId: "kontrolle", date, time: slots[0], formToken, hp: "http://spam.example" } });
  expect(bot.status()).toBe(422);
  // Fremder Ursprung bekommt keine CORS-Freigabe, die Website schon
  const foreign = await request.fetch("/api/public/v1/status", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
  expect(foreign.headers()["access-control-allow-origin"]).toBeUndefined();
  const own = await request.fetch("/api/public/v1/status", { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" } });
  expect(own.headers()["access-control-allow-origin"]).toBe("http://localhost:3000");
});

test("Verbindliche Buchung; Doppelbuchung derselben Zeit scheitert", async ({ request }) => {
  const { date, slots, formToken } = await firstFreeSlot(request);
  await new Promise((r) => setTimeout(r, 3300));
  const time = slots[0]!;
  const ok = await request.post("/api/public/v1/bookings", { data: { ...patient, typeId: "kontrolle", date, time, formToken } });
  expect(ok.status(), await ok.text()).toBe(201);
  const j = (await ok.json()) as { ref: string; startsAt: string };
  expect(j.ref).toMatch(/^PE-[A-Z0-9]{4}$/);
  bookedRef = j.ref;
  bookedDate = date;
  bookedTime = time;
  const dup = await request.post("/api/public/v1/bookings", { data: { ...patient, email: "zweite.person@example.invalid", typeId: "kontrolle", date, time, formToken } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).error.code).toBe("slot_taken");
  // Die gebuchte Zeit ist sofort aus der öffentlichen Verfügbarkeit verschwunden
  const after = await request.get(`/api/public/v1/availability?type=kontrolle&from=${date}&to=${date}`);
  const j2 = (await after.json()) as { days: Array<{ date: string; slots: string[] }> };
  expect(j2.days[0]?.slots ?? []).not.toContain(time);
});

test("Bestätigungs-Mail mit Kalenderdatei und Verwaltungslink", async ({ request }) => {
  const report = await e2e(request, { action: "tick" });
  expect(report.jobs.done).toBeGreaterThanOrEqual(1);
  const mails = outbox().filter((m) => m.to === patient.email);
  expect(mails.length).toBeGreaterThanOrEqual(1);
  const mail = mails.at(-1)!;
  expect(mail.text).toContain(bookedRef);
  expect(mail.text).toContain("Kontrolltermin");
  expect(mail.text).not.toMatch(/Diagnose|Hämorrhoiden|Befund/);
  const ics = mail.attachments?.find((a) => a.filename === "termin.ics");
  expect(ics?.content).toContain("BEGIN:VCALENDAR");
  expect(ics?.content).toContain("TZID=Europe/Berlin");
  confirmationToken = manageToken(mail) ?? "";
  expect(confirmationToken.length).toBeGreaterThan(30);
});

test("Patientenseite: bestätigen, barrierefrei, absagen", async ({ page }) => {
  await page.goto(`/t/#${confirmationToken}`);
  await expect(page.getByRole("heading", { name: "Ihr Termin" })).toBeVisible();
  await expect(page.getByText(bookedRef)).toBeVisible();
  await expect(page.getByText("Kontrolltermin")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await page.screenshot({ path: "e2e/shots/patient-termin.png" });

  await page.getByRole("button", { name: "Termin bestätigen" }).click();
  await expect(page.getByRole("status")).toContainText("bestätigt");
  await expect(page.getByRole("button", { name: "Termin bestätigen" })).toHaveCount(0);

  // Absagen fragt einmal nach
  await page.getByRole("button", { name: "Absagen" }).click();
  await page.getByRole("button", { name: "Ja, Termin absagen" }).click();
  await expect(page.getByRole("heading", { name: "Termin abgesagt" })).toBeVisible();
  // Der Link bleibt gültig, zeigt aber den Endzustand
  await page.reload();
  await expect(page.getByRole("heading", { name: "Termin abgesagt" })).toBeVisible();
});

test("Warteliste: Eintrag, automatisches Angebot nach Absage, Annahme, Ablauf", async ({ request, page }) => {
  // Zweite Person trägt sich ein; dann wird derselbe Platz frei (siehe oben) – hier: neuer Termin + Absage
  const { formToken } = await firstFreeSlot(request);
  await new Promise((r) => setTimeout(r, 3300));
  const join = await request.post("/api/public/v1/waitlist", {
    data: { typeId: "kontrolle", firstName: "Max", lastName: "Mustermann", email: "max.mustermann@example.invalid", consent: true, formToken },
  });
  expect(join.status(), await join.text()).toBe(201);

  // Ein Termin wird gebucht und danach abgesagt → Platz frei → Angebot an Max
  const { date, slots, formToken: tok2 } = await firstFreeSlot(request);
  await new Promise((r) => setTimeout(r, 3300));
  const b = await request.post("/api/public/v1/bookings", { data: { ...patient, email: "dritte.person@example.invalid", typeId: "kontrolle", date, time: slots[0], formToken: tok2 } });
  expect(b.status(), await b.text()).toBe(201);
  await e2e(request, { action: "tick" });
  const bookingMail = outbox().filter((m) => m.to === "dritte.person@example.invalid").at(-1)!;
  const token3 = manageToken(bookingMail)!;
  const cancel = await request.post("/api/public/v1/manage", { data: { token: token3, action: "cancel" } });
  expect(cancel.ok(), await cancel.text()).toBeTruthy();

  const report = await e2e(request, { action: "tick" });
  expect(report.jobs.done).toBeGreaterThanOrEqual(1);
  const offer = outbox().filter((m) => m.to === "max.mustermann@example.invalid").find((m) => /reserviert/i.test(m.text));
  expect(offer, `Wartelisten-Angebot per Mail. Zustand: ${JSON.stringify(await e2e(request, { action: "state" }))}`).toBeTruthy();
  const offerToken = manageToken(offer!)!;

  // Annahme über die Patientenseite
  await page.goto(`/t/#${offerToken}`);
  await expect(page.getByRole("heading", { name: "Ihr Terminangebot" })).toBeVisible();
  await expect(page.getByText(/Reserviert bis/)).toBeVisible();
  await page.screenshot({ path: "e2e/shots/patient-angebot.png" });
  await page.getByRole("button", { name: "Termin annehmen" }).click();
  await expect(page.getByRole("status")).toContainText("verbindlich");
  await e2e(request, { action: "tick" });
  const confirmed = outbox().filter((m) => m.to === "max.mustermann@example.invalid").find((m) => m.attachments?.some((a) => a.filename === "termin.ics"));
  expect(confirmed, "Bestätigung mit Kalenderdatei nach Annahme").toBeTruthy();

  // Ablauf: ein weiteres Angebot, das niemand annimmt, wird vom Tick freigegeben
  const { formToken: tok4 } = await firstFreeSlot(request);
  await new Promise((r) => setTimeout(r, 3300));
  await request.post("/api/public/v1/waitlist", { data: { typeId: "kontrolle", firstName: "Otto", lastName: "Normalverbraucher", email: "otto@example.invalid", consent: true, formToken: tok4 } });
  const cancelFirst = await request.post("/api/public/v1/manage", { data: { token: offerToken, action: "cancel" } });
  expect(cancelFirst.ok()).toBeTruthy();
  await e2e(request, { action: "tick" });
  const ottoOffer = outbox().filter((m) => m.to === "otto@example.invalid").find((m) => /reserviert/i.test(m.text));
  expect(ottoOffer, "Angebot an die nächste Person").toBeTruthy();
  const expired = await e2e(request, { action: "expire-holds" });
  expect(expired.updated).toBeGreaterThanOrEqual(1);
  const r2 = await e2e(request, { action: "tick" });
  expect(r2.holdsExpired).toBeGreaterThanOrEqual(1);
  const view = await request.post("/api/public/v1/manage", { data: { token: manageToken(ottoOffer!)!, action: "view" } });
  expect((await view.json()).status).toBe("cancelled");
});

test("Website: verbindliche Buchung über die Terminkarte", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/#kontakt`, { waitUntil: "domcontentloaded" });
  const card = page.locator("#kontakt");
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText(/verbindlich/i).first()).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Kontrolltermin/ }).click();
  // Kalender: erster wählbarer Tag
  const cell = card.locator('[role="gridcell"][data-date]:not([aria-disabled="true"])').first();
  await expect(cell).toBeVisible({ timeout: 20_000 });
  await cell.click();
  const slot = card.locator("button[data-slot]").first();
  await expect(slot).toBeVisible({ timeout: 20_000 });
  await slot.click();
  await card.getByLabel(/Vorname/).fill("Lieschen");
  await card.getByLabel(/Nachname/).fill("Müller");
  await card.getByLabel(/E-Mail/).fill("lieschen.mueller@example.invalid");
  await card.getByLabel(/Telefon/).fill("040 000 0001");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: /Weiter zur Übersicht/ }).click();
  await card.getByRole("button", { name: /Termin verbindlich buchen/ }).click();
  await expect(card.getByText(/Termin verbindlich gebucht/)).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/PE-[A-Z0-9]{4}/)).toBeVisible();
  await page.screenshot({ path: "e2e/shots/website-gebucht.png" });
  await context.close();
});

test("Website-Buchung hat eine Bestätigung mit Kalenderdatei ausgelöst", async ({ request }) => {
  await e2e(request, { action: "tick" });
  const mail = outbox().filter((m) => m.to === "lieschen.mueller@example.invalid").at(-1);
  expect(mail, "Bestätigung an die Website-Buchung").toBeTruthy();
  expect(mail!.attachments?.some((a) => a.filename === "termin.ics")).toBeTruthy();
  expect(manageToken(mail!)).toBeTruthy();
  expect(bookedDate && bookedTime).toBeTruthy();
});
