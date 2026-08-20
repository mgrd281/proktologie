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

## Das Filmwerk der Startseite (Master-Frame-Timeline)

Die Startseite ist EIN scrubbares Filmwerk aus **500 logischen Frames** –
sichtbar am durchlaufenden Zähler `FRAME 0173 / 0500` (TPL-Referenz,
dauerhaftes Gestaltungselement). Acht Hauptszenen + Termin-Finale:

```
01 Willkommen        Frames 001–055
02 Dr. Kunstreich    Frames 056–115
03 Leistungen        Frames 116–175   (Korridor – bleibt im Film)
04 Beschwerden       Frames 176–235   (+ Symptom-Zyklus als innere Tiefe)
05 Diagnostik        Frames 236–290   (echtes Untersuchungsraum-Foto, weit)
06 Behandlung        Frames 291–345   (dieselbe Quelle, Kamera an der Liege)
07 Warum diese Praxis / Team  346–430 (Untersequenz 01–06)
08 Praxis & Standort Frames 431–470
   FINAL Termin      Frames 471–500 → Release direkt in die Buchung
```

### Master-Fortschritt

```
progress     = clamp((scrollY − trackTop) / (trackHeight − viewport), 0, 1)
targetFrame  = 1 + round(progress · 499)
currentFrame += (targetFrame − currentFrame) · 0.12     ← EIN LERP, EIN rAF
```

Lenis (duration 1.2, exponentieller Ausklang) liefert das weiche
Scrollen; der eine Loop folgt ihm mit gewichteter Verzögerung. Roher
scrollY wird NIE direkt auf eine Transformation abgebildet. Alle Ebenen
sind **zustandslose Funktionen von currentFrame** – Rückwärts-Scrollen
kehrt Kamera, Blenden, Team-Fahrt, Bahn und Typografie exakt um
(getestet: Vorwärts- und Rückwärts-Sweep elementgleich; Pixel-Beweis im
Browser).

```
lib/cinema/frames.ts     Master-Timeline: Szenen, Blenden, Bänder, Anker
lib/cinema/sources.ts    Szenen-Quellen-Register (frames | still)
lib/cinema/camera.ts     cover + Pan/Zoom-Quellrechteck (reine Mathematik)
lib/cinema/timeline.ts   die Blenden-Primitiven (clamp/smoothstep/band/cycle)
components/cinema/
  MasterSequence.tsx     Track (1000vh), Bühne, DER eine Loop
  SceneCanvas.tsx        Compositor: zeichnet die aktiven Quellen (≤ 2)
  FrameCounter.tsx       FRAME 0173 / 0500 · SZENE (dauerhaft sichtbar)
  MasterRail.tsx         die Leiste 01–08 (Termin-Finale ist keiner)
  layers/…               Texte, Korridor, Zyklus, Team, Praxis, Termin
components/hero/sequence/frameStore.ts   parametrisierter Frame-Lader
```

### Szenen-Quellen: zwei Modi, kein Umbau bei echtem Material

```ts
type SceneSource =
  | { mode: "frames"; path(i); count; span }        // echte Bildsequenz
  | { mode: "still"; src; camera: CamKeyframe[] };  // Foto + Kamerafahrt
```

Heute ehrlich belegt: Szenen 01–04 trägt die abstrakte Lichtsequenz
(`public/hero-frames/`, 500 Platzhalter-Frames – finale Renders ersetzen
sie 1:1); Szenen 05–06 trägt das **echte Untersuchungsraum-Foto** als
EINE still-Quelle mit verketteter Kamera (weit → Diagnostik-Seite → nah
an der Liege) – die Grenze 05→06 ist dadurch eine durchgehende
Kamerabewegung, kein Schnitt; Szenen 07–Finale trägt das
Empfangs-Ambiente (DOM). Kamerafahrten in Stills bewegen NUR das Bild –
niemals gefälschte Gesichts- oder Handbewegung. Sobald kurze Motion-
Clips vorliegen (Frames extrahieren → skalieren → WebP →
`/sequence/desktop/frame_0001.webp …`), ersetzt eine frames-Quelle den
Still per Datenänderung in `sources.ts`. Wartende Bereiche sind dort
dokumentiert (001–115 Empfang/Arzt, 116–235 Praxisräume, 236–345
Untersuchungsraum in Bewegung, 406–500 Wartezimmer).

