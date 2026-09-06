import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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
