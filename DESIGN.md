---
name: Proktologie Eimsbüttel
description: Facharztpraxis für Proktologie in Hamburg – ruhig, diskret, präzise. Website (öffentlich) und Cockpit (Praxisteam).
colors:
  # Marke – identisch in app/globals.css und cockpit/app/tokens.css (Test erzwingt Gleichheit)
  primary: "#527a32"
  primary-deep: "#446628"
  accent: "#86bc23"
  deep: "#17251b"
  cream: "#f7f7f3"
  mist: "#eceee8"
  ink: "#202520"
  white: "#ffffff"
  # Cockpit – semantische Flächen, hell
  surface: "#f7f7f3"
  surface-raised: "#ffffff"
  surface-sunken: "#eceee8"
  text: "#202520"
  text-muted: "rgb(32 37 32 / 0.68)"
  text-faint: "rgb(32 37 32 / 0.64)"
  brand: "#446628"
  ok: "#446628"
  warn: "#b45309"
  danger: "#b91c1c"
  info: "#1d4ed8"
  # Cockpit – semantische Flächen, dunkel
  surface-dark: "#0f1611"
  surface-raised-dark: "#17221a"
  surface-sunken-dark: "#0b100d"
  text-dark: "#f7f7f3"
  brand-dark: "#a5d64a"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "2.25rem / 3.75rem (md)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "normal"
  section-title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem / 2.25rem (md) / 2.75rem (lg)"
    fontWeight: 500
    lineHeight: 1.2
  card-title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 500
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  small:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.625
  kicker:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.2em"
  cockpit-ui:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px – 15px"
    fontWeight: 500
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter-desktop: "32px"
  section-mobile: "64px"
  section-desktop: "128px"
  touch-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.deep}"
    rounded: "{rounded.full}"
    padding: "12px 28px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#76a81f"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "12px 28px"
    height: "44px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
    padding: "28px"
  input-website:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    height: "44px"
  input-cockpit:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    height: "44px"
  mobile-action-bar:
    backgroundColor: "{colors.cream}"
    height: "64px"
---

# Design System: Proktologie Eimsbüttel

> **Quelle der Wahrheit sind der Code und diese Datei.** Werte oben stammen aus
> `app/globals.css` (Website) und `cockpit/app/tokens.css` (Cockpit). Wer einen Wert ändert,
> ändert ihn dort **und** hier. Die Marke ist gesetzt: Kein Skill, keine Datenbank, kein
> Vorschlagsgenerator ersetzt Farben, Schriften oder Bildsprache ohne ausdrücklichen Auftrag.

## Overview

Eine Facharztpraxis für ein Thema, über das Menschen ungern sprechen. Die Gestaltung muss deshalb
**Ruhe, Diskretion und Kompetenz** ausstrahlen – nie Werbung, nie Spektakel, nie Kälte.
Leitbild: *Refined Minimalism* mit warmem Papierton (cream), tiefem Waldgrün (deep) als Gegengewicht
und einem einzigen lebendigen Klinikgrün (accent) als Handlungsfarbe.

Zwei Oberflächen, zwei Modi:

| Oberfläche | Modus | Ziel des Besuchers | Ort |
|---|---|---|---|
| **Website** proktologie.vercel.app | Persuade + Read | Vertrauen fassen, Termin buchen oder anrufen | Repo-Root (`app/`, `components/`) |
| **Cockpit** proktologie-cockpit.vercel.app | Operate | Termine, Anfragen, Warteliste zügig bearbeiten | `cockpit/` |

Die Website darf Atmosphäre zeigen (Kamerafahrt, Fotografie, Serifen-Typografie). Das Cockpit ist
ein Werkzeug: Dichte, Lesbarkeit und Tempo gehen vor Ausdruck; die Marke lebt dort in präzisen
Details (Grünton, Fraunces in Überschriften, Rundungen), nicht in Dekoration.

