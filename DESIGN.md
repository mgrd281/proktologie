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
- **Ein Grün handelt.** Pro Ansicht genau eine primäre Handlung in accent.
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
    Karte ≈ 84 % breit, nächste lugt hervor). Rasterkinder, die eine Wischreihe enthalten,
    brauchen `min-w-0`.
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
- Eingabefelder (Website-Buchung und Cockpit), Listeneinträge, Navigationspunkte: `rounded-xl`
  (12 px). Das Rückrufformular der Website nutzt noch `rounded-lg` – bei der nächsten
  Überarbeitung angleichen, nicht als Vorbild nehmen.
- Icons: eigene Linien-Icons (`components/ui/Icon.tsx`, 24er Raster, Strich 1,6, `currentColor`);
  keine Emoji, keine zweite Icon-Bibliothek.

## Components

### Buttons
- Website `components/ui/Button.tsx`: `primary` (accent-Fläche, deep-Text, halbfett), `outline`,
  `outline-dark` (auf deep), `ghost`. **Mindesthöhe 44 px**, `px-7`, 14 px, optionaler Pfeil.
- Cockpit `cockpit/components/ui/Button.tsx`: `primary`, `secondary` (Standard), `ghost`,
  `danger`; Größen `sm` (36 px, nur in dichten Tabellenzeilen am Desktop) und `md` (44 px).
- Pro Ansicht ein primary. Keine überbreiten Buttons außer in Formularen/Bottom-Sheets auf dem Handy.

### Cards / Containers
- Karte = `rounded-2xl bg-white p-7 ring-1 ring-ink/5` (mobil `p-6`). **Keine Karte in einer
  Karte**, keine farbigen Randstreifen, Icon-Kreis nur wo er Bedeutung trägt.

### Inputs / Fields
- Sichtbares Label über dem Feld (nie nur Platzhalter), Fehler direkt unter dem Feld mit
  `role="alert"`, Pflichtfelder markiert, `autocomplete` gesetzt.
- Website-Buchungsfeld 44 px, `rounded-xl`, weiß; Cockpit `inputClass` (44 px, `rounded-xl`, 15 px).

### Navigation
- Website: transparenter Header über der Kamerafahrt, danach deckend `bg-cream/97` (Handy 64 px,
  ab md 80 px). Unter 1280 px Vollbild-Menü (deep, Fraunces 30 px, weich einblendend).
- Cockpit: Seitenleiste mit 40 px hohen Einträgen, Befehlspalette (⌘K).

### Tables & Lists (Cockpit)
- `DataTable`: `rounded-2xl ring-1 ring-line`, Kopf klebend mit `surface-sunken/80` +
  Unschärfe, Zeilen durch `divide-line`, 13 px, Tabellenziffern. Leere Zustände sagen, was zu tun ist.

### Dialogs & Bottom Sheets
- Cockpit: Drawer rechts (`slide-in-right`), Bestätigungsdialog zentriert (`rise-in`,
  `max-w-md`), Hintergrund `deep/30–40` + `backdrop-blur-[2px]`, Fokusfalle, Esc schließt.
- Website-Chat: auf dem Handy Bottom-Sheet (`max-h-[85dvh]`), am Desktop schwebendes Fenster.
- Kopf-Knöpfe in Sheets/Dialogen ≥ 44 px.

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
