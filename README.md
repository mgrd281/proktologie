# Proktologie Eimsbüttel – Dr. Kai Kunstreich

Premium-Website der proktologischen Praxis in Hamburg-Eimsbüttel: ruhig, diskret,
vertrauensbildend und conversion-orientiert. Gebaut mit Next.js 15 (statischer
Export), Tailwind CSS v4 und Lenis.

## Schnellstart

```bash
npm install
npm run dev        # Entwicklung: http://localhost:3000
npm run build      # Statischer Export nach ./out
npm run lint       # ESLint
```

Der Build erzeugt in `out/` eine vollständig statische Website, die auf jedem
Webspace/Host funktioniert (kein Node-Server nötig).

## Porträtfoto

Das freigestellte Porträt von Dr. Kunstreich liegt als
**`public/images/dr-kunstreich.webp`** im Repository (WebP mit
Transparenz, 1086 × 1448 px, aus dem gelieferten PNG optimiert).

Foto austauschen: einfach diese Datei überschreiben (Hochformat 3:4,
freigestellt mit transparentem Hintergrund) — kein Code-Change nötig.
Sollte die Datei fehlen oder nicht laden, zeigt die Website automatisch
ein gestaltetes Marken-Panel (`components/ui/DoctorPortrait.tsx`).

## Scroll-Sequenz (Canvas-Engine)

Der Desktop-Hero ist eine echte scroll-gescrubbte Bildsequenz:
Scroll → Lenis → normalisierter Fortschritt → LERP (0,14) → Canvas-Frame.
Engine: `components/hero/sequence/` (config, FrameStore, CanvasSequence).

- **Frames:** `public/hero-frames/frame-0001.webp … frame-0500.webp`
  (aktuell generierte Platzhalter). Finale Renders ersetzen die Dateien
  1:1 bei identischem Namensschema – kein Code-Change nötig.
- **Speicher:** Blobs komplett vorgeladen; dekodiert werden eine dauerhafte
  Grob-Leiter (jeder 8. Frame, halbe Auflösung) plus ein volles
  Gleitfenster ±40 Frames um den Playhead (LRU). Fehlt ein Frame, zeichnet
  der Loop den nächstgelegenen verfügbaren.
- **Mobile:** keine 500 Frames – Videoslot. Dateien
  `public/hero-frames/hero-mobile.webm` / `hero-mobile.mp4` ablegen
  (Poster: `poster.webp`); bis dahin fällt der Slot automatisch auf die
  Porträt-Karte zurück.
- **Reduced Motion:** statischer Hero (Poster-Charakter), Engine startet
  nicht.

Ebenen des Heros (unten → oben): Ambiente-Fallback → Canvas-Sequenz →
Typografie → Arzt-Freisteller (separat animierbar) → Interface
(Kapitel-Navigation).

## Praxisteam

Die Sektion „Unser Praxisteam" (`components/sections/Team.tsx`) zeigt das
Gruppenfoto (`public/images/team.webp`) und sechs Einzelporträts.

**Personenangaben werden bewusst NICHT dargestellt**, solange sie nicht von
der Praxis bestätigt sind: In `content/team.ts` stehen `name`, `role`,
`bio` auf `null` und `languages` ist leer – nichts davon wurde erfunden.
Bis zur Freigabe trägt jede Karte das neutrale Label „Praxisteam".

Echte Angaben ergänzen: in `content/team.ts` beim jeweiligen Eintrag
`name` / `role` / `bio` / `languages` füllen – die Karten zeigen sie dann
automatisch, ohne Code-Änderung. Alt-Texte sind neutral und
geschlechtsneutral formuliert, weil auch das nicht bestätigt ist.

Porträts austauschen: `public/images/team/portrait-N-420.webp` und
`portrait-N-840.webp` überschreiben (Hochformat 4:5).

## Vor Launch: Checkliste

