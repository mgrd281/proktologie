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
  await expect(page.getByRole("dialog", { name: "Befehle" })).toBeVisible();
  await page.getByLabel("Befehl suchen").fill("Termine");
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
  // OPENAI_API_KEY gesetzt, also muss genau der Zustand stehen, in dem der
  // Betreiber steckte: aus, mit dem konkreten nächsten Schritt daneben.
  await expect(page.getByText("Sprechen statt tippen: nicht eingerichtet")).toBeVisible();
  await expect(page.getByText(/OPENAI_API_KEY/)).toBeVisible();
  await expect(page.getByText(/neu deployen/)).toBeVisible();

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
  await page.getByLabel("6-stelliger Code").fill("000000");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  // Next dev hat einen eigenen Routen-Ansager mit role=alert – gezielt auf unsere Meldung filtern
  await expect(page.getByRole("alert").filter({ hasText: "nicht gültig" })).toBeVisible();
  await page.getByLabel("6-stelliger Code").fill(totp(totpSecret));
  await page.getByRole("button", { name: "Bestätigen" }).click();
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
  await page.getByRole("button", { name: "Bestätigen" }).click();
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
  await page.getByRole("button", { name: "Bestätigen" }).click();
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
  await expect(drawer.getByText(/^Frei am /)).toBeVisible();
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
  test.setTimeout(180_000);
  const { context, page } = await teamPage(browser);
  await page.goto(`/termine?d=${DAY}`);
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  const drawer = page.getByRole("dialog", { name: "Termin anlegen" });
  await drawer.getByLabel("Vorname", { exact: true }).fill("Dora");
  const check = () => page.evaluate(() => window.dispatchEvent(new Event("cockpit:session-check")));

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
  await tab.waitForTimeout(31_000 - (Date.now() % 30_000));
  await tab.getByLabel("6-stelliger Code").fill(totp(totpSecret));
  await tab.getByRole("button", { name: "Bestätigen" }).click();
  await expect(tab).toHaveURL(new RegExp(`/termine\\?d=${DAY}`), { timeout: 20_000 });

  // Zurück im ersten Tab: Der Hinweis verschwindet, die Eingabe ist noch da und lässt sich speichern
  await page.bringToFront();
  await check();
  await expect(page.getByText("Sie wurden abgemeldet")).toBeHidden();
  await expect(page.getByText("Wieder angemeldet")).toBeVisible();
  await drawer.getByLabel("Datum", { exact: true }).fill(DAY);
  await drawer.getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  await drawer.getByLabel("Nachname", { exact: true }).fill("Dranbleiben");
  await drawer.getByLabel("Telefon", { exact: true }).fill("040 000 0000");
  await drawer.getByRole("button", { name: /^(Trotzdem anlegen|Anlegen)$/ }).click();
  const retry = drawer.getByRole("button", { name: "Trotzdem anlegen" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await expect(page.getByText(/Termin angelegt · PE-/)).toBeVisible();
  await context.close();
});
