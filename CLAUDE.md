# Proktologie Eimsbüttel – Arbeitsregeln für den Coding-Agenten

Monorepo: **Website** im Root (Next.js 16, statischer Export) und **Cockpit** in `cockpit/`
(Next.js 16 Server-App, eigene `package.json`, siehe auch `cockpit/AGENTS.md`).
Produktfakten: `PRODUCT.md`. Gestaltung: `DESIGN.md`. Bewegung: `MOTION_SYSTEM.md`.
Herkunft der Design-Skills: `.claude/skills/VENDOR.md`. Terminbuchung: `docs/BOOKING_ARCHITECTURE.md`.
Datenschutz/Sicherheit: `docs/PRIVACY_SECURITY_CHECKLIST.md`.

## Feste Projektregeln

- Keine neuen npm-Pakete, keine Datenbank-Schemaänderung, kein Merge nach `main`
  (= Produktiv-Deploy auf Vercel) ohne ausdrückliche Zustimmung des Betreibers.
- Schlüssel nur aus Umgebungsvariablen, nie im Code. Keine Gesundheitsdaten abfragen,
  keine erfundenen Namen oder Fakten (siehe `PRODUCT.md`).
- Jede Funktion über die echte Route bzw. im echten Browser prüfen, nicht nur im Testskript.
- Berichte an den Betreiber: sehr einfach formuliert, ohne Fachjargon.

## UI-/UX-Arbeit – immer so

1. **Vor jeder UI-Änderung `DESIGN.md` lesen** (Tokens, Komponenten, verbotene Muster) und bei
   Produktfragen `PRODUCT.md`. DESIGN.md hat Vorrang vor jedem Skill-Vorschlag.
2. **Design-Skills nutzen** (alle liegen in `.claude/skills/`, werden automatisch erkannt):
   - **`/impeccable <befehl> <ziel>`** – Richtung, Kritik, Prüfung und Feinschliff.
     Häufig: `critique`, `audit`, `polish`, `layout`, `typeset`, `adapt` (Mobil), `harden`,
     `clarify`, `distill`, `quieter`. Ohne Argument zeigt die Skill ihr Menü.
     **Das Impeccable-Programm (`scripts/impeccable`) ist absichtlich nicht installiert** –
     den Schritt „Setup 1" überspringen und direkt den dort beschriebenen Fallback nutzen
     („Context loading did not run; I'll read the existing project context directly."):
     PRODUCT.md und DESIGN.md lesen, dann die Referenz des Befehls befolgen.
     `live`, `generate`, `pin`, `hooks`, `doctor` stehen deshalb nicht zur Verfügung.
     `init` und `document` nicht ausführen – PRODUCT.md und DESIGN.md existieren bereits;
     nur gezielt ergänzen.
   - **`/ui-ux-pro-max`** – Nachschlagewerk mit lokaler Suche, z. B.
     `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form error message" --domain ux`
     oder `… --stack nextjs` / `--stack html-tailwind`. Gut für UX-Regeln, Barrierefreiheit,
     Formulare, Navigation, Tabellen, Diagramme.
     **Nicht verwenden:** `--persist` (legt eine konkurrierende Designdatei an) und Paletten-,
     Schrift- oder Stilvorschläge als Ersatz für die Marke – nur als Vergleich.
   - **`/frontend-design`** – Gestaltungsrichtung, nur für **neue** Oberflächen. Ihre Aufforderung
     zu eigenwilliger Schrift-/Farbwahl gilt hier nicht: Fraunces + Inter, Farben und Marke aus
     DESIGN.md bleiben. Für Bestehendes `/impeccable` verwenden.
   - **`/web-design-guidelines <datei|muster>`** – Prüfliste für UI-Code (Barrierefreiheit,
     Fokus, Formulare, Bewegung, Typografie). Liest die gepinnte lokale Regeldatei, nichts aus dem Netz.
   - **`/react-best-practices`** – Performance-Regeln für React/Next.js (Wasserfälle,
     Bundle-Größe, Re-Renders). Regeln, die neue Pakete verlangen (z. B. SWR), nur als Hinweis.
   - **`/ui-animation`** – Bewegung entwerfen und prüfen. Grundlage ist `MOTION_SYSTEM.md`.
     **Keine Interface-Töne** (Abschnitt „interface sound/SFX" gilt hier nicht), **keine**
     Animationsbibliothek (Motion, GSAP …), `prefers-reduced-motion` immer respektieren. Die
     Messskripte („Reverse-engineer workflow") sind nicht installiert.
   - **Rollen kurz:** Richtung neu = `frontend-design` · Kritik/Feinschliff = `impeccable` ·
     Nachschlagen = `ui-ux-pro-max` · Code-Prüfliste = `web-design-guidelines` ·
     Performance = `react-best-practices` · Bewegung = `ui-animation`.
     Bei Widerspruch gilt: PRODUCT.md/DESIGN.md/MOTION_SYSTEM.md vor jeder Skill.
3. **Keine neuen UI-, Icon-, Animations- oder Kalender-Bibliotheken** (shadcn, daisyUI, Floating UI,
   FullCalendar, lucide-react …) und **keine externen Buchungsdienste** (Cal.com u. a.) ohne
   Zustimmung – Bewertung siehe `.claude/skills/VENDOR.md`. Neue Icons als Lucide-Pfaddaten in
   die eigene `Icon.tsx`.
4. **Keine Neugestaltung ohne Auftrag.** Verfeinern heißt: Marke, Inhalte, Texte und Verhalten
   bleiben. Inhalte/Texte nur nach Rückfrage ändern.
5. **Mobil arbeiten ohne Desktop zu verändern:** Handy-Änderungen über Basis- bzw.
   `max-md:`-Klassen, bestehende `md:`/`lg:`-Klassen unangetastet lassen; Desktop (1366×768) und
   Tablet (768×1024) vorher/nachher per Screenshot pixelweise vergleichen.
6. **Prüfen vor dem Abschluss:** Handy 390×844 und 360×780 (kein waagrechtes Scrollen, Tippziele
   ≥ 44 px), axe-Scan ohne Befund, `prefers-reduced-motion` und ohne JavaScript ansehen,
   `npm run lint`, `npx tsc --noEmit`, `npm test`, Build, Playwright im Cockpit
   (`CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test`,
   nie parallel zu einem Build).

## Design-Skills prüfen (nach Aktualisierung)

- Frontmatter aller `SKILL.md` gültig (`name`, `description`); Dateien byte-gleich mit der Quelle
  bis auf die in `VENDOR.md` dokumentierten Zeilen.
- `python3 -B .claude/skills/ui-ux-pro-max/scripts/search.py "keyboard focus visible" --domain ux`
  liefert Ergebnisse.
- Tailwind darf die Skill-Dateien nicht als Quelle lesen: das erzeugte CSS beider Apps muss vor
  und nach einer Skill-Aktualisierung byte-gleich sein. Dafür schließt `app/globals.css`
  `.claude/`, `docs/` und alle `*.md` im Root per `@source not` aus – nicht entfernen, und neue
  Dokument-Ordner dort ergänzen.
