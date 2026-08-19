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

## Die Kamerafahrt der Startseite

Die Startseite beginnt nicht mit einem Hero und einzelnen Sektionen,
sondern mit **einer durchgehenden Fahrt** über neun Zustände – erst nach
dem Auslauf beginnt die normale Seite:

```
01 Willkommen · 02 Beschwerden · 03 Leistungen · 04 Symptome
05 Diagnostik · 06 Behandlung · 07 Team · 08 Praxis · 09 Termin
→ Auslauf direkt in die Buchung (#kontakt)
```

Ein Track (1200vh), eine sticky Bühne, **ein** Fortschritt, **ein**
`requestAnimationFrame`-Loop. Kein Layer hört selbst auf Scroll.

```
Scroll → Lenis (duration 1.2, exponentieller Ausklang)
       → useScrollProgress(track)            Ziel (roh, rAF-gedrosselt)
       → current += (target - current)·0.14  Trägheit/Nachlauf
       → alle Ebenen als Senken (transform/opacity, sonst nichts)
```

Der rohe `window.scrollY` wird nirgends direkt auf eine Transformation
abgebildet: Lenis liefert die Trägheit des Scrollens, der LERP die der
Kamera. Deshalb läuft die Bewegung nach dem Radstopp sichtbar nach.

```
lib/cinema/timeline.ts        Dramaturgie als reine Mathematik (kein DOM)
lib/cinema/leistungen.ts      Geometrie des Leistungs-Korridors
lib/cinema/*.test.mjs         Tests ohne Browser
content/cinema.ts             Textplan der neun Zustände (expliziter Plan)
components/cinema/
  MasterSequence.tsx          Track, Bühne, der eine Loop, alle Schreibvorgänge
  MasterRail.tsx              die eine Leiste 01–09 (Buttons, Tastaturzugang)
  CinemaStatic.tsx            reduzierte Bewegung / ohne JS
  layers/StateText.tsx        Typografie eines Zustands
  layers/LeistungenLayer.tsx  acht Tafeln im Z-Korridor (Zustand 03)
  layers/SymptomeLayer.tsx    vier Beschwerde-Cluster als Typo-Zyklus (04)
  layers/TeamStage.tsx        die sechs Porträt-Ebenen (Zustand 07)
  layers/PraxisLayer.tsx      Adresse, Sprechzeiten, Wege (Zustand 08)
  layers/TerminLayer.tsx      Buchungs-Vorschau (Zustand 09)
```

### Warum es keine harten Kanten gibt

Kern der Zeitachse ist `band(p, inStart, inEnd, outStart, outEnd)`. Jede
Ebene bekommt ein Band, das **früher beginnt und später endet** als ihr
Zustand – daraus entsteht die Überblendung statt des Schnitts:

| Ebene | Band | liest sich als |
|---|---|---|
| Lichtsequenz (Canvas) | 0.00 → 0.58 | trägt 01–04, verblasst in den Raum |
| Arzt-Freisteller | 0.00 → 0.24 | trägt 01–02, weicht den Tafeln |
| Leistungs-Korridor | 0.165 → 0.36 | kommt in 02, klingt in 04 aus |
| Symptom-Zyklus | 0.285 → 0.46 | kommt in 03, klingt in 05 aus |
| **Untersuchungsraum (echtes Foto)** | 0.43 → 0.80 | trägt Diagnostik UND Behandlung |
| Empfangs-Ambiente | 0.60 → Ende | übernimmt für Team, Praxis, Termin |
| Team-Porträts | 0.56 → 0.90 | erscheinen, bevor 07 beginnt |
| Praxis-Karte | 0.72 → 0.93 | beginnt, während Team läuft |
| Termin-Vorschau | 0.86 → nie | reitet auf dem Auslauf in die Buchung |
| Bahn, Glow, Leiste | 0.00 → 1.00 | die drei durchgehenden Motive |
| Auslauf | 0.955 → 1.00 | Bühne löst sich in Cream auf |

Besonderheiten:

- **Textbänder sind von den Zuständen entkoppelt** (`TEXT_BANDS`):
  Zustand 01 trägt zwei Texte (Willkommen, dann Dr. Kunstreich), beide auf
  Leistenpunkt 01. Das erste Band ist bei p = 0 voll da, das letzte bleibt
  bis zum Schluss.