### Bildsprache & Fotografie
- **Nur echte Praxis:** Räume, Empfang, Flur, Untersuchungsraum, Porträt des Arztes, Teamfotos
  und die Bilder der Kamerafahrt (`public/images/`, `public/sequence/`; Austausch siehe
  `public/images/README.txt`). Keine Stockfotos, keine KI-generierten Personen oder Räume.
- **Nie:** Patientinnen/Patienten, anatomische Darstellungen, Untersuchungs- oder
  Behandlungsszenen am Menschen, Vorher-/Nachher-Bilder, Instrumente in Nahaufnahme.
- Personen nur mit deren Einverständnis und nur Praxisteam; Namen und Funktionen nur, wenn
  vom Betreiber bestätigt.
- Licht natürlich und ruhig; Verläufe nur als Leseschleier über Fotografie/Film.
  Bewegung im Bild: siehe `MOTION_SYSTEM.md`.
- Technik: WebP, feste Seitenverhältnisse (kein Layout-Springen), Alternativtext beschreibt den
  Raum sachlich („Empfang der Praxis"), dekorative Ebenen `alt=""`.

## Colors

### Primary
- **accent `#86bc23` (Klinikgrün):** die *eine* Handlungsfarbe. Primärbuttons, aktive Zustände,
  Markierungen auf dunklem Grund. **Auf hellen Flächen nur als Fläche mit dunkler Schrift (deep)**
  – als Text oder Icon auf hell hat es nur 2,3:1 und ist verboten.
- **primary `#527a32` / primary-deep `#446628`:** textsicheres Grün auf hell (Links, Kicker,
  Icons, Hover). primary-deep ist der Standard für Text.

### Neutral
- **cream `#f7f7f3`:** Seitengrund. **mist `#eceee8`:** abgesetzte Sektionen, Hinweisflächen.
  **white:** Karten und Formulare auf cream/mist.
- **ink `#202520`:** Text. Grautöne entstehen ausschließlich als Deckkraft von ink
  (`text-ink/70` usw.), nie als freies Grau. Untergrenze für Fließ- und Kleintext: **ink/70**
  (≥ 4,5:1). Darunter nur für rein dekorative, `aria-hidden` Elemente.
- **deep `#17251b`:** dunkle Sektionen, Fußzeile, Menü, Film-Bühne. Text darauf: cream mit
  ≥ 65 % Deckkraft für Fließtext.

### Cockpit-Semantik (hell / dunkel)
`surface`, `surface-raised`, `surface-sunken`, `line`, `line-strong`, `text`, `text-muted`,
`text-faint`, `brand`, `brand-fill`, `brand-soft`, `ok`, `warn`, `danger`, `info` – **immer über
diese Tokens**, nie über Rohwerte. Dunkelmodus über `data-theme="dark"` oder
`prefers-color-scheme`; jede neue Fläche braucht beide Fassungen. Im Dunkeln darf Grün Text sein
(`brand-dark #a5d64a`, ≥ 7:1).

### Named Rules
- **Ein Grün handelt.** Pro Ansicht genau eine primäre Handlung in accent. Termin-Knöpfe in
  den Abschnitten, „Karte laden“ und „Rückruf anfordern“ sind deshalb Outline – das Grün gehört
  dem Header bzw. der Handy-Leiste; deren „Termin“ tritt zurück (Rahmen), solange die
  Buchungskarte im Bild ist.
- **Status ist nie nur Farbe.** ok/warn/danger immer mit Wort oder Icon.
- **Keine Fremdpaletten.** Paletten aus UI/UX Pro Max dienen nur dem Vergleich, nie der Übernahme.

## Typography

- **Fraunces** (Display-Serife, `opsz`-Achse) für Überschriften und große Zahlen.
  **Inter** für alles, was gelesen und bedient wird. Diese Paarung ist Markenbestand und bleibt –
  auch wenn Design-Skills Inter grundsätzlich als „generisch" markieren.
- Website: H1 `text-4xl`→`md:text-6xl`, Sektionstitel `text-3xl`→`md:text-4xl`→`lg:text-[2.75rem]`
  (`SectionHeading`), Kartentitel `text-xl` Fraunces, Fließtext 16 px / `leading-relaxed`,
  Kleintext 14 px. **Kein Fließtext unter 14 px**, Hinweise minimal 12 px.
- Kicker: 12 px, `font-semibold`, `tracking-[0.2em]`, Versalien, primary-deep (hell) bzw. accent (dunkel).
- Cockpit: UI-Text 13–15 px Inter; Tabellen 13 px mit `.tnum` (Tabellenziffern); Dialogtitel
  Fraunces 20–22 px.
- Formularfelder auf dem Handy **≥ 16 px**, sonst zoomt iOS hinein.
- Zeilenlänge Fließtext ≤ ~70 Zeichen (`max-w-2xl`, `max-w-md`).

## Layout

- Container `mx-auto max-w-7xl`, Seitenrand **20 px (mobil) / 32 px (ab md)**.
- Sektionsabstand **`py-16` mobil, `md:py-32`**; Abstände nur aus der Tailwind-Skala, keine
  Zufallswerte.
- Breakpoints: Handy < 768 px (`md`), Tablet 768–1279, Desktop ≥ 1280 (`xl`: volle Navigation).
- **Mobile-Regeln (Website):**
  - Mobile Änderungen nur mit `max-md:`/Basisklassen + unveränderten `md:`-Klassen; Desktop und
    Tablet bleiben pixelgleich (per Screenshot-Vergleich prüfen).
  - Feste **Aktionsleiste** unten (Anrufen · Termin · Chat, 64 px + Safe-Area); kein weiteres
    schwebendes Element darüber.
  - Lange Kartenstapel werden **Wischreihen** (`components/ui/Swipe.tsx`, CSS-Scroll-Snap,
    Karte ≈ 84 % breit, nächste lugt hervor; `SwipeRow` ergänzt den Zähler „2 / 8“, mit Maus
    Pfeile und eine schmale Leiste, und ist nur fokussierbar, wo wirklich gescrollt wird).
    Karten darin erscheinen sofort (`Reveal swipe`). Rasterkinder, die eine Wischreihe
    enthalten, brauchen `min-w-0`. Bis vier Karten bleibt es eine Liste.
  - Kein waagrechtes Scrollen der Seite (`scrollWidth == clientWidth`).
  - Kamerafahrt mobil 500vh, Desktop 1000vh; Text darüber immer mit Leseschleier.
- Cockpit: Seitenleiste + Inhaltsfläche; Drawer von rechts für Details, zentrierter Dialog nur
  für Bestätigungen.

## Elevation & Depth

- Grundsatz: **flach.** Trennung über Flächenton (cream/white/mist) und `ring-1 ring-ink/5`
  bzw. `ring-line`, nicht über Schatten.
- Schatten nur für **schwebende Ebenen**: Drawer, Dialog, Befehlspalette, Toast (Cockpit-Klasse
  `.elevated`), Aktionsleiste (sehr weicher Schatten nach oben), Porträt/Buchungskarte auf der
  Website (ein weicher, tiefer Schatten). Nie mehrere Schattenebenen ineinander.
- Unschärfe (`backdrop-blur`) nur für fixierte Leisten (Header, Aktionsleiste) und
  Overlay-Hintergründe.

## Shapes

- Buttons, Chips, Icon-Knöpfe: **`rounded-full`**.
- Karten, Dialoge, Tabellenrahmen: **`rounded-2xl`** (16 px).
- Eingabefelder (Website-Buchung, Rückruf und Cockpit), Listeneinträge, Navigationspunkte:
  `rounded-xl` (12 px).
- Icons: eigene Linien-Icons (`components/ui/Icon.tsx`, 24er Raster, Strich 1,6, `currentColor`);
  keine Emoji, keine zweite Icon-Bibliothek.

## Components

### Buttons
Bestand: Website `components/ui/Button.tsx` (`primary`, `outline`, `outline-dark`, `ghost`),
Cockpit `cockpit/components/ui/Button.tsx` (`primary`, `secondary` = Standard, `ghost`, `danger`;
Größen `sm` 36 px nur in dichten Desktop-Tabellenzeilen, `md` 44 px).

| Eigenschaft | Regel |
|---|---|
| Höhe | 44 px (`min-h-11`), Ausnahme `sm` 36 px nur am Desktop in Tabellen |
| Form | `rounded-full`; Innenabstand Website `px-7`, Cockpit `px-6` (`sm`: `px-4`) |
| Schrift | Inter 14 px (`sm` 13 px), `font-medium`; primary `font-semibold` |
| Icon im Button | 16 px (Website-Pfeil 18 px), Abstand `gap-2` (Cockpit) / `gap-3` (Website); Pfeil rechts rückt beim Hover 2–4 px nach rechts |
| Hover | nur Farbwechsel, 200 ms (Cockpit) / 300 ms (Website); primary `#76a81f` |
| Gedrückt | `active:` eine Stufe dunkler als Hover, keine Skalierung über 0,98 |
| Fokus | globaler Ring 2 px, Abstand 3 px: primary auf hell, accent auf dunkel – nie entfernen |
| Deaktiviert | `opacity-50`, `cursor-not-allowed`, kein Hover; Grund steht daneben, wenn nicht offensichtlich |
| Lädt | Icon wird zum drehenden `refresh`, Button bleibt gleich breit, `disabled` während der Anfrage (Website: `loading` + `loadingLabel`, z. B. „Wird gebucht …“; dort `aria-disabled`, damit der Fokus stehen bleibt) |

Varianten und wofür:
1. **Primary** – genau eine Haupthandlung je Ansicht (accent-Fläche, deep-Text).
2. **Secondary / Outline** – Nebenhandlung; Rahmen `line-strong` bzw. `ink/25`.
3. **Ghost** – leise Handlungen in Listen, Kopfzeilen, Werkzeugleisten.
4. **Danger** – nur für Löschen/Absagen, immer mit Bestätigungsdialog.
5. **Icon-only** – nur mit `aria-label` und, wo nicht eindeutig, Tooltip; Tippfläche ≥ 44 px
   (Ausnahme: Desktop-Tabellen 36 px).
6. **Segmented Control** (noch nicht gebaut) – für 2–4 gleichrangige Ansichten (z. B. Tag/Woche);
   `role="radiogroup"`, gewählte Fläche `surface-raised`, Rest `surface-sunken`.
7. **Split Button** (noch nicht gebaut) – nur wenn eine Hauptaktion Varianten hat; Menüteil eigener
   Knopf mit `aria-haspopup`.
8. **Schwebender Knopf (FAB)** – nur die bestehende Handy-Aktionsleiste und der Desktop-Chat-Knopf;
   keine weiteren schwebenden Elemente.

Verboten: Leuchten/Glow, Verläufe auf Buttons, federnde Übertreibungen, Buttons ohne Text, deren
Symbol nicht sofort verständlich ist.

### Cards / Containers
- Karte = `rounded-2xl bg-white p-7 ring-1 ring-ink/5` (mobil `p-6`). **Keine Karte in einer
  Karte**, keine farbigen Randstreifen, Icon-Kreis nur wo er Bedeutung trägt.

### Inputs / Fields
- Sichtbares Label über dem Feld (nie nur Platzhalter), Fehler direkt unter dem Feld mit
  `role="alert"`, Pflichtfelder markiert, `autocomplete` gesetzt.
- Website-Buchungsfeld 44 px, `rounded-xl`, weiß; Cockpit `inputClass` (44 px, `rounded-xl`, 15 px).

### Navigation
- Website: transparenter Header über der Kamerafahrt, danach deckend `bg-cream/97` (Handy 64 px,
  ab md 80 px). In der ruhigen Fassung deckend ab dem Ende des dunklen Eröffnungsblocks
  (`data-header-dark`), auf Unterseiten schon im HTML; ohne JavaScript scrollt er auf der
  Startseite mit dem dunklen Block weg. Unter 1280 px Vollbild-Menü (deep, weich einblendend):
  „Termin vereinbaren“ und Telefon oben, darunter die Links in Fraunces 24 px; das Menü scrollt
  selbst (`data-lenis-prevent`). Das Telefon steht ab Tablet im Header (neben der vollen
  Navigation ab xl nur als Symbol, die Nummer im Tooltip). Der gerade gelesene Abschnitt ist in
  Header und Menü markiert (`aria-current`, `lib/hooks/useActiveSection.ts`).
- Sprünge: Anker landen über `scroll-padding-top` unter dem Header (Lenis rechnet ihn ein),
  der Fokus geht aufs Ziel; weite Sprünge (über die Kamerafahrt) ohne Fahrt. Sprunglinks
  „Zum Inhalt springen“ und auf der Startseite „Zur Terminbuchung“.
- Unbekannte Adressen: deutsche 404, Fehler: ruhige Fehlerseite – beide `NoticePage` (klare
  Aussage, Weg zum Termin bzw. „Seite neu laden“, Telefon).
- Cockpit: Seitenleiste mit 40 px hohen Einträgen, Befehlspalette (⌘K).

### Tables & Lists (Cockpit)
- `DataTable`: `rounded-2xl ring-1 ring-line`, Kopf klebend mit `surface-sunken/80` +
  Unschärfe, Zeilen durch `divide-line`, 13 px, Tabellenziffern. Leere Zustände sagen, was zu tun ist.

### Dialogs & Bottom Sheets
- Cockpit: Drawer rechts (`slide-in-right`), Bestätigungsdialog zentriert (`rise-in`,
  `max-w-md`), Hintergrund `deep/30–40` + `backdrop-blur-[2px]`, Fokusfalle, Esc schließt.
- Website-Chat: auf dem Handy (unter `sm`) echter Dialog als Bottom-Sheet (`max-h-[85dvh]`):
  Seite `deep/40` abgedunkelt und gesperrt, Tippen daneben schließt. Am Desktop schwebendes
  Fenster ohne Sperre. Der Rahmen steht sofort mit „Einen Moment …“, der Inhalt lädt nach;
  Eingabefelder auf dem Handy 16 px (kein Zoom unter iOS).
- Kopf-Knöpfe in Sheets/Dialogen ≥ 44 px.

### Icons
- **Ein Set pro App:** `components/ui/Icon.tsx` (Website) und `cockpit/components/ui/Icon.tsx`.
  24er-Raster, Linien 1,6, runde Enden, `currentColor`, `aria-hidden` – die Bedeutung trägt der
  Text oder das `aria-label` des Knopfes.
- **Neue Icons** als Pfaddaten aus **Lucide** (ISC-Lizenz) übernehmen und an Strichstärke 1,6
  anpassen – kein `lucide-react`, keine zweite Icon-Familie (Phosphor u. a.), keine Emoji.
- Größen: 16 px in Buttons/Tabellen, 20 px in Navigation und Aktionsleiste, 22–24 px in Karten.
- Ein Icon pro Bedeutung, projektweit gleich (Telefon = `phone`, Termin = `calendar`, Zeit = `clock`).

### Termin-UX (Website-Buchung und Cockpit)
- **Die Datenbank ist die Wahrheit:** Doppelbuchungen verhindert die EXCLUDE-Regel in
  `cockpit/drizzle/0001_constraints_and_seed.sql`, nicht das Frontend. Die Oberfläche zeigt
  Erfolg **erst nach der Antwort des Servers** und benennt den echten Status (Anfrage vs.
  gebucht vs. bestätigt).
- Zeiten immer in **Europe/Berlin**, Sommer-/Winterzeit über die Zeitzone, nie per Hand
  (Kalenderdateien: `cockpit/lib/ics.ts`).
- Ablauf in klaren Schritten (Terminart → Datum → Uhrzeit → Angaben → Bestätigung) mit
  Fortschritt „1 / 5"; Zurück jederzeit ohne Datenverlust – auch per Zurück-Geste des Handys
  (ein eigener Verlaufseintrag, solange die Buchung unterwegs ist).
- **Schnell zum Termin (verbindlicher Modus):** „Freie Termine ab …“ unter dem ersten
  Termin-Knopf der Fahrt; der Kalender öffnet im Monat des frühesten freien Tages, darüber
  „Frühester freier Tag: …“ als Abkürzung. Zeiten nach „Vormittag“/„Nachmittag“ gegliedert.
  Der Abschluss nennt Tag, Uhrzeit und Adresse, mit „In den Kalender“ (Datei aus dem Browser,
  neutraler Titel, UID wie die Mail-Einladung – `lib/booking/ics.ts`) und „Anfahrt“.
- Solange die Website nicht weiß, ob sie bucht oder nur anfragt (Antwort des Cockpits),
  bleiben Kartentitel und Modus-Hinweis unsichtbar – nie kurz das falsche Wort zeigen.
- **Handy:** Titel und Fortschritt stehen untereinander; der Modus-Hinweis nur im ersten
  Schritt; bei jedem Schrittwechsel rückt die Karte direkt unter den Header; der Kalender
  nutzt einen Teil des Kartenrands, damit die Tagesfelder breit genug sind (390 px: 46 px).
- Freie Zeiten als Liste/Knöpfe (≥ 44 px), belegte nicht anklickbar und nicht nur farblich
  markiert; leere Tage sagen den nächsten freien Tag.
- **Ladefehler nie als „ausgebucht“ tarnen:** Hinweis, „Erneut versuchen“ und Telefon
  (`components/booking/LoadError.tsx`); dauert das Laden spürbar, steht „Freie Tage werden
  geladen …“. Der Kalender blättert nur vom aktuellen Monat bis zum letzten buchbaren Tag.
- Gesetzliche Feiertage in Hamburg sind online geschlossen und im Cockpit-Kalender als
  „Feiertag“ beschriftet; von Hand darf das Team trotzdem buchen.
- **Keine Gesundheitsangaben** abfragen; Notfall immer auf Telefon verweisen.
- Absagen/Verschieben: Bestätigungsdialog, verständlicher Ausgang, Kalenderdatei aktualisiert.
- Doctolib ist ein separater Weg und wird nie als synchronisiert dargestellt.
- Externe Buchungs-/Kalenderdienste (Cal.com, FullCalendar-Premium u. a.) nur nach Zustimmung
  und DSGVO-/AVV-Prüfung.

## Do's and Don'ts

**Do**
- Inhalte und Funktion vor Form; jede Änderung am echten Bildschirm prüfen (Handy 390 px und
  360 px, Tablet 768 px, Desktop 1366 px).
- Tippziele ≥ 44 × 44 px; sichtbarer Fokusring (primary auf hell, accent auf dunkel).
- Kontrast WCAG AA (4,5:1 Text, 3:1 große Schrift und Bedienelemente); axe-Scan ohne Befund.
- `prefers-reduced-motion` respektieren: Bewegung nur als Bedeutung, nie als Pflicht.
- Bilder WebP, Platz reservieren (kein Layout-Springen), nichts Wichtiges nur per Hover.

**Don't (verboten)**
- Überdimensionierte Karten, große unnötige Buttons, verschachtelte Container, Karten in Karten.
- Farbige vertikale Akzentstreifen als Schmuck (Ausnahme: der bestehende sachliche
  Hinweisblock in Beschwerden bleibt, bis er bewusst überarbeitet wird).
- Übertriebene oder mehrlagige Schatten, dekorative Verläufe (Verläufe nur als Leseschleier
  über Fotografie/Film), Glas-Effekte ohne Funktion.
- Badges als Dekoration, Emoji als Icons, generische Dashboard-Vorlagen, KPI-Kacheln ohne Entscheidung dahinter.
- Graue Schrift auf farbigem Grund, freie Grauwerte, Rohfarben statt Tokens, accent als Text auf hell.
- Neue Schriften, neue Farben, neue UI-Bibliotheken oder npm-Pakete ohne ausdrückliche Zustimmung.
- Gesundheitsangaben in Formularen/Chat abfragen; erfundene Namen, Zahlen, Bewertungen oder
  Siegel; Doctolib als „synchronisiert" darstellen.
