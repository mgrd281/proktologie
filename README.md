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

Der Hero ist in unabhängigen Ebenen aufgebaut (Hintergrund-Ambiente →
Typografie → Arzt-Freisteller → Interface). Die Hintergrund-Ebene
(`components/hero/HeroBackground.tsx`) ist der dokumentierte Mount-Punkt
für eine spätere scroll-getriebene Canvas-Bildsequenz; der Freisteller
bleibt dabei eine eigene, separat animierbare Ebene.

## Vor Launch: Checkliste

Alle Musterangaben sind im Code mit `[PLATZHALTER]` bzw. `[MUSTER]` markiert:

| Wo | Was |
|---|---|
| `content/site.ts` | Adresse, Telefon (eine Konstante — der `tel:`-Link wird abgeleitet), E-Mail, Sprechzeiten, Domain, Maps-Link |
| `content/site.ts` | **`isPlaceholderData` auf `false` setzen**, sobald die echten Daten eingetragen sind — erst dann erscheinen Kontaktdaten im JSON-LD und die „Musterangaben"-Hinweise verschwinden |
| `content/arzt.ts` | Facharztbezeichnung und Vita-Stationen |
| `app/layout.tsx` + Copy | Die Bezeichnung „Proktologe/Facharzt" mit der tatsächlichen, verliehenen Qualifikation abgleichen (HWG/MBO-Ä — irreführende Titelwerbung vermeiden) |
| `app/impressum/page.tsx` | Impressumsangaben (§ 5 DDG) — rechtlich prüfen lassen |
| `app/datenschutz/page.tsx` | Datenschutzerklärung — rechtlich prüfen lassen; bei Aktivierung eines Formular-Endpoints Abschnitte 2 und 4 anpassen |

Suche im Projekt nach `PLATZHALTER` und `MUSTER`, um nichts zu übersehen.
Solange `isPlaceholderData` auf `true` steht, veröffentlicht das JSON-LD
bewusst keine Adresse/Telefon/E-Mail/Öffnungszeiten (Suchmaschinen sollen
keine Musterdaten indexieren).

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
Accent `#B8D94C` (nur auf dunklen Flächen!), Deep `#17251B`, Warm White
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