- **Sprungmarken (`ANCHORS`) statt Zustandsmitte:** Bei Leistungen und
  Symptomen läge die Mitte exakt in einer Blende (Stationswechsel bzw.
  Fensterwechsel) – die Marken landen dort, wo der Zustand voll trägt.
- Der Auslauf skaliert die Bühne **nicht**, sondern blendet in genau den
  Farbton der Kontakt-Sektion; die **Termin-Vorschau liegt im DOM über dem
  Auslauf-Schleier** und übergibt als Match-Cut an die echte BookingCard
  (die genau EINMAL existiert, in `#kontakt` – die Vorschau enthält keine
  Formularelemente und keine ids).
- Der Header schaltet bei `HEADER_SOLID_AT` (0.46) auf deckend – kurz
  **bevor** der Untersuchungsraum die Bühne hell macht (`brightness()`).
- Zustand 07 behält seinen Unterzähler 01/06 … 06/06 neben der Leiste.
- Das frühere Intro („Ihre Praxis für Proktologie in Hamburg“) lebt
  vollständig in Zustand 02; die Sektion darunter entfiel. Für reduzierte
  Bewegung steht derselbe Inhalt in `CinemaStatic`.

### Der Leistungs-Korridor (Zustand 03)

Die acht Leistungen stehen NICHT als Kartenraster in der Fahrt, sondern
als Tafeln in der Tiefe: **vier Stationen zu je zwei Tafeln** auf einem
diagonal fliehenden Korridor rechts der Textspalte (`stationStepX` –
sonst projizierten gleichplatzierte Tafeln aufeinanderfolgender Stationen
auf denselben Bildpunkt). Die Kamera endet AUF der letzten Station
(`corridorTime`); die Tafeln verlassen die Bühne über die Ebenen-Blende in
den Symptom-Zustand. Deckkraft hängt am Fokus, Tiefenschleier ist ein
diskretes `data-blur` (nie `filter`). Mobil: vertikale Drift, höchstens
drei Tafeln, nur Nummer + Titel. Das vollständige Raster steht als
zugängliche Sektion weiter unten – die Tafeln sind `aria-hidden`.

### Tests

```bash
node --experimental-strip-types --test lib/cinema/timeline.test.mjs
node --experimental-strip-types --test lib/cinema/leistungen.test.mjs
node --experimental-strip-types --test lib/team/scene.test.mjs
```

Die Zeitachsen-Tests kodieren die Abnahmefragen: Decken die neun Zustände
0–1 lückenlos ab? Trägt zu **jedem** Fortschritt eine Umgebung das Bild?
Sind an jeder Grenze **beide** Nachbarn sichtbar? Erben die Szenen
einander (Arzt in 02, Tafeln in 04, Raum vor 05, Team in 06, Praxis in
07, Termin vor Praxis-Ende)? Läuft die Vorschau wirklich bis zum Ende
durch? Weil die Dramaturgie vom DOM getrennt ist, ist all das ohne
Browser prüfbar.

## Bildsequenz der Zustände 01–04 (Canvas-Engine)

Die Umgebung der ersten Zustände ist eine scroll-gescrubbte Bildsequenz.
Engine: `components/hero/sequence/` (config, FrameStore, CanvasSequence).
Sie hört selbst nicht auf Scroll – die Kamerafahrt ruft `setProgress(p)`.

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

## Der echte Untersuchungsraum (Zustände 05–06)

`public/images/untersuchungsraum-*.webp` – das vom Praxisinhaber
gelieferte Foto des Untersuchungsraums (grüne Liege, grünes Lichtband,
Praxislogo am Monitor). Es trägt Diagnostik und Behandlung als zwei
Parallax-Ebenen (weiche Rückwand 0.5×, scharfe Ebene 1.3×, Zoom
1.06 → 1.00) – Weichzeichnung steckt IM Asset, im Renderpfad stehen nur
`transform` und `opacity`. Austausch: die vier Dateien überschreiben
(Details in `public/images/README.txt`).

## Die sechs Porträts (Zustand 07)

