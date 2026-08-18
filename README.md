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

## Praxisteam (scroll-getriebene 3D-Szene)

Die Sektion ist kein Kartenraster, sondern **eine räumliche Szene**: Die sechs
echten Porträts liegen als Ebenen auf einem geschwungenen Pfad, durch den eine
Kamera fährt. Der Scroll steuert nur die Kamera – die Ebenen bleiben, wo sie sind.

```
components/team/
  TeamScene.tsx     Client-Engine: EIN rAF-Loop, LERP 0.1 auf den Zielfortschritt
                    aus useScrollProgress. Schreibt pro Bild ausschließlich
                    transform/opacity plus ein einziges SVG-`d`; React rendert
                    nur beim Kapitelwechsel (8×).
  TeamCard.tsx      Eine Porträt-Ebene (4:5, feine Kante, Tiefenschleier)
  TeamProgress.tsx  „01 / 06" – die Stufen sind Buttons (Tastaturzugang)
  TeamStatic.tsx    prefers-reduced-motion / ohne JS: ruhiges Editorial-Layout
lib/team/scene.ts   GESAMTE Geometrie als reine Mathematik (kein DOM):
                    Pfad, Kamera, Projektion, Deckkraft, Finale
lib/team/scene.test.mjs  Geometrie-Tests ohne Browser
```

