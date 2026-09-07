import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FAKE_LLM_PORT, MAIL_OUTBOX_DIR } from "../playwright.config";

/**
 * Der Chat-Assistent, von außen betrachtet.
 *
 * Alles hier läuft durch die echte Route und die echte Datenbank; das
 * Sprachmodell ist gestellt (e2e/fake-llm.mjs), weil die kostenlosen
 * Anbieter im Testlauf weder erreichbar noch berechenbar sind. Gerade
 * deshalb lässt sich hier zeigen, was ohne Modell noch funktioniert – und
 * was das Modell nie zu sehen bekommt.
 *
 * Diese Datei läuft nach public-booking.spec.ts (Dateireihenfolge) und
 * findet die Online-Buchung deshalb bereits im Live-Betrieb vor.
 */
test.describe.configure({ mode: "serial" });

const SECRET = process.env.E2E_SECRET;
const SITE = "http://localhost:3000";
const LLM = `http://localhost:${FAKE_LLM_PORT}`;

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

async function e2e(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.post("/api/internal/e2e", { data: { secret: SECRET, ...body } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

// ---------------------------------------------------- gestelltes Modell

async function llmMode(request: APIRequestContext, mode: "ok" | "fail" | "timeout" | "hallucinate") {
  const r = await request.post(`${LLM}/__mode`, { data: { mode } });
  expect(r.ok()).toBeTruthy();
}

async function llmCalls(request: APIRequestContext): Promise<Array<{ task: string; model: string | null }>> {
  const r = await request.get(`${LLM}/__calls`);
  return (await r.json()).calls;
}

async function llmReset(request: APIRequestContext) {
  await request.delete(`${LLM}/__calls`);
}

// ---------------------------------------------------------- Chat-Route

interface Answer {
  reply: string;
  lang: "de" | "en";
  state: unknown;
  quick?: Array<{ id: string; label: string }>;
  form?: { id: string };
  flags: { emergency?: true; handover?: true; booked?: { ref: string; mail: string }; llm: string };
}

let sessionCounter = 0;
const newSessionId = () => `00000000-0000-4000-8000-${String(++sessionCounter).padStart(12, "0")}`;
/**
 * Jede simulierte Patientin bekommt ihre eigene Adresse. Sonst laufen alle
 * Fälle in dieselbe Schranke „sechs Buchungen je Stunde und IP“ – die ist
 * gewollt und bleibt, aber sie darf nicht davon abhängen, welche Tests
 * vorher gelaufen sind. Im Betrieb setzt Vercel diesen Kopf selbst; hier
 * gibt es keinen Proxy davor.
 */
const ipFor = (sessionId: string) => `198.51.100.${(Number(sessionId.slice(-6)) % 250) + 1}`;

async function chat(
  request: APIRequestContext,
  body: { sessionId: string; state: unknown; message?: string; action?: unknown },
): Promise<{ status: number; answer: Answer }> {
  const r = await request.post("/api/public/v1/chat", {
    data: { v: 1, ...body },
    headers: { Origin: SITE, "X-Forwarded-For": ipFor(body.sessionId) },
  });
  return { status: r.status(), answer: (await r.json()) as Answer };
}

/** Ein ganzes Gespräch aus Nachrichten und Klicks, der Reihe nach. */
async function conversation(request: APIRequestContext, steps: Array<string | { quick: string } | { form: [string, Record<string, string>] }>) {
  const sessionId = newSessionId();
  let state: unknown = null;
  let last: { status: number; answer: Answer } | null = null;
  for (const step of steps) {
    const body =
      typeof step === "string"
        ? { sessionId, state, message: step }
        : "quick" in step
          ? { sessionId, state, action: { kind: "quick", id: step.quick } }
          : { sessionId, state, action: { kind: "form", formId: step.form[0], values: step.form[1] } };
    last = await chat(request, body);
    if (last.status === 200) state = last.answer.state;
  }
  return { sessionId, state, ...last! };
}

// ------------------------------------------------------------ Oberfläche

/** Das Chat-Fenster öffnen – geklickt wird, bis React hydriert hat. */
async function openChat(page: Page, path = "/") {
  await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded" });
  const launcher = page.getByRole("button", { name: "Chat öffnen" });
  await launcher.waitFor({ state: "visible", timeout: 30_000 });
  const dialog = page.locator("#site-chat-window");
  await expect(async () => {
    if (!(await dialog.isVisible())) await launcher.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  return dialog;
}

test.beforeAll(async ({ request }) => {
  await e2e(request, { action: "settings", settings: { bookingLive: true, bookingPaused: false, bannerText: null, chatEnabled: true } });
  await llmMode(request, "ok");
  await llmReset(request);
});

// =====================================================================

test("Der Chat ist auf jeder Seite erreichbar, begrüßt mit Sprechzeiten und ist barrierefrei", async ({ page }) => {
  for (const path of ["/", "/impressum/", "/datenschutz/"]) {
    const dialog = await openChat(page, path);
    const log = dialog.getByRole("log");
    await expect(log).toContainText("Proktologie Eimsbüttel", { timeout: 20_000 });
    await expect(log).toContainText("Dr. med. Kai Kunstreich");
    await expect(log).toContainText("Mo, Mi, Fr");
    await expect(dialog.getByRole("link", { name: "Datenschutzerklärung" })).toHaveAttribute("href", "/datenschutz/#chat");
    for (const label of ["Termin vereinbaren", "Öffnungszeiten", "Anfahrt"]) {
      await expect(dialog.getByRole("button", { name: label })).toBeVisible();
    }
  }
  const axe = await new AxeBuilder({ page }).include("#site-chat").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await page.screenshot({ path: "e2e/shots/chat-start.png" });
});

test("Der Verlauf überlebt einen Seitenwechsel", async ({ page }) => {
  const dialog = await openChat(page, "/");
  await dialog.getByRole("button", { name: "Öffnungszeiten" }).click();
  await expect(dialog.getByRole("log")).toContainText("Sprechzeiten:", { timeout: 20_000 });

  const zweites = await openChat(page, "/impressum/");
  await expect(zweites.getByRole("log")).toContainText("Sprechzeiten:", { timeout: 20_000 });
  await expect(zweites.getByRole("log")).toContainText("Öffnungszeiten", { timeout: 20_000 });
});

test("„Ist … frei?“ wird an der echten Belegung beantwortet", async ({ request }) => {
  const avail = await request.get("/api/public/v1/availability?type=kontrolle");
  const days = (await avail.json()).days as Array<{ date: string; slots: string[] }>;
  const tag = days.find((d) => d.slots.length >= 2)!;
  expect(tag, "ein Tag mit freien Zeiten").toBeTruthy();
  const zeit = tag.slots[0]!;

  const frei = await conversation(request, [{ quick: "book" }, { quick: "type:kontrolle" }, `Ist ${tag.date} um ${zeit} frei?`]);
  expect(frei.answer.reply).toMatch(new RegExp(`^Ja, ${zeit} Uhr am `));

  // Dieselbe Zeit belegen – über den ganz normalen Weg
  const gebucht = await conversation(request, [
    { quick: "book" },
    { quick: "type:kontrolle" },
    { quick: `time:${tag.date}|${zeit}` },
    { form: ["contact", { firstName: "Belegt", lastName: "Test", email: "belegt@example.invalid", consent: "true" }] },
    "ja",
  ]);
  expect(gebucht.answer.flags.booked?.ref).toMatch(/^PE-/);

  const belegt = await conversation(request, [{ quick: "book" }, { quick: "type:kontrolle" }, `Ist ${tag.date} um ${zeit} frei?`]);
  expect(belegt.answer.reply).toMatch(new RegExp(`^Nein, ${zeit} Uhr ist belegt – frei sind `));
});

test("Buchung im Fenster: Bestätigungsfrage, Referenz, Mail an Patientin und Praxis", async ({ page, request }) => {
  const vorher = outbox().length;
  const dialog = await openChat(page, "/");

  await dialog.getByRole("button", { name: "Termin vereinbaren" }).click();
  await dialog.getByRole("button", { name: "Kontrolltermin", exact: true }).click({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Nächster freier Termin" }).click({ timeout: 20_000 });
  // Erster angebotener Tag, dann erste angebotene Uhrzeit
  await dialog.locator("button").filter({ hasText: /^\w+tag, / }).first().click({ timeout: 20_000 });
  await dialog.locator("button").filter({ hasText: /^\d{2}:\d{2} Uhr$/ }).first().click({ timeout: 20_000 });

  await expect(dialog.getByText("Ihre Kontaktdaten", { exact: true })).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel("Vorname").fill("Erika");
  await dialog.getByLabel("Nachname").fill("Musterfrau");
  await dialog.getByLabel("E-Mail", { exact: true }).fill("chat.patientin@example.invalid");
  await dialog.getByLabel(/einverstanden/).check();
  await dialog.getByRole("button", { name: "Weiter" }).click();

  await expect(dialog.getByRole("log")).toContainText("Soll ich das so verbindlich buchen?", { timeout: 20_000 });
  await page.screenshot({ path: "e2e/shots/chat-zusammenfassung.png" });
  await dialog.getByRole("button", { name: "Ja, verbindlich buchen" }).click();
  await expect(dialog.getByRole("log")).toContainText(/Gebucht: .* Ihre Referenz: PE-/, { timeout: 30_000 });

  const ref = (await dialog.getByRole("log").innerText()).match(/PE-[A-Z0-9]{4}/)?.[0];
  expect(ref).toBeTruthy();

  await e2e(request, { action: "tick" });
  const neu = outbox().slice(vorher);
  const patientin = neu.find((m) => m.to === "chat.patientin@example.invalid" && /Ihr Termin am/.test(m.subject));
  expect(patientin, "Bestätigung an die Patientin").toBeTruthy();
  expect(patientin!.attachments?.some((a) => a.filename === "termin.ics")).toBeTruthy();
  expect(patientin!.text).toMatch(/\/t\/#[A-Za-z0-9_-]{30,}/);
  const praxis = neu.find((m) => m.to === "praxis@example.invalid" && m.subject.includes(ref!));
  expect(praxis, "Meldung an die Praxis").toBeTruthy();
  expect(praxis!.subject).toMatch(/^Neue Buchung: /);
});

test("Zwei gleichzeitige Zusagen für denselben Platz: nur eine bucht", async ({ request }) => {
  const avail = await request.get("/api/public/v1/availability?type=kontrolle");
  const days = (await avail.json()).days as Array<{ date: string; slots: string[] }>;
  const tag = days.find((d) => d.slots.length > 0)!;
  const zeit = tag.slots[0]!;

  // Zwei Gespräche bis unmittelbar vor die Zusage bringen
  const vorbereiten = (nr: number) =>
    conversation(request, [
      { quick: "book" },
      { quick: "type:kontrolle" },
      { quick: `time:${tag.date}|${zeit}` },
      { form: ["contact", { firstName: `Gleich${nr}`, lastName: "Zeitig", email: `gleichzeitig${nr}@example.invalid`, consent: "true" }] },
    ]);
  const [a, b] = await Promise.all([vorbereiten(1), vorbereiten(2)]);

  const [x, y] = await Promise.all([
    chat(request, { sessionId: a.sessionId, state: a.state, message: "ja" }),
    chat(request, { sessionId: b.sessionId, state: b.state, message: "ja" }),
  ]);
  const gebucht = [x, y].filter((r) => r.answer.flags.booked);
  expect(gebucht.length, `genau eine Buchung, nicht ${gebucht.length}`).toBe(1);
  const andere = [x, y].find((r) => !r.answer.flags.booked)!;
  expect(andere.answer.reply).toMatch(/^Diese Zeit wurde gerade vergeben\./);
  expect(andere.answer.quick?.every((q) => q.id.startsWith("time:"))).toBeTruthy();
});

test("Notfall: 112 und 116 117 im Fenster, ohne einen einzigen Modellaufruf", async ({ page, request }) => {
  await llmReset(request);
  const dialog = await openChat(page, "/");
  await dialog.getByLabel("Ihre Nachricht").fill("Ich habe starke Brustschmerzen und bekomme keine Luft");
  await dialog.getByLabel("Ihre Nachricht").press("Enter");

  const alarm = dialog.getByRole("alert");
  await expect(alarm).toBeVisible({ timeout: 30_000 });
  await expect(alarm.getByRole("link", { name: "112" })).toHaveAttribute("href", "tel:112");
  await expect(alarm.getByRole("link", { name: "116 117" })).toHaveAttribute("href", "tel:116117");
  await expect(dialog.getByRole("log")).toContainText("Dieser Chat kann keine Notfallhilfe leisten.");
  await expect(dialog.getByLabel("Ihre Nachricht")).toHaveCount(0);
  await page.screenshot({ path: "e2e/shots/chat-notfall.png" });

  expect(await llmCalls(request), "kein Modellaufruf im Notfall").toEqual([]);
});

test("Medizinische Frage: der vorgegebene Satz, ohne Modellaufruf", async ({ request }) => {
  await llmReset(request);
  const r = await conversation(request, ["Ich habe Blut am Stuhl, ist das gefährlich?"]);
  expect(r.answer.reply).toBe("Dazu kann ich nichts sagen, das bespricht Dr. Kunstreich mit Ihnen persönlich. Soll ich Ihnen einen Termin suchen?");
  expect(await llmCalls(request), "Gesundheitsangaben erreichen kein Modell").toEqual([]);
});

test("Englisch: englische Antworten und englische Buchung", async ({ request }) => {
  const r = await conversation(request, ["Hello, when are you open?"]);
  expect(r.answer.lang).toBe("en");
  expect(r.answer.reply).toMatch(/^Opening hours: /);

  const avail = await request.get("/api/public/v1/availability?type=kontrolle");
  const days = (await avail.json()).days as Array<{ date: string; slots: string[] }>;
  const tag = days.find((d) => d.slots.length > 0)!;
  const gebucht = await conversation(request, [
    "I would like to book an appointment",
    { quick: "type:kontrolle" },
    { quick: `time:${tag.date}|${tag.slots[0]}` },
    { form: ["contact", { firstName: "John", lastName: "Doe", email: "john.doe@example.invalid", consent: "true" }] },
    "yes",
  ]);
  expect(gebucht.answer.flags.booked?.ref).toMatch(/^PE-/);
  expect(gebucht.answer.reply).toMatch(/^Booked: /);
  expect(gebucht.answer.lang).toBe("en");
});

test("Was die Praxis nicht hinterlegt hat, wird nicht erfunden", async ({ request }) => {
  const r = await conversation(request, ["Haben Sie Parkplätze?"]);
  expect(r.answer.reply).toMatch(/Das weiß ich leider nicht/);
  expect(r.answer.reply).toContain("040 490 80 21");
});

test("Übergabe und Rückruf: Referenz und Meldung an die Praxis", async ({ request }) => {
  const vorher = outbox().length;
  const r = await conversation(request, [
    "Ich möchte mit einem Menschen sprechen",
    { quick: "callback" },
    { form: ["callback", { kind: "rueckruf", firstName: "Rudi", lastName: "Rückruf", phone: "040 55 66 77", preferredTime: "vormittags" }] },
  ]);
  const ref = r.answer.reply.match(/AN-[A-Z0-9]{4}/)?.[0];
  expect(ref, r.answer.reply).toBeTruthy();

  await e2e(request, { action: "tick" });
  const praxis = outbox().slice(vorher).find((m) => m.to === "praxis@example.invalid" && m.subject.includes(ref!));
  expect(praxis, "Meldung an die Praxis").toBeTruthy();
  expect(praxis!.subject).toMatch(/^Neue Anfrage: /);
});

test("Ohne erreichbares Modell bleibt der Chat auskunftsfähig", async ({ request }) => {
  await llmMode(request, "fail");
  const zeiten = await conversation(request, ["Wann haben Sie geöffnet?"]);
  expect(zeiten.answer.reply).toMatch(/Sprechzeiten: /);

  const unklar = await conversation(request, ["Sagen Sie Herrn Meier viele Grüße."]);
  expect(unklar.answer.reply).toContain("040 490 80 21");
  expect(unklar.answer.flags.llm).toBe("fallback");

  // Der Weg über die Schaltflächen hängt nicht am Modell
  const termin = await conversation(request, [{ quick: "book" }, { quick: "type:kontrolle" }, { quick: "nextfree" }]);
  expect(termin.answer.quick?.length).toBeGreaterThan(0);
  await llmMode(request, "ok");
});

test("Erfindet das Modell etwas, gilt der Faktentext", async ({ request }) => {
  await llmMode(request, "hallucinate");
  const r = await conversation(request, ["Wann haben Sie geöffnet?"]);
  expect(r.answer.reply).not.toContain("19:30");
  expect(r.answer.reply).not.toContain("Parkplätze");
  expect(r.answer.reply).toMatch(/Sprechzeiten: /);
  expect(r.answer.flags.llm).toBe("fallback");
  await llmMode(request, "ok");
});

test("Ein Anbieter ohne Schlüssel wird nie aufgerufen", async ({ request }) => {
  await llmReset(request);
  await conversation(request, ["Wann haben Sie geöffnet?"]);
  const calls = await llmCalls(request);
  expect(calls.length, "das Modell wurde gefragt").toBeGreaterThan(0);
  expect(calls.every((c) => c.model === "fake/one"), JSON.stringify(calls)).toBeTruthy();
  expect(calls.some((c) => c.model === "fake/two:free"), "OpenRouter hat keinen Schlüssel").toBeFalsy();
});

test("Das 21. Wort in einer Sitzung wird abgewiesen", async ({ request }) => {
  const sessionId = newSessionId();
  let state: unknown = null;
  let gesperrt = 0;
  for (let i = 1; i <= 21; i++) {
    const r = await chat(request, { sessionId, state, message: "Wann haben Sie geöffnet?" });
    if (r.status === 200) state = r.answer.state;
    else {
      expect(r.status).toBe(429);
      expect(i, "erst die 21. Nachricht wird abgewiesen").toBe(21);
      gesperrt++;
    }
  }
  expect(gesperrt).toBe(1);
});

test("Eine gesperrte Adresse bucht nicht", async ({ request }) => {
  const avail = await request.get("/api/public/v1/availability?type=kontrolle");
  const days = (await avail.json()).days as Array<{ date: string; slots: string[] }>;
  const tag = days.find((d) => d.slots.length > 0)!;
  const r = await conversation(request, [
    { quick: "book" },
    { quick: "type:kontrolle" },
    { quick: `time:${tag.date}|${tag.slots[0]}` },
    { form: ["contact", { firstName: "Ge", lastName: "Sperrt", email: "gesperrt@example.invalid", consent: "true" }] },
    "ja",
  ]);
  expect(r.answer.flags.booked).toBeUndefined();
  expect(r.answer.reply).toContain("040 490 80 21");

  // Der Platz ist noch frei – die Sperre hat nichts belegt
  const wieder = await request.get("/api/public/v1/availability?type=kontrolle");
  const jetzt = ((await wieder.json()).days as Array<{ date: string; slots: string[] }>).find((d) => d.date === tag.date);
  expect(jetzt?.slots).toContain(tag.slots[0]);
});

test("Abgeschaltet: das Fenster zeigt nur Telefon und Sprechzeiten, die Route antwortet 503", async ({ page, request }) => {
  await e2e(request, { action: "settings", settings: { chatEnabled: false } });

  const r = await chat(request, { sessionId: newSessionId(), state: null, message: "Wann haben Sie geöffnet?" });
  expect(r.status).toBe(503);

  const dialog = await openChat(page, "/");
  await expect(dialog.getByText("Chat gerade nicht verfügbar")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("link", { name: /Anrufen: 040 490 80 21/ })).toBeVisible();
  await expect(dialog.getByText("Mo, Mi, Fr")).toBeVisible();
  await expect(dialog.getByLabel("Ihre Nachricht")).toHaveCount(0);
  await page.screenshot({ path: "e2e/shots/chat-aus.png" });

  // Der Notfall gilt auch dann
  const notfall = await chat(request, { sessionId: newSessionId(), state: null, message: "Ich bin bewusstlos gewesen" });
  expect(notfall.status).toBe(200);
  expect(notfall.answer.flags.emergency).toBe(true);

  await e2e(request, { action: "settings", settings: { chatEnabled: true } });
});