Zustand 07 ist kein Kartenraster, sondern **eine räumliche Szene**: Die
sechs echten Porträts liegen als Ebenen auf einem geschwungenen Pfad,
durch den die Kamera fährt. Die Ebenen bleiben, wo sie sind – bewegt wird
die Kamera.

```
lib/team/scene.ts        GESAMTE Geometrie als reine Mathematik (kein DOM):
                         Pfad, Kamera, Projektion, Deckkraft, Finale
lib/team/scene.test.mjs  Geometrie-Tests ohne Browser
components/cinema/layers/TeamStage.tsx  reine Senke: render(local, weight, pointer)
components/team/TeamCard.tsx            eine Porträt-Ebene (4:5, feine Kante)
components/team/TeamStatic.tsx          ruhiges Editorial-Layout ohne Bewegung
```

**Eröffnung:** Zu Beginn steht die Kamera zurück und rechts der ersten
Ebene – das ganze Team steht als Reihe im Raum und wird nach hinten
kleiner. Damit die Reihe nach hinten nicht ineinanderläuft, wachsen die
Seitenschritte des Pfades (`X_GROWTH`).

**Performance:** Im Animationspfad stehen nur `transform` und `opacity`.
Kein `filter: blur()` auf bewegten Ebenen, die Weichzeichnung des
Hintergrunds steckt fest im Bild-Asset, und ein Idle-Guard beendet den
Frame, solange sich nichts ändert. Auf Mobilgeräten gilt eine eigene
Geometrie; weil dort Text zwangsläufig über hellen Ebenen liegt, kommt
und geht mit ihnen ein Leseschleier (Team wie Leistungs-Korridor).

**Bildmaterial:** Die sechs Porträts liegen unter `public/images/team/`
(`portrait-N-{420,840}.webp`, 4:5).

**Umgebung – Zwischenstand:** Das Empfangs-Ambiente (Team/Praxis/Termin)
ist gebaut (Licht, Boden, Tresenkante als Verläufe in `.team-env`), die
einzige echte Empfangsaufnahme ist das Gruppenfoto – als Hintergrund
stünden dieselben Personen doppelt im Bild. Sobald ein Empfangs-/
Wartezimmerfoto ohne Personen vorliegt: `public/images/praxis-raum-*`
ersetzen und in `app/globals.css` `.team-env-blur { opacity: 0.1 }` auf
ca. `0.85` heben.

**Personendaten:** Namen, Rollen, Kurzprofile und Sprachen sind weiterhin
nicht bestätigt und stehen in `content/team.ts` auf `null`. Angezeigt wird
das neutrale Label „Praxisteam“; sobald echte Angaben eingetragen sind,
erscheinen sie automatisch. Es wurde nichts erfunden.

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
  cinema/       Die Kamerafahrt: Track, Bühne, Leiste, neun Zustände
  hero/         Bildsequenz-Engine, Beat-Grafiken, statische Fassung
  team/         Porträt-Ebene und ruhige Team-Fassung
  layout/       Header, Mobilmenü, Footer, Skip-Link
  sections/     Die Sektionen der Startseite
  booking/      Terminbuchung: Schritte, Kalender, Fortschritt, Rückruf
  ui/           Wiederverwendbare Bausteine (Button, Accordion, Karte …)
content/        GESAMTER deutscher Text als typisierte Konstanten
lib/            Helfer (JSON-LD, Scroll-Progress-Hook), cinema/ (Zeitachse +
                Korridor), team/ (Szenengeometrie), booking/ (Provider)
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

- Skip-Link, sichtbare Fokus-Ringe, Fokus-Falle im Mobilmenü, beschriftete
  Formularfelder mit Fehlermeldungen; die Leiste 01–09 ist per Tastatur
  bedienbar und springt weich zum jeweiligen Zustand
- `prefers-reduced-motion`: Die Kamerafahrt wird gar nicht erst erzeugt –
  stattdessen stehen dieselben Inhalte ruhig untereinander, kein Lenis
- Ohne JavaScript greift dieselbe ruhige Fassung (`<noscript>`)
- Mobil gilt eine eigene, einfachere Komposition – dieselbe Erzählung,
  weniger gleichzeitig bewegte Ebenen
- Die Fahrt schreibt pro Bild nur `opacity`/`transform` (compositor-only);
  React rendert ausschließlich beim Zustandswechsel (7×)