Adresse, Telefon, Fax, E-Mail, Sprechzeiten und die Arzt-Vita sind von der
Bestandsseite proktologie-eimsbuettel.de übernommen (echt). Offen bleibt:

| Punkt | Details |
|---|---|
| Finale Domain | `content/site.ts` (`url`) + `metadataBase` bestätigen |
| Doctolib-Profil | `content/site.ts` (`doctolibUrl`) — direkten Praxis-Link eintragen (aktuell generischer Doctolib-Link) |
| EBSQ-Schreibweise | Bestandsseite schreibt „ESBQ/FEBS", gängig ist „EBSQ" — mit dem Arzt bestätigen (`content/arzt.ts`) |
| Sprechzeiten | Bestandsseite zeigt auf /about/ noch eine ältere 7–12-Variante — übernommen wurde die aktuelle 8–13/14–18-Variante; bestätigen |
| Impressum/Datenschutz | Rechtlich prüfen lassen; verbleibende `[MUSTER]`-Lücken füllen (Aufsichtsbehörde, USt, Hosting, Speicherfristen, Stand) |
| Formular-Endpoint | Bei Aktivierung (`formEndpoint`) Datenschutz Abschnitte 2 und 4 anpassen |

Suche im Projekt nach `PLATZHALTER` und `MUSTER`, um nichts zu übersehen.

## Kontaktformular

Das Formular funktioniert ohne Backend: Standardmäßig öffnet es das
E-Mail-Programm der Besucher:in mit einer vorbefüllten Anfrage (`mailto:`).

Für echten Server-Versand (z. B. Formspree, Web3Forms, eigenes Endpoint) in
`content/site.ts` die Konstante `formEndpoint` auf die POST-URL setzen —
das Formular sendet dann JSON (`{ name, contact, callback, time, message }`).
Danach die Datenschutzerklärung entsprechend ergänzen.

## Architektur

```
app/            Routen, Layout, globale Styles, Sitemap/Robots/Icon
components/
  hero/         Cinematischer Scroll-Hero (Desktop) + statische Variante
  layout/       Header, Mobilmenü, Footer, Skip-Link
  sections/     Die Sektionen der Startseite
  ui/           Wiederverwendbare Bausteine (Button, Accordion, Formular …)
content/        GESAMTER deutscher Text als typisierte Konstanten
lib/            Helfer (JSON-LD, Scroll-Progress-Hook)
providers/      Lenis-Provider (Smooth Scrolling, Anker-Navigation)
```

Prinzip: Kein sichtbarer Text ist in Komponenten hartkodiert — sämtliche Copy
liegt in `content/*.ts` (eine Quelle für UI **und** strukturierte Daten).

## Design-Tokens

Feste Farbpalette in `app/globals.css` (`@theme`): Primary `#527A32`,
Accent `#86BC23` (echtes Klinikgrün; nur auf dunklen Flächen bzw. als Fläche mit dunkler Schrift), Deep `#17251B`, Warm White
`#F7F7F3`, Soft Gray `#ECEEE8`, Charcoal `#202520`.
Typografie: Fraunces (Display-Serif) + Inter (UI/Body), beide via
`next/font` **self-hosted** — zur Laufzeit erfolgt kein Request an Google
(DSGVO). Es gibt keine Cookies, kein Tracking und keine Dritt-Embeds,
daher ist kein Consent-Banner erforderlich.

## Barrierefreiheit & Performance

- Skip-Link, sichtbare Fokus-Ringe, Fokus-Falle im Mobilmenü, `inert` für
  inaktive Hero-Beats, beschriftete Formularfelder mit Fehlermeldungen
- `prefers-reduced-motion`: statischer Hero, kein Lenis, keine Animationen
- Mobile erhält eine vereinfachte Hero-Variante ohne Scroll-Kopplung
- Scroll-Choreografie schreibt nur `opacity`/`transform` (compositor-only),
  keine React-Renders pro Frame
