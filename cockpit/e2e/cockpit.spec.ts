import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIL_OUTBOX_DIR } from "../playwright.config";
import { totp } from "./totp";

/**
 * Der komplette Weg einer neuen Mitarbeiterin: Einladung → Konto →
 * Passkey (virtueller Authenticator per CDP) → TOTP → Cockpit → ⌘K →
 * Termin anlegen → Tagesplan → Abmelden → Passwort + TOTP-Login.
 */
test.describe.configure({ mode: "serial" });

let inviteLink = "";
let totpSecret = "";

async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return cdp;
}

test("Einladung erzeugen (Test-Einstieg)", async ({ request }) => {
  const r = await request.post("/api/internal/e2e", { data: { secret: process.env.E2E_SECRET, inviteEmail: "empfang@example.invalid", role: "arzt" } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const j = (await r.json()) as { inviteLink: string };
  inviteLink = j.inviteLink;
  expect(inviteLink).toMatch(/\/einladung#[A-Za-z0-9_-]{30,}$/);
});

test("Einladung annehmen, Passkey und TOTP einrichten", async ({ page }) => {
  await virtualAuthenticator(page);
  await page.goto(inviteLink);
  await expect(page.getByRole("heading", { name: /Konto anlegen/ })).toBeVisible();
  await page.getByLabel("Vollständiger Name").fill("Erika Musterfrau");
  await page.getByLabel("Passwort (mindestens 12 Zeichen)").fill("Sehr-sicheres-Passwort-1");
  await page.getByLabel("Passwort wiederholen").fill("Sehr-sicheres-Passwort-1");
  await page.getByRole("button", { name: "Konto anlegen" }).click();

  // Schritt 1: Passkey
  await expect(page.getByRole("heading", { name: "Passkey anlegen" })).toBeVisible();
  await page.getByRole("button", { name: /Passkey jetzt anlegen/ }).click();

  // Schritt 2: TOTP
  await expect(page.getByRole("heading", { name: "Zweiter Faktor" })).toBeVisible();
  await page.getByLabel("Passwort").fill("Sehr-sicheres-Passwort-1");
  await page.getByRole("button", { name: "QR-Code anzeigen" }).click();
  await page.getByText("Code manuell eingeben").click();
  totpSecret = (await page.locator("code").first().textContent())?.trim() ?? "";
  expect(totpSecret.length).toBeGreaterThan(10);
  await expect(page.getByText("Backup-Codes")).toBeVisible();
  await page.getByLabel("Code aus der App").fill(totp(totpSecret));
  // Die Codes erscheinen nur hier – ohne „Ich habe sie gespeichert“ geht es nicht weiter
  await page.getByRole("button", { name: /Aktivieren und ins Cockpit/ }).click();
  await expect(page.getByText("Bitte die Backup-Codes sichern und „Ich habe sie gespeichert“ ankreuzen.")).toBeVisible();
  await page.getByLabel("Ich habe sie gespeichert").check();
  await page.getByRole("button", { name: /Aktivieren und ins Cockpit/ }).click();

  // Im Cockpit. Der erste Aufruf kompiliert im Dev-Server die Seite und stößt
  // zusätzlich den Automatik-Herzschlag an – dafür großzügig Zeit lassen.
  await expect(page.getByRole("heading", { name: /Erika/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Termine heute/)).toBeVisible();

  // Barrierefreiheit der Startseite
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);

  // ⌘K → Termine
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Suchen oder springen" })).toBeVisible();
  await page.getByRole("combobox", { name: "Suchen oder springen" }).fill("Termine");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/termine/);

  // Termin anlegen
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const today = new Date();
  // nächster Werktag ab morgen
  const d = new Date(today);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  const date = d.toISOString().slice(0, 10);
  await page.getByLabel("Datum", { exact: true }).fill(date);
  await page.getByLabel("Uhrzeit", { exact: true }).fill("09:00");
  await page.getByLabel("Vorname", { exact: true }).fill("Max");
  await page.getByLabel("Nachname", { exact: true }).fill("Mustermann");
  await page.getByLabel("Telefon", { exact: true }).fill("040 000 0000");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();

  // Tagesansicht des Tages zeigt den Termin
  await page.goto(`/termine?v=tag&d=${date}`);
  await expect(page.getByRole("button", { name: /09:00 Mustermann, Max/ })).toBeVisible();

  // Demo-Daten anlegen (testet die Seed-Action) – danach zeigen die Screenshots echte Dichte
  await page.goto("/einstellungen/demo");
  await page.getByRole("button", { name: "Demo-Daten anlegen" }).click();
  await expect(page.getByText(/Demo-Daten angelegt: \d+ Termine/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Demo-Daten aktiv")).toBeVisible();
  // Live-Schalter ist gesperrt, solange Demo-Daten existieren
  await expect(page.getByRole("switch", { name: /Website-Buchung live/ })).toBeDisabled();

  // Der Sprachkanal sagt hier, ob er eingerichtet ist – im Testlauf ist kein
  // OPENAI_API_KEY gesetzt. Die Ärztin sieht den Zustand ohne Technik; den
  // konkreten nächsten Schritt sieht die Administration (letzte Prüfungen).
  await expect(page.getByText("Sprechen statt tippen: nicht eingerichtet")).toBeVisible();
  await expect(page.getByText(/das übernimmt die Administration/)).toBeVisible();
  await expect(page.getByText(/OPENAI_API_KEY/)).toHaveCount(0);

  // Screenshots hell + dunkel, Desktop + Mobil
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/heute-hell.png" });
  await page.goto(`/termine?v=woche&d=${date}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/woche-hell.png" });
  await page.evaluate(() => {
    localStorage.setItem("cockpit-theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/heute-dunkel.png" });
  await page.goto("/einstellungen");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/terminarten-dunkel.png" });
  await page.evaluate(() => {
    localStorage.removeItem("cockpit-theme");
    document.documentElement.removeAttribute("data-theme");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/heute-mobil.png" });
  await page.goto(`/termine?v=tag&d=${date}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/tag-mobil.png" });

  // Abmelden
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /Erika Musterfrau/ }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("Anmeldung mit Passwort verlangt den zweiten Faktor", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill("empfang@example.invalid");
  await page.getByLabel("Passwort").fill("Sehr-sicheres-Passwort-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Code aus der App" })).toBeVisible();
  const code = page.getByLabel("6-stelliger Code");
  await expect(code).toBeFocused();
  // Sechs Ziffern prüfen sich ohne Klick; ein falscher Code leert das Feld für den nächsten Versuch
  await code.fill("000000");
  // Next dev hat einen eigenen Routen-Ansager mit role=alert – gezielt auf unsere Meldung filtern
  await expect(page.getByRole("alert").filter({ hasText: "nicht gültig" })).toBeVisible();
  await expect(code).toHaveValue("");
  await expect(code).toBeFocused();
  await code.fill(totp(totpSecret));
  await expect(page.getByText(/Termine heute/)).toBeVisible();
  await page.screenshot({ path: "e2e/shots/login-2fa-ok.png" });
});

test("Ohne Sitzung wird auf die Anmeldung umgeleitet; Login-Seite ist barrierefrei", async ({ page }) => {
  await page.goto("/termine");
  await expect(page).toHaveURL(/\/login\?weiter=%2Ftermine/);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/shots/login.png" });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
});

test("Rückruf aus dem Chat erscheint im Posteingang und lässt sich abschließen", async ({ page, request }) => {
  test.setTimeout(180_000);
  // Eine Rückrufbitte auf demselben Weg wie eine Patientin: über den Chat.
  const sessionId = "00000000-0000-4000-8000-0000000000ff";
  const erste = await request.post("/api/public/v1/chat", {
    data: { v: 1, sessionId, state: null, message: "Ich möchte mit einem Menschen sprechen" },
    headers: { Origin: "http://localhost:3000" },
  });
  expect(erste.ok(), await erste.text()).toBeTruthy();
  const nachFrage = await request.post("/api/public/v1/chat", {
    data: { v: 1, sessionId, state: (await erste.json()).state, action: { kind: "quick", id: "callback" } },
    headers: { Origin: "http://localhost:3000" },
  });
  const gesendet = await request.post("/api/public/v1/chat", {
    data: {
      v: 1,
      sessionId,
      state: (await nachFrage.json()).state,
      action: {
        kind: "form",
        formId: "callback",
        values: { kind: "rueckruf", firstName: "Paula", lastName: "Posteingang", phone: "040 99 88 77", preferredTime: "nachmittags" },
      },
    },
    headers: { Origin: "http://localhost:3000" },
  });
  const ref = ((await gesendet.json()) as { reply: string }).reply.match(/AN-[A-Z0-9]{4}/)?.[0];
  expect(ref, "Referenz der Rückrufbitte").toBeTruthy();

  // Anmelden wie das Team und nachsehen
  await page.goto("/login");
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill("empfang@example.invalid");
  await page.getByLabel("Passwort").fill("Sehr-sicheres-Passwort-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  // Ein einmal benutzter Code gilt nicht erneut, und der vorige Test hat
  // gerade einen verbraucht. Deshalb das nächste Zeitfenster abwarten –
  // höchstens 31 Sekunden, dafür ohne Rateversuche.
  await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  await page.getByLabel("6-stelliger Code").fill(totp(totpSecret));
  await expect(page.getByText(/Termine heute/)).toBeVisible({ timeout: 20_000 });

  await page.goto("/anfragen");
  await expect(page.getByRole("heading", { name: "Anfragen" })).toBeVisible();
  const zeile = page.getByRole("row").filter({ hasText: "Paula Posteingang" });
  await expect(zeile).toBeVisible();
  await expect(zeile).toContainText("Rückruf");
  await expect(zeile).toContainText("040 99 88 77");
  await page.screenshot({ path: "e2e/shots/anfragen.png" });

  await zeile.click();
  await expect(page.getByText(`${ref} · Chat`)).toBeVisible();
  await expect(page.getByText("nachmittags")).toBeVisible();
  await page.getByRole("button", { name: "Erledigt", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Paula Posteingang" })).toHaveCount(0);
});

// ---------- Praxisalltag: Fehler, die Patient:innen oder Daten treffen ----------
// Eine Anmeldung für alle folgenden Prüfungen (der zweite Faktor gilt je Zeitfenster nur einmal).

let teamState: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;
const TEAM = { email: "empfang@example.invalid", password: "Sehr-sicheres-Passwort-1" };

async function e2e(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.post("/api/internal/e2e", { data: { secret: process.env.E2E_SECRET, ...body } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

function outbox(): Array<{ to: string; subject: string; text: string }> {
  if (!existsSync(MAIL_OUTBOX_DIR)) return [];
  return readdirSync(MAIL_OUTBOX_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(MAIL_OUTBOX_DIR, f), "utf8")));
}

/** Übernächster Werktag – weit genug weg vom Termin der ersten Prüfung. */
function workday(): string {
  const d = new Date();
  let n = 0;
  while (n < 2) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return d.toISOString().slice(0, 10);
}
const DAY = workday();

/** Passwort + Code aus der App; wartet aufs nächste Zeitfenster, weil jeder Code nur einmal gilt. */
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(TEAM.email);
  await page.getByLabel("Passwort").fill(TEAM.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  await page.getByLabel("6-stelliger Code").fill(totp(totpSecret));
}

async function teamPage(browser: Browser) {
  const context = await browser.newContext({ storageState: teamState, viewport: { width: 1366, height: 900 } });
  return { context, page: await context.newPage() };
}

/** Termin von Hand anlegen (wie am Telefon), zur ersten freien Zeit, die das Fenster anbietet. */
async function createByHand(page: Page, v: { first: string; last: string; email?: string }) {
  await page.goto(`/termine?d=${DAY}`);
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  const drawer = page.getByRole("dialog", { name: "Termin anlegen" });
  await expect(drawer.getByLabel("Vorname", { exact: true })).toBeFocused();
  await drawer.getByLabel("Datum", { exact: true }).fill(DAY);
  // Die Leiste „Nächste freie Zeiten“ lädt ab dem eingetragenen Tag neu
  await expect(drawer.getByText("Freie Zeiten werden geladen …")).toHaveCount(0);
  await drawer.getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  await drawer.getByLabel("Vorname", { exact: true }).fill(v.first);
  await drawer.getByLabel("Nachname", { exact: true }).fill(v.last);
  await drawer.getByLabel("Telefon", { exact: true }).fill("040 000 0000");
  if (v.email) await drawer.getByLabel("E-Mail", { exact: true }).fill(v.email);
  await drawer.getByRole("button", { name: /^(Trotzdem anlegen|Anlegen)$/ }).click();
  const retry = drawer.getByRole("button", { name: "Trotzdem anlegen" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();
}

async function openAppointment(page: Page, name: string) {
  await page.goto(`/termine?d=${DAY}`);
  await page.locator("[data-appt]").filter({ hasText: name }).click();
  const drawer = page.getByRole("dialog", { name: new RegExp(name) });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("Team meldet sich für die Alltagsprüfungen an", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await expect(page.getByText(/Termine heute/)).toBeVisible({ timeout: 20_000 });
  teamState = await context.storageState();
  await context.close();
});

test("Posteingang: offene Anfragen bleiben sichtbar – auch nach 320 erledigten", async ({ browser, request }) => {
  const seeded = await e2e(request, { action: "requests", closed: 320, open: ["Olga", "Oskar"] });
  expect(seeded.closed).toBe(320);
  const { context, page } = await teamPage(browser);
  await page.goto("/anfragen");
  await expect(page.getByRole("row").filter({ hasText: "Olga Offen" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Oskar Offen" })).toBeVisible();
  await expect(page.getByText("Keine offenen Anfragen")).toHaveCount(0);
  await context.close();
});

test("Absage fragt, wer absagt – und die Mail sagt es richtig", async ({ browser, request }) => {
  const { context, page } = await teamPage(browser);
  await createByHand(page, { first: "Anna", last: "Absage", email: "anna.absage@example.invalid" });
  const drawer = await openAppointment(page, "Absage, Anna");
  await drawer.getByRole("button", { name: "Absagen" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Termin absagen?" });
  await expect(dialog.getByRole("radio", { name: "Patient:in (telefonisch)" })).toBeChecked();
  await expect(dialog).toContainText("Sie haben Ihren Termin abgesagt");
  await dialog.getByRole("radio", { name: "Praxis" }).check();
  await expect(dialog).toContainText("Die Praxis musste Ihren Termin leider absagen");
  await dialog.getByRole("radio", { name: "Patient:in (telefonisch)" }).check();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await dialog.getByRole("button", { name: "Absagen" }).click();
  await expect(dialog).toBeHidden();
  await context.close();

  await e2e(request, { action: "tick" });
  const mail = outbox().filter((m) => m.to === "anna.absage@example.invalid").find((m) => m.subject.startsWith("Termin abgesagt"));
  expect(mail, "Absage-Mail").toBeTruthy();
  expect(mail!.text).toContain("Sie haben Ihren Termin abgesagt");
  expect(mail!.text).not.toContain("Die Praxis musste");
});

test("Termin-Fenster: Eingaben bleiben beim erneuten Senden, Verwerfen nur nach Rückfrage", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await createByHand(page, { first: "Berta", last: "Bleibt", email: "berta.bleibt@example.invalid" });
  const drawer = await openAppointment(page, "Bleibt, Berta");
  const note = drawer.getByLabel("Interne Notiz");
  await note.fill("Rückruf vor dem Termin");
  await drawer.getByRole("button", { name: /Bestätigung (erneut )?senden/ }).click();
  await expect(page.getByText("Bestätigung verschickt")).toBeVisible();
  // Früher setzte die Neuberechnung nach dem Senden das Formular zurück
  await page.waitForLoadState("networkidle");
  await expect(note, "die Notiz überlebt das erneute Senden").toHaveValue("Rückruf vor dem Termin");

  await page.keyboard.press("Escape");
  const discard = page.getByRole("alertdialog", { name: "Eingaben verwerfen?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Abbrechen" }).click();
  await expect(note).toHaveValue("Rückruf vor dem Termin");
  // Der Knopf unten (oben im Kopf gibt es dasselbe als ×)
  await drawer.getByRole("button", { name: "Schließen" }).last().click();
  await discard.getByRole("button", { name: "Verwerfen" }).click();
  await expect(drawer).toBeHidden();
  await context.close();
});

test("Erledigter Termin ist nur lesbar – weiter geht es mit „Folgetermin anlegen“", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await createByHand(page, { first: "Carla", last: "Fertig" });
  await (await openAppointment(page, "Fertig, Carla")).getByRole("button", { name: "Wahrgenommen" }).click();
  await expect(page.getByText("Carla Fertig: Wahrgenommen")).toBeVisible();
  const drawer = await openAppointment(page, "Fertig, Carla");
  await expect(drawer.getByLabel("Datum", { exact: true })).toBeDisabled();
  await expect(drawer.getByLabel("Uhrzeit", { exact: true })).toBeDisabled();
  await expect(drawer.getByText("Nicht änderbar – bitte Folgetermin anlegen")).toBeVisible();
  await drawer.getByRole("button", { name: "Folgetermin anlegen" }).click();
  const follow = page.getByRole("dialog", { name: "Termin anlegen" });
  await expect(follow.getByLabel("Vorname", { exact: true })).toHaveValue("Carla");
  await expect(follow.getByLabel("Nachname", { exact: true })).toHaveValue("Fertig");
  await context.close();
});

/** Uhrzeit des Telefontermins aus dem nächsten Test – für Suche und Überschneidung */
let phoneBooked = { time: "" };

test("Telefonbuchung nur mit Tastatur: „n“, die erste freie Zeit steht schon da, drei Felder, Enter", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await page.goto(`/termine?v=woche&d=${DAY}`);
  await page.keyboard.press("n");
  const drawer = page.getByRole("dialog", { name: "Termin anlegen" });
  await expect(drawer.getByLabel("Vorname", { exact: true })).toBeFocused();
  // Vorausgewählt: die erste freie Zeit ab dem angezeigten Tag – ohne Vorlauf der Website
  const chosen = drawer.getByRole("button", { pressed: true, name: /^\d\d:\d\d$/ });
  await expect(chosen).toHaveCount(1);
  phoneBooked = { time: (await chosen.textContent())!.trim() };
  await expect(drawer.getByLabel("Datum", { exact: true })).toHaveValue(DAY);
  await expect(drawer.getByLabel("Uhrzeit", { exact: true })).toHaveValue(phoneBooked.time);
  await page.keyboard.type("Dora");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Direkt");
  await page.keyboard.press("Tab");
  await page.keyboard.type("040 111 2222");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();
  await expect(drawer).toBeHidden();
  // Ansicht und Tag bleiben, wie sie waren
  await expect(page).toHaveURL(new RegExp(`/termine\\?v=woche&d=${DAY}$`));
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await context.close();
});

test("Suche: Name in beliebiger Reihenfolge, Telefon und Referenz öffnen den Termin an seinem Tag", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "Suchen oder springen" });
  await box.fill("direkt dora");
  const hit = page.getByRole("option", { name: /Direkt, Dora/ });
  await expect(hit).toBeVisible();
  await expect(box).toHaveAttribute("aria-activedescendant", (await hit.getAttribute("id"))!);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/termine\?id=/);
  const drawer = page.getByRole("dialog", { name: /Direkt, Dora/ });
  await expect(drawer).toBeVisible();
  const ref = (await drawer.getByText(/^PE-/).first().textContent())!.match(/PE-[A-Z0-9]+/)![0];
  // Solange das Fenster offen ist, ruhen die Kürzel
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: "Suchen oder springen" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  for (const query of ["+49 40 1112222", ref.toLowerCase()]) {
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Suchen oder springen" }).fill(query);
    await expect(page.getByRole("option", { name: /Direkt, Dora/ }), query).toBeVisible();
    await page.keyboard.press("Escape");
  }
  // Ein einzelnes Wort reicht für die Namenssuche nicht – das sagt die Palette
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Suchen oder springen" }).fill("Direkt");
  await expect(page.getByText("Für die Namenssuche bitte Nachname und Vorname eingeben, z. B. „Müller Anna“.")).toBeVisible();
  await context.close();
});

test("Überschneidung: Das Fenster nennt die nächsten freien Zeiten – Ladefehler stehen da, mit neuem Versuch", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await page.goto(`/termine?d=${DAY}`);
  // Erst ein Ladefehler der Leiste: Server-Aktionen blockiert
  await page.route("**/termine**", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.continue()));
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  const drawer = page.getByRole("dialog", { name: "Termin anlegen" });
  await expect(drawer.getByText("Die freien Zeiten konnten gerade nicht geladen werden.")).toBeVisible();
  await page.unroute("**/termine**");
  await drawer.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(drawer.getByRole("button", { pressed: true, name: /^\d\d:\d\d$/ })).toHaveCount(1);

  // Derselbe Platz wie „Dora Direkt“: belegt – darunter die drei nächsten freien Zeiten
  await drawer.getByLabel("Datum", { exact: true }).fill(DAY);
  await drawer.getByLabel("Uhrzeit", { exact: true }).fill(phoneBooked.time);
  await drawer.getByLabel("Vorname", { exact: true }).fill("Emil");
  await drawer.getByLabel("Nachname", { exact: true }).fill("Eng");
  await drawer.getByLabel("Nachname", { exact: true }).press("Enter");
  await expect(drawer.getByText("Der Zeitraum ist bereits belegt.")).toBeVisible();
  const suggestions = drawer.getByRole("button", { name: /^\w\w\.?, \d\d\.\d\d\. \d\d:\d\d$/ });
  await expect(suggestions).toHaveCount(3);
  const pickedLabel = (await suggestions.first().textContent())!;
  await suggestions.first().click();
  await expect(drawer.getByLabel("Uhrzeit", { exact: true })).toHaveValue(pickedLabel.slice(-5));
  await drawer.getByRole("button", { name: /^(Trotzdem anlegen|Anlegen)$/ }).click();
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();

  // Pflichtfelder: Der Fehler steht am Feld, der Fokus geht hin
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  await drawer.getByLabel("Vorname", { exact: true }).press("Enter");
  await expect(drawer.getByText("Vorname fehlt")).toBeVisible();
  await expect(drawer.getByText("Nachname fehlt")).toBeVisible();
  await expect(drawer.getByLabel("Vorname", { exact: true })).toBeFocused();
  await context.close();
});

test("Urlaub über gebuchte Termine: erst die Liste, dann „Trotzdem eintragen“ – Entfernen nur mit Rückfrage", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await page.goto(`/termine?d=${DAY}`);
  await page.getByRole("button", { name: "Blocker / Urlaub" }).click();
  const drawer = page.getByRole("dialog", { name: "Blocker oder Urlaub eintragen" });
  await drawer.getByLabel("Art").selectOption("urlaub");
  await drawer.getByLabel("Von").fill(DAY);
  await drawer.getByLabel("Bis", { exact: true }).first().fill(DAY);
  await drawer.getByLabel("Bezeichnung (optional)").fill("Probeurlaub");
  await drawer.getByRole("button", { name: "Eintragen" }).click();
  await expect(drawer.getByText(/gebuchter? Termine? (liegt|liegen) in diesem Zeitraum/)).toBeVisible();
  await expect(drawer.getByText(/Bleibt, Berta|Berta Bleibt/)).toBeVisible();
  await drawer.getByRole("button", { name: "Trotzdem eintragen" }).click();
  await expect(drawer).toBeHidden();

  await page.getByRole("button", { name: /Urlaub · Probeurlaub/ }).first().click();
  const confirm = page.getByRole("alertdialog", { name: "Urlaub · Probeurlaub entfernen?" });
  await expect(confirm).toContainText("Die Tage werden wieder online buchbar.");
  await confirm.getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByText("Urlaub entfernt")).toBeVisible();
  await context.close();
});

test("Erinnerungen: Tippfehler werden am Feld gemeldet, statt still alle abzuschalten", async ({ browser }) => {
  const { context, page } = await teamPage(browser);
  await page.goto("/einstellungen/demo");
  const field = page.getByLabel("Erinnerungen (Stunden vorher)");
  await field.fill("zwei Tage");
  await field.blur();
  await expect(page.getByText("Bitte Stunden als Zahlen angeben, z. B. 48, 24")).toBeVisible();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(field).toBeFocused();
  await expect(page.getByText("Einstellungen gespeichert")).toHaveCount(0);

  await field.fill("48h, 24 Std.");
  await expect(page.getByText("Bitte Stunden als Zahlen angeben, z. B. 48, 24")).toHaveCount(0);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Einstellungen gespeichert")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Erinnerungen (Stunden vorher)")).toHaveValue("48, 24");
  await context.close();
});

test("Abmeldung mit Ausweg: Hinweis vorher, danach „Neu anmelden“ im neuen Tab – die Eingaben bleiben", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const { context, page } = await teamPage(browser);
  await page.goto(`/termine?d=${DAY}`);
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  const drawer = page.getByRole("dialog", { name: "Termin anlegen" });
  await drawer.getByLabel("Vorname", { exact: true }).fill("Dora");
  const check = () => page.evaluate(() => window.dispatchEvent(new Event("cockpit:session-check")));

  // Arbeiten verlängert die Anmeldung: Eine Aktion (hier: freie Zeiten laden)
  // nach Ablauf des 60-s-Zwischenspeichers schiebt das Ende wieder eine Stunde hinaus
  await e2e(request, { action: "session-expires", email: TEAM.email, minutes: 4 });
  await page.waitForTimeout(61_000);
  const other = new Date(`${DAY}T12:00:00Z`);
  other.setUTCDate(other.getUTCDate() + 7);
  await drawer.getByLabel("Datum", { exact: true }).fill(other.toISOString().slice(0, 10));
  await expect(drawer.getByText("Nächste freie Zeiten")).toBeVisible();
  await expect(drawer.getByText("Freie Zeiten werden geladen …")).toHaveCount(0);
  await check();
  await page.waitForTimeout(1_500);
  await expect(page.getByText("Gleich werden Sie abgemeldet")).toBeHidden();

  // Noch vier Minuten: Hinweis mit „Angemeldet bleiben“ – bedienbar, obwohl der Drawer offen ist
  await e2e(request, { action: "session-expires", email: TEAM.email, minutes: 4 });
  await check();
  await expect(page.getByText("Gleich werden Sie abgemeldet")).toBeVisible();
  await page.getByRole("button", { name: "Angemeldet bleiben" }).click();
  await expect(page.getByText("Gleich werden Sie abgemeldet")).toBeHidden();

  // Abgelaufen: „Neu anmelden“ öffnet einen neuen Tab mit Rücksprung, hier bleibt alles stehen
  await e2e(request, { action: "session-expires", email: TEAM.email, minutes: -1 });
  await check();
  await expect(page.getByText("Sie wurden abgemeldet")).toBeVisible();
  const relogin = page.getByRole("link", { name: /Neu anmelden/ });
  await expect(relogin).toHaveAttribute("target", "_blank");
  await expect(relogin).toHaveAttribute("href", `/login?weiter=${encodeURIComponent(`/termine?d=${DAY}`)}`);
  await expect(drawer.getByLabel("Vorname", { exact: true })).toHaveValue("Dora");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);

  const [tab] = await Promise.all([context.waitForEvent("page"), relogin.click()]);
  await tab.waitForLoadState();
  await expect(tab.getByRole("button", { name: "Mit Passwort anmelden" })).toBeVisible();
  await tab.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await tab.getByLabel("E-Mail-Adresse").fill(TEAM.email);
  await tab.getByLabel("Passwort").fill(TEAM.password);
  await tab.getByRole("button", { name: "Anmelden" }).click();
  // Ein Gerät gilt nur als vertraut, wenn beim zweiten Faktor „Diesem Gerät
  // vertrauen“ angekreuzt war – dann fragt die Anmeldung nicht nach dem Code
  const target = new RegExp(`/termine\\?d=${DAY}`);
  const code = tab.getByLabel("6-stelliger Code");
  const step = await Promise.race([
    tab.waitForURL(target, { timeout: 30_000 }).then(() => "zurück" as const, () => null),
    code.waitFor({ timeout: 30_000 }).then(() => "code" as const, () => null),
  ]);
  expect(step, "Anmeldung kommt weiter").toBeTruthy();
  if (step === "code") {
    await tab.waitForTimeout(31_000 - (Date.now() % 30_000));
    await code.fill(totp(totpSecret));
  }
  await expect(tab).toHaveURL(target, { timeout: 20_000 });

  // Zurück im ersten Tab: Der Hinweis verschwindet, die Eingabe ist noch da und lässt sich speichern
  await page.bringToFront();
  await check();
  await expect(page.getByText("Sie wurden abgemeldet")).toBeHidden();
  await expect(page.getByText("Wieder angemeldet")).toBeVisible();
  await drawer.getByLabel("Datum", { exact: true }).fill(DAY);
  await expect(drawer.getByText("Freie Zeiten werden geladen …")).toHaveCount(0);
  await drawer.getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  await drawer.getByLabel("Nachname", { exact: true }).fill("Dranbleiben");
  await drawer.getByLabel("Telefon", { exact: true }).fill("040 000 0000");
  await drawer.getByRole("button", { name: /^(Trotzdem anlegen|Anlegen)$/ }).click();
  const retry = drawer.getByRole("button", { name: "Trotzdem anlegen" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();
  await context.close();
});

// ---------- Anmeldung und Zugang – nur mit Test-Konten, nie mit dem echten Admin ----------

const KONTO = { email: "konto-test@example.invalid", name: "Konto Test", password: "Erstes-Test-Passwort-1", next: "Zweites-Test-Passwort-2" };
const LEITUNG = { email: "leitung-test@example.invalid", name: "Leitung Test", password: "Sehr-sicheres-Passwort-1" };

/** Einladung annehmen, Passkey (virtuell) und App einrichten – mit „Ich habe sie gespeichert“. */
async function newAccount(page: Page, request: APIRequestContext, who: { email: string; name: string; password: string }, role: "empfang" | "admin") {
  await virtualAuthenticator(page);
  const { inviteLink } = (await e2e(request, { inviteEmail: who.email, role })) as { inviteLink: string };
  await page.goto(inviteLink);
  await page.getByLabel("Vollständiger Name").fill(who.name);
  await page.getByLabel("Passwort (mindestens 12 Zeichen)").fill(who.password);
  await page.getByLabel("Passwort wiederholen").fill(who.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("button", { name: /Passkey jetzt anlegen/ })).toBeFocused({ timeout: 30_000 });
  await page.getByRole("button", { name: /Passkey jetzt anlegen/ }).click();
  await page.getByLabel("Passwort").fill(who.password);
  await page.getByRole("button", { name: "QR-Code anzeigen" }).click();
  await expect(page.getByLabel("Code aus der App")).toBeFocused();
  await page.getByText("Code manuell eingeben").click();
  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  await page.getByLabel("Code aus der App").fill(totp(secret));
  await page.getByLabel("Ich habe sie gespeichert").check();
  await page.getByRole("button", { name: /Aktivieren und ins Cockpit/ }).click();
  await expect(page.getByText(/Termine heute/)).toBeVisible({ timeout: 45_000 });
}

test("Zugang: Passwort ändern, neue Backup-Codes – und nach der Anmeldung zurück zur vollen Adresse", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  await newAccount(page, request, KONTO, "empfang");

  // Passwort ändern: geprüft am Feld, bestätigt mit dem bisherigen
  await page.goto("/einstellungen/sicherheit");
  await page.getByRole("button", { name: "Passwort ändern" }).click();
  const pw = page.getByRole("dialog", { name: "Passwort ändern" });
  await expect(pw.getByLabel("Bisheriges Passwort")).toBeFocused();
  await pw.getByLabel("Bisheriges Passwort").fill("Falsches-Passwort-123");
  await pw.getByLabel("Neues Passwort", { exact: true }).fill(KONTO.next);
  await pw.getByLabel("Neues Passwort wiederholen").fill(`${KONTO.next}!`);
  await pw.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(pw.getByText("Die beiden neuen Passwörter sind nicht gleich.")).toBeVisible();
  await pw.getByLabel("Neues Passwort wiederholen").fill(KONTO.next);
  await pw.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(pw.getByText("Das bisherige Passwort stimmt nicht.")).toBeVisible();
  await pw.getByLabel("Bisheriges Passwort").fill(KONTO.password);
  await pw.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(page.getByText("Passwort geändert")).toBeVisible();
  await expect(pw).toHaveCount(0);

  // Neue Backup-Codes: erst nach „Ich habe sie gespeichert“ fertig
  await page.getByRole("button", { name: "Neue Backup-Codes" }).click();
  const bc = page.getByRole("dialog", { name: "Neue Backup-Codes" });
  await bc.getByLabel("Passwort").fill(KONTO.next);
  await bc.getByRole("button", { name: "Neue Codes erzeugen" }).click();
  await expect(bc.locator("li")).toHaveCount(10);
  const backupCode = (await bc.locator("li").first().textContent())?.trim() ?? "";
  await bc.getByRole("button", { name: "Kopieren" }).click();
  await expect(bc.getByText("Kopiert.")).toBeVisible();
  await bc.getByRole("button", { name: "Fertig" }).click();
  await expect(bc.getByText("Bitte die Codes zuerst sichern und ankreuzen.")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations, JSON.stringify(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`))).toEqual([]);
  await bc.getByLabel("Ich habe sie gespeichert").check();
  await bc.getByRole("button", { name: "Fertig" }).click();
  await expect(bc).toHaveCount(0);

  // Abgemeldet auf eine Wochenansicht: Nach der Anmeldung – neues Passwort, neuer Backup-Code – genau dorthin
  await page.getByRole("button", { name: /Konto Test/ }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
  const deep = `/termine?v=woche&d=${DAY}`;
  await page.goto(deep);
  await expect(page).toHaveURL(`/login?weiter=${encodeURIComponent(deep)}`);
  await expect(page.getByRole("button", { name: "Mit Passkey anmelden" })).toBeFocused();
  await expect(page.getByText("Zugang verloren? Bitte an die Praxisleitung wenden.")).toBeVisible();
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await expect(page.getByLabel("E-Mail-Adresse")).toBeFocused();
  await page.getByLabel("E-Mail-Adresse").fill(KONTO.email);
  await page.getByLabel("Passwort").fill(KONTO.next);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("button", { name: /Backup-Code verwenden/ }).click();
  await page.getByLabel("Einer Ihrer Backup-Codes").fill(backupCode);
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(deep);
  await context.close();
});

test("Administration: „Sicherheit zurücksetzen“ nur mit frischer Anmeldung – danach richtet die Person alles neu ein", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await newAccount(page, request, LEITUNG, "admin");

  // Die Administration sieht beim Sprachkanal den konkreten nächsten Schritt
  await page.goto("/einstellungen/demo");
  await expect(page.getByText("Sprechen statt tippen: nicht eingerichtet")).toBeVisible();
  await expect(page.getByText(/OPENAI_API_KEY/)).toBeVisible();
  await expect(page.getByText(/neu deployen/)).toBeVisible();

  // Anmeldung älter als 10 Minuten: erst fragen, dann zurück an dieselbe Stelle
  await e2e(request, { action: "session-age", email: LEITUNG.email, minutes: 11 });
  await context.clearCookies({ name: /session_data/ });
  await page.goto("/einstellungen/benutzer");
  const row = page.getByRole("row").filter({ hasText: KONTO.email });
  await row.getByRole("button", { name: "Sicherheit zurücksetzen" }).click();
  const fresh = page.getByRole("alertdialog", { name: "Bitte kurz neu anmelden" });
  await expect(fresh).toBeVisible();
  await fresh.getByRole("button", { name: "Jetzt neu anmelden" }).click();
  await expect(page).toHaveURL("/login?grund=frisch&weiter=%2Feinstellungen%2Fbenutzer");
  await expect(page.getByText(/frische Anmeldung nötig/)).toBeVisible();
  await page.getByRole("button", { name: "Mit Passkey anmelden" }).click();
  await expect(page).toHaveURL("/einstellungen/benutzer");

  await row.getByRole("button", { name: "Sicherheit zurücksetzen" }).click();
  const confirm = page.getByRole("alertdialog", { name: `Sicherheit von ${KONTO.name} zurücksetzen?` });
  await expect(confirm).toContainText("Das Passwort bleibt");
  await confirm.getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(page.getByText(`${KONTO.name}: Sicherheit zurückgesetzt`)).toBeVisible();
  await expect(row).toContainText("Einrichtung offen");
  await context.close();

  // Die Person meldet sich mit ihrem Passwort an: kein Code mehr, sofort die Einrichtung
  const k = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const kp = await k.newPage();
  await kp.goto("/login");
  await kp.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await kp.getByLabel("E-Mail-Adresse").fill(KONTO.email);
  await kp.getByLabel("Passwort").fill(KONTO.next);
  await kp.getByRole("button", { name: "Anmelden" }).click();
  await expect(kp).toHaveURL("/sicherheit/einrichten");
  await expect(kp.getByRole("heading", { name: "Passkey anlegen" })).toBeVisible();
  await k.close();
});