Acht Haltepunkte über einen 640vh-Track (`t = Fortschritt · 7`): Intro (0),
Mitglied 01–06 (1–6), Finale (7, Kamera zieht zurück → Gruppenkomposition +
„Gemeinsam für Ihre Gesundheit." + Termin-CTA).

Tests:

```bash
node --experimental-strip-types --test lib/team/scene.test.mjs
```

Weil die Geometrie vom DOM getrennt ist, lässt sich die Komposition ohne Browser
prüfen – die Tests haben beim Bau zwei echte Fehler gefunden (Ebenen liefen auf
die Projektionsebene zu; die Szene riss zum Ende hin ab).

**Performance:** Im Animationspfad stehen nur `transform` und `opacity`. Kein
`filter: blur()` auf bewegten Ebenen (Tiefenschärfe läuft über einen Schleier mit
reiner Deckkraft), die Weichzeichnung des Hintergrunds steckt fest im Bild-Asset,
und ein Idle-Guard beendet den Frame, solange sich nichts ändert. Auf Mobilgeräten
gilt eine eigene Geometrie (flachere Perspektive, engere Staffelung, weniger
gleichzeitig gezeichnete Ebenen) – kein geschrumpfter Desktop.

**Bildmaterial:** Die sechs Porträts liegen unter `public/images/team/`
(`portrait-N-{420,840}.webp`, 4:5). Die Umgebungsebene (`praxis-raum-*.webp`)
ist derzeit aus dem echten Gruppenfoto abgeleitet; sobald eine dedizierte
Empfangs-Aufnahme vorliegt, genügt es, diese Dateien zu ersetzen.

**Personendaten:** Namen, Rollen, Kurzprofile und Sprachen sind weiterhin nicht
bestätigt und stehen in `content/team.ts` auf `null`. Angezeigt wird das neutrale
Label „Praxisteam"; sobald echte Angaben eingetragen sind, erscheinen sie
automatisch in beiden Varianten. Es wurde nichts erfunden.

## Vor Launch: Checkliste

Adresse, Telefon, Fax, E-Mail, Sprechzeiten und die Arzt-Vita sind von der
Bestandsseite proktologie-eimsbuettel.de übernommen (echt). Offen bleibt:

| Punkt | Details |
|---|---|
| Finale Domain | `content/site.ts` (`url`) + `metadataBase` bestätigen |
| ~~Doctolib-Profil~~ | ✔ erledigt: echtes Praxisprofil in `content/site.ts` hinterlegt (`NEXT_PUBLIC_DOCTOLIB_BOOKING_URL` überschreibt) |
| EBSQ-Schreibweise | Bestandsseite schreibt „ESBQ/FEBS", gängig ist „EBSQ" — mit dem Arzt bestätigen (`content/arzt.ts`) |
| ~~Sprechzeiten~~ | ✔ erledigt: 07:00–12:00 (Di/Do zusätzlich 14:00–18:00) laut Doctolib-Profil, von der Praxis bestätigt |
| Impressum/Datenschutz | Rechtlich prüfen lassen; verbleibende `[MUSTER]`-Lücken füllen (Aufsichtsbehörde, USt, Hosting, Speicherfristen, Stand) |
| Formular-Endpoint | Bei Aktivierung (`formEndpoint`) Datenschutz Abschnitte 2 und 4 anpassen |
| Doctolib-Sync | Für echte Verfügbarkeiten: offizieller Partner-/PVS-Zugang nötig — siehe „Terminbuchung“ unten |

Suche im Projekt nach `PLATZHALTER` und `MUSTER`, um nichts zu übersehen.

## Terminbuchung (5-Schritte-Flow)

Die Termin-Sektion ist eine mehrstufige Booking-Experience
(Terminart → Datum → Uhrzeit → Angaben → Bestätigung) in
`components/booking/`. Sämtliche Verfügbarkeit läuft über das
`BookingProvider`-Interface (`lib/booking/provider.ts`):

| Provider | Modus | Verhalten |
|---|---|---|
| `RequestBookingProvider` (Default) | `request` | **Wunschtermin**: wählbare Tage/Zeiten werden aus den echten Sprechzeiten (`site.hoursJsonLd`) abgeleitet, die Praxis bestätigt persönlich. Es wird nie behauptet, ein Slot sei live verfügbar. |
| `MockBookingProvider` | `request` | Nur Entwicklung/Screenshots (`NEXT_PUBLIC_BOOKING_PROVIDER=mock`): simuliert belegte Slots. Niemals produktiv einsetzen. |
| `DoctolibBookingProvider` | `confirmed` | Bewusst **nicht implementiert** — wirft „nicht konfiguriert“. Wird erst gebaut, wenn ein offizieller Doctolib-Zugang existiert. |

Versand der Terminanfrage ohne Backend per `mailto:`; alternativ
`formEndpoint` in `content/site.ts` auf eine POST-URL setzen (JSON) und die
Datenschutzerklärung ergänzen. Es werden keine personenbezogenen Daten in
URLs, localStorage oder Logs abgelegt.

### Doctolib — was für echte Synchronisation fehlt

Es existiert **keine öffentliche Doctolib-API**; Scraping, private Endpoints
oder ein „synchron“ behaupteter Zweitkalender sind ausgeschlossen. Für echte
Integration werden benötigt:

1. ~~Offizielle Buchungsseiten-URL des Praxisprofils~~ — **erledigt.**
   Hinterlegt ist das verifizierte Profil (Dr. med. Kai Kunstreich,
   Proktologie Eimsbüttel); Online-Buchung ist dort aktiv, die CTAs führen
   direkt dorthin. `NEXT_PUBLIC_DOCTOLIB_BOOKING_URL` überschreibt den Wert,
   `doctolibConfigured: false` blendet alle Doctolib-CTAs aus.
2. **Offizieller Partner-/PVS-Integrationszugang** über das Doctolib-Pro-Konto
   der Praxis (Doctolib-Partnerprogramm) → erst damit darf ein
   `DoctolibBookingProvider` mit `mode: "confirmed"` implementiert werden.
   Die UI schaltet dann automatisch auf „Termin verbindlich buchen“ um.

Doctolib-Synchronisation ist **nicht aktiv** und wird nirgends als aktiv
dargestellt: Der Link ist ein Handoff auf das Praxisprofil. Verfügbarkeiten der
Website (Wunschtermin aus den Sprechzeiten) und Doctolibs echter Kalender sind
getrennte Systeme — deshalb steht der Doctolib-Weg für verbindliche Buchungen
schon ab Schritt 1 der Buchungskarte sichtbar daneben.

## Architektur

```
app/            Routen, Layout, globale Styles, Sitemap/Robots/Icon
components/
  hero/         Cinematischer Scroll-Hero (Desktop) + statische Variante
  layout/       Header, Mobilmenü, Footer, Skip-Link
  sections/     Die Sektionen der Startseite
  booking/      Terminbuchung: Schritte, Kalender, Fortschritt, Rückruf
  ui/           Wiederverwendbare Bausteine (Button, Accordion, Karte …)
content/        GESAMTER deutscher Text als typisierte Konstanten
lib/            Helfer (JSON-LD, Scroll-Progress-Hook) + booking/ (Provider)
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
