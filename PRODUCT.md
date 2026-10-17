# Product

Proktologie Eimsbüttel – Facharztpraxis Dr. med. Kai Kunstreich, Hamburg. Dieses Repository
enthält die öffentliche Website und das interne Praxis-Cockpit.

> Alle Angaben hier sind vom Betreiber bestätigte Projektvorgaben. Nichts ergänzen, was nicht
> belegt ist – fehlende Fakten erfragen, nicht erfinden.

## Platform

web

## Stack

- **Website** (Repo-Root): Next.js 16 (App Router, statischer Export `out/`), React 19,
  Tailwind CSS v4, TypeScript, Lenis (Scrollen), Motion für React (`framer-motion`, nur
  Buchungsschritte). Hosting Vercel (proktologie.vercel.app).
- **Cockpit** (`cockpit/`): Next.js 16 Server-App, Better Auth (Passkey, TOTP), Drizzle ORM,
  Postgres (Neon), Vercel Region fra1 (proktologie-cockpit.vercel.app).
- Eigene UI-Bausteine in `components/ui/` bzw. `cockpit/components/ui/`, keine UI-Bibliothek.
  Tests: `node --test` (Logik), Playwright (`cockpit/e2e`, deckt auch die Website ab).

## Users

- **Patientinnen und Patienten** (Website): Menschen mit Beschwerden im Analbereich, oft
  verunsichert oder beschämt, jeden Alters; überwiegend auf dem Handy, teils auf älteren
  Praxis-/Büro-Rechnern mit Windows. Sprache Deutsch, Chat zusätzlich Englisch.
- **Praxisteam** (Cockpit): Arzt und Empfang; bearbeiten Termine, Anfragen, Warteliste,
  Sprechzeiten – am Desktop im Praxisalltag, unter Zeitdruck.

## Product Purpose

- Website: Vertrauen schaffen, Scham nehmen, sachlich informieren und den Weg zum Termin kurz
  machen (Online-Terminanfrage, Telefon, Chat-Assistent mit Sprachfunktion).
- Cockpit: Terminanfragen und Praxisabläufe sicher, schnell und nachvollziehbar verwalten.

## Positioning

Moderne, diskrete Facharztpraxis mitten in Eimsbüttel – Erfahrung, Ruhe, Augenhöhe. Kein
Marketing-Getöse, keine Heilversprechen.

## Operating Context

- Praxis: Schäferkampsallee 56, 20357 Hamburg (U-Bahn Christuskirche). Telefon 040 490 80 21.
- Sprechzeiten: Mo, Mi, Fr 07:00–12:00 Uhr; Di, Do 07:00–12:00 und 14:00–18:00 Uhr; Sa/So geschlossen.
- Online-Buchung über die eigene Terminanfrage; Doctolib existiert als separater Weg und wird
  **nie** als synchronisiert dargestellt.

## Capabilities and Constraints

- **Keine Gesundheitsdaten** in Chat oder Formularen abfragen (keine Symptome, Diagnosen,
  Medikamente, Versichertennummern). Keine medizinische Beratung; Notfälle immer zuerst an
  Telefon/Notruf verweisen.
- Keine erfundenen Personen, Namen, Zahlen, Bewertungen oder Siegel.
- Datenschutz (DSGVO): Karten/Drittinhalte erst nach Einwilligung; keine Patientendaten an
  kostenlose KI-Modelle ohne AVV.
- Keine neuen npm-Pakete, keine Datenbank-Schemaänderung und keine Produktiv-Deploys ohne
  Zustimmung des Betreibers. Schlüssel nur aus Umgebungsvariablen.
- Website muss auch auf älteren Browsern etwas Sinnvolles zeigen (nie eine leere/weiße Fläche);
  volle Darstellung ab Chrome/Edge/Firefox 111, Safari 16.4.

## Brand Commitments

Farben, Schriften (Fraunces + Inter), Logo und Bildsprache sind gesetzt – siehe `DESIGN.md`.
Kinematische Kamerafahrt durch die Praxis als Eröffnung der Website (Desktop 1000vh, Handy 500vh).

## Evidence on Hand

Echte Praxisfotografie und 500 Filmbilder der Kamerafahrt (`public/sequence/`), Porträt des Arztes,
Teamfotos, Logo. Keine Stockfotos verwenden.

## Product Principles

1. Diskretion vor Wirkung.
2. Der nächste Schritt (Termin, Anruf) ist von überall in einem Tipp erreichbar.
3. Ehrlich und konkret statt werblich.
4. Im Cockpit: Tempo und Fehlervermeidung vor Ausdruck.

## Accessibility & Inclusion

WCAG 2.1 AA: Kontrast ≥ 4,5:1, Tippziele ≥ 44 px, Tastaturbedienung mit sichtbarem Fokus,
`prefers-reduced-motion` respektieren (ruhige Fassung ohne Kamerafahrt), sinnvolle
Alternativtexte, kein iOS-Zoom in Formularfeldern (≥ 16 px). Ältere Nutzerinnen und Nutzer und
Menschen unter Stress sind die Normalfall-Zielgruppe, nicht die Ausnahme.