### Übergänge

An JEDER Szenengrenze überblenden beide Nachbarn über ein Fenster von
20 % der kürzeren Szenendauer (getestet: 15–25 %, Alpha-Summe nie < 0.98,
höchstens zwei Szenen aktiv, immer trägt eine Umgebung). Nie Weiß, nie
ein harter Austausch. Die grüne Bahn ist EIN Pfad, dessen Lage eine
Funktion des Master-Frames ist – sie verbindet Empfang, Arzt, Korridor,
Raum, Team und Buchung. Das Finale skaliert die Bühne nicht, sondern
löst sie in den Farbton der Kontakt-Sektion; die Buchungs-Vorschau
liegt ÜBER dem Release und übergibt als Match-Cut an die echte
BookingCard (`#kontakt` ist die erste Sektion nach Frame 500).

### Rendering & Performance

Der Compositor zeichnet pro Frame die aktiven Quellen mit
globalAlpha-Kreuzblende in EIN DPR-bewusstes Canvas (Deckel 1.5 –
die Quellen sind 1280–1536 px breit; Still-Zoom ≤ 1.22, sonst Matsch;
ein ≥ 2880-px-Re-Export des Raumfotos hebt den Deckel). Keine 500
<img>-Knoten, kein Text in Frames. Frame-Sequenzen laden nur auf großen
Zeigern ohne reduzierte Bewegung: Blobs komplett (Leiter-Frames zuerst),
dekodiert als dauerhafte Grob-Leiter (jeder 8., 640 px) plus
Voll-Fenster ±28 um den Playhead (LRU, ~240 MB Deckel). Stills zeichnet
auch das Telefon (960er-Varianten) – Static-Cinematic-Modus. Ferne
Quellen pausieren; IntersectionObserver + visibilitychange stoppen
Loop und Preload, wenn die Fahrt außer Sicht ist. Typografie, Team-
Karten, Korridor-Tafeln, Bahn und Chrome bleiben DOM (Hybrid – alle vom
SELBEN currentFrame getrieben); im Renderpfad stehen nur transform,
opacity, dataset und das quantisierte Bahn-`d`.

### Tests

```bash
node --experimental-strip-types --test lib/cinema/frames.test.mjs
node --experimental-strip-types --test lib/cinema/camera.test.mjs
node --experimental-strip-types --test lib/cinema/leistungen.test.mjs
node --experimental-strip-types --test lib/team/scene.test.mjs
```

Dazu die Browser-Suite (Chromium): Zähler monoton in BEIDE Richtungen,
Reverse-Nachweis (Layer-Opacities und Canvas-Pixel identisch bei
Rückkehr zum selben Frame), Szenen-Stichproben an allen Ankern und
Blenden, Trägheitsmessung, Mobil-Gate (keine Sequenz-Downloads),
reduzierte Bewegung.

## Der echte Untersuchungsraum (Szenen 05–06)

`public/images/untersuchungsraum-*.webp` – das vom Praxisinhaber
gelieferte Foto (grüne Liege, grünes Lichtband, Praxislogo am Monitor).
Der Compositor zeichnet es als weiche Rückwand (gedämpfte Kamera) plus
scharfe Ebene (volle Kamera + Zeiger-Parallaxe) – Weichzeichnung steckt
IM Asset. Austausch: die vier Dateien überschreiben (Details in
`public/images/README.txt`).

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
  cinema/       Das Filmwerk: Track, Compositor, Zähler, Leiste, Ebenen
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
