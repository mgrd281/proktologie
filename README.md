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

### Der gebackene Film (public/sequence/)

Der Bildinhalt der GESAMTEN Fahrt sind **echte, offline gebackene
Frames** – wie in der TPL-Referenz, nur aus den realen Praxis-Assets:

```bash
npm i --no-save sharp          # bewusst keine Repo-Dependency
node scripts/bake-film.mjs     # rendert + prüft Stetigkeit + Gewicht
```

**Szene 01 „Willkommen"** trägt der weite Empfangsblick mit Logowand,
Tresenkurve und warmem Boden: `public/images/rezeption-2400.webp`,
erzeugt mit `node scripts/make-rezeption.mjs <foto.png>` (ersetzt die
fremde Wandschrift durch das echte Praxislogo und bringt das Bild auf
2400 px, damit der Dolly-in Reserve hat). Die Kamera fährt von Zoom 1.10
auf 1.30 nach vorn, während eine Lichtwelle über das grüne Band Richtung
Flur wandert.

**Szene 02 „Dr. Kunstreich"** trägt `public/images/flur-3400.webp` – ein
**unbearbeiteter** 4:3-Zuschnitt aus dem echten 4284×5712-Praxisfoto
(Blick über den geschwungenen Tresen auf die Glastüren mit der realen
grünen Wegeführung des Hauses), erzeugt mit

```bash
node scripts/make-still.mjs <foto.jpg> flur-3400 0.58 0.82 0.56 3400
```

– reiner Zuschnitt, keine Retusche. Die Fahrt läuft bis Zoom 2.05 mit
Drift nach rechts; weil die Quelle 3400 px breit ist, liegt der Deckel
ohne Hochskalierung bei 2.12. Das mitgelieferte Video (358×480) diente
nur als Bewegungsreferenz – gegen 1600 px wäre es das 4,5-fache
Hochskalieren gewesen.

**Die Übergabe ist eine Schärfeverlagerung, keine Kreuzblende.** Beide
Bilder zeigen denselben Raum von zwei Standpunkten; blendet man sie
direkt ineinander, entsteht zwangsläufig eine Doppelbelichtung – genau
das war als Geisterbild sichtbar. Der Bake legt den Softfokus aber
zuletzt auf das fertig komponierte Bild. Die Überlappung (Frames 60–80)
fällt deshalb mit `HANDOVER_BLUR` zusammen: In der Unschärfe verschmelzen
beide Ebenen zu einem weichen Feld, danach zieht Szene 02 allein wieder
scharf. Die Blende liegt bewusst **hinter** Szene 01 (die bei Frame 55
endet), damit der Empfang ungemischt bleibt.

Der erste Frame steht zusätzlich
als `<picture>` im ausgelieferten HTML: Das Canvas kann erst nach der
Hydration zeichnen, das Bild ist auf 4G rund vier Sekunden früher da. Bei
reduzierter Bewegung gewinnt dort ein 1×1-Pixel – es wird kein Filmmaterial
geladen.

Das Skript rendert `public/sequence/desktop/frame_0001…0500.webp`
(1600×900, ~11 MB gesamt) und `public/sequence/mobile/frame_0001…0250.webp`
(960×540, jeder 2. Master-Frame, ~3 MB) als EINE durchgehende
Kamerafahrt durch das echte Untersuchungsraum-Foto: aus tiefer
Unschärfe ankommen (dunkelgrün gegradet, Lichtschweif), Fokusfahrt,
scharf im Raum, Dolly zur grünen Liege, Rückzug ins helle
Empfangs-Ambiente, Cream. Dazu Filmkorn, Vignette, Markengrading –
alle Parameter sind smoothstep-Ketten über f, jeder Frame eine reine
Funktion seiner Nummer (Stetigkeit wird nach dem Rendern per
Nachbar-RMS geprüft). Alle Ebenen-Deckkräfte mischt das Skript in JS
auf Rohpuffern – sharps `ensureAlpha(t)` setzt keine verlässliche
Deckkraft.

**Keine erfundenen Menschen:** Kamerabewegung, Fokus und Licht sind
gebacken; menschliche Bewegung kommt später aus echten Video-Clips der
Praxis (mit Einverständnis der Gezeigten). Deren extrahierte Frames
ersetzen dann DIREKT die betreffenden Dateien in `public/sequence/`
(Bereiche in `lib/cinema/sources.ts` dokumentiert) – Dateitausch, kein
Code. Das Quellen-Register kennt weiter beide Modi:

```ts
type SceneSource =
  | { mode: "frames"; path(i); count; span; media }  // echte Bildsequenz
  | { mode: "still"; src; camera: CamKeyframe[] };   // Foto + Kamerafahrt
```

Kamerafahrten (im Bake wie in künftigen Stills) bewegen NUR das Bild –
niemals gefälschte Gesichts- oder Handbewegung.

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
die Quellen sind 960–1600 px breit; Still-Zoom ≤ 1.22, sonst Matsch;
ein ≥ 2880-px-Re-Export des Raumfotos hebt den Deckel). Keine 500
<img>-Knoten, kein Text in Frames. Die Film-Sequenz wählt sich per
Geräteklasse: < 768 px lädt die 250er-Mobilfassung (Fenster ±12),
alle anderen die 500er-Desktopfassung (Fenster ±24, Bitmaps ≈ 5.8 MB
→ ~320 MB Peak, TPL-Klasse); reduzierte Bewegung lädt KEINE Sequenz.
Blobs komplett (Leiter-Frames zuerst), dekodiert als dauerhafte
Grob-Leiter (jeder 8.) plus Voll-Fenster um den Playhead (LRU). Ferne
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
node --experimental-strip-types --test lib/booking/status.test.mjs
```

Dazu die Browser-Suite (Chromium): Zähler monoton in BEIDE Richtungen,
Reverse-Nachweis (Layer-Opacities und Canvas-Pixel identisch bei
Rückkehr zum selben Frame), Szenen-Stichproben an allen Ankern und
Blenden, Trägheitsmessung, Mobil-Gate (keine Sequenz-Downloads),
reduzierte Bewegung.

## Der echte Untersuchungsraum (Szenen 05–06)

`public/images/untersuchungsraum-*.webp` – das vom Praxisinhaber
gelieferte Foto (grüne Liege, grünes Lichtband, Praxislogo am Monitor).
Es ist das Herz des gebackenen Films: `scripts/bake-film.mjs` fährt mit
der Kamera hindurch (weit → Diagnostik-Seite → nah an der Liege).
Austausch: Foto-Dateien überschreiben (Details in
`public/images/README.txt`), dann den Bake neu laufen lassen – ein
≥ 2880-px-Re-Export erlaubt engere Einstellungen.

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
| `CockpitBookingProvider` (`NEXT_PUBLIC_BOOKING_PROVIDER=cockpit`) | `confirmed` | **Verbindlich**: echte freie Zeiten aus dem Praxis-Cockpit, atomare Vergabe, Bestätigung mit Kalendereintrag und Verwaltungslink. Braucht `NEXT_PUBLIC_COCKPIT_API`. Gilt nur, solange das Cockpit beim Laden „Website-Buchung live“ meldet (`lib/booking/status.ts`, ein `GET status` ohne Cookies, 4 s Frist) – nicht live, pausiert oder keine Antwort → Wunschtermin wie ohne Cockpit, bei Pause mit dem Hinweistext der Praxis. |
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

## Praxis-Cockpit (cockpit/)

Das Cockpit ist die Steuerzentrale der Praxis – ein **eigenes Projekt im
Unterordner `cockpit/`** mit eigener `package.json`, eigenem Vercel-Projekt
(Root Directory `cockpit`, Region `fra1`) und eigener Datenbank. Die
statische Website bleibt davon unberührt; die Verbindung entsteht erst in
Phase 1 über die öffentliche Buchungs-API.

**Stand: Phase 1 „Der Motor für die Öffentlichkeit“ – plus Chat-Assistent
und Anfragen-Posteingang.**

Phase 0 legte das Fundament: Anmeldung (nur per Einladung, Passkey + TOTP
Pflicht), Rollen, revisionssicheres Audit-Log, Terminmotor intern
(Terminarten, Sprechzeiten, Ausnahmen, Konflikt-Constraint in der Datenbank),
Kalender Tag/Woche/Agenda, Dashboard „Heute“, Einstellungen, Demo-Daten mit
Löschschalter.

Phase 1 öffnet diesen Motor für Patient:innen – die Website bucht jetzt
verbindlich statt anzufragen:

| Auslöser | Was automatisch passiert |
|---|---|
| Buchung auf der Website | Atomare Vergabe (`EXCLUDE`-Constraint), Referenz `PE-…`, Bestätigung per E-Mail mit **.ics-Kalendereintrag** und persönlichem Verwaltungslink |
| 48 h und 24 h vorher | Erinnerung mit Ein-Klick-Bestätigung |
| Patient:in sagt ab oder verschiebt | Sofort frei, neue Kalenderdatei (`SEQUENCE`+1) bzw. `METHOD:CANCEL` |
| Ein Platz wird frei | Erste passende Person der Warteliste bekommt ihn reserviert (Standard 4 h), nimmt sie nicht an, rückt die nächste nach |
| Täglich (Vercel Cron, `cockpit/vercel.json`) und alle 15 Minuten (GitHub Actions, `.github/workflows/cockpit-tick.yml`) | Herzschlag `/api/internal/tick` – dazu ein Tick aus jeder Buchung, Absage und Wartelisten-Aktion sowie gedrosselt aus jedem Cockpit-Seitenaufruf. Ohne GitHub-Variable laufen Erinnerungen als Morgen-Stapel; Angebote und Freigaben sofort. |

Öffentliche API (CORS nur für die konfigurierten Website-Ursprünge):
`GET status · appointment-types · availability`, `POST bookings · waitlist ·
manage`. Missbrauchsschutz ohne Fremd-Dienste: Honigtopf, HMAC-Formular-Token
(frühestens nach 3 s gültig, 30 min Frist), Rate-Limit in der Datenbank mit
Tagessalz statt roher IP, Obergrenze offener Termine je E-Mail-Adresse.

Die Website wird mit `NEXT_PUBLIC_BOOKING_PROVIDER=cockpit` +
`NEXT_PUBLIC_COCKPIT_API` gebaut (Vercel: nur Production). Ob sie
verbindlich bucht, entscheidet dann das Cockpit: Die Terminkarte fragt beim
Laden einmal `GET /api/public/v1/status` ab (ohne Cookies, 4 s Frist). Nur
„live und nicht pausiert“ schaltet auf `mode: "confirmed"`; nicht live,
pausiert oder keine Antwort → Wunschtermin wie ohne Cockpit, bei Pause mit
dem Hinweistext der Praxis. Der Status ist an der Kante 60 s zwischengespeichert –
nach dem Umlegen folgt die Website innerhalb weniger Minuten; jede Buchung
wird serverseitig erneut geprüft (`not_live`/`paused` → 503). Der Schalter
„Website-Buchung live“ im Cockpit lässt sich erst umlegen, wenn keine
Demo-Zeile mehr existiert.

### Chat-Assistent

Unten rechts auf jeder Seite ein runder Knopf. Er vereinbart echte Termine
über denselben Motor wie die Terminkarte und beantwortet Fragen zur Praxis –
auf Deutsch und Englisch, in der Sie-Form.

**Der Ablauf ist ein Automat, kein Sprachmodell.** Buchung, Verfügbarkeit,
Zusammenfassung und Bestätigung entscheidet ausschließlich der Code. Das
Modell wird an zwei Stellen gefragt, und beide Male ist seine Antwort nur ein
Vorschlag: eine freie Nachricht einordnen (striktes JSON gegen Zod; genannte
Daten und Uhrzeiten werden anschließend gegen die eigenen Parser
gegengeprüft, erfundene Termine kommen so nicht durch) und eine Antwort aus
gepflegten Fakten umformulieren (jede Zahl der Antwort muss in den Fakten
vorkommen, sonst gilt der Faktentext). Ohne erreichbaren Anbieter
funktioniert jeder Weg über Schaltflächen unverändert weiter.

**Was das Modell nie zu sehen bekommt.** Name, E-Mail und Telefonnummer
werden über beschriftete Formularfelder erfasst und gehen direkt an die
Buchung; der Typ `ModelView` hat für sie kein Feld. Freitext wird vorher
maskiert (E-Mail, Telefon, Versichertennummer, IBAN), und Gesundheitsangaben
werden abgefangen, bevor irgendein Aufruf entsteht. Grund: Die kostenlosen
Anbieter (NVIDIA, OpenRouter; USA) haben keinen Auftragsverarbeitungsvertrag.

**Sicherheit vor allem anderen.** Die Notfallerkennung läuft in der Route
vor Zählung, Datenbank und Modell – 112 und 116 117 erscheinen auch dann,
wenn der Chat abgeschaltet ist oder das Limit erreicht wurde; danach
verschwindet das Eingabefeld. Medizinische Fragen bekommen einen
vorgegebenen Satz und keinen Modellaufruf. Nach Symptomen, Diagnosen,
Medikamenten oder der Versichertennummer wird nie gefragt.

**Nichts wird gespeichert.** Der Verlauf liegt in `sessionStorage` des
Browsers, nicht auf dem Server: Ein Seitenwechsel behält ihn, das Schließen
des Tabs löscht ihn. Dauerhaft entstehen nur Buchungen und Rückrufbitten –
verschlüsselt, wie beim Formular. Was die Praxis nicht in
`cockpit/content/praxis-wissen.ts` hinterlegt hat, beantwortet der Assistent
mit „das weiß ich leider nicht“ und der Telefonnummer; Sprechzeiten kommen
live aus der Datenbank, damit Chat und Buchung nie auseinanderlaufen.

Grenzen: 20 Nachrichten je Sitzung, 120 je Stunde und IP, 3 Buchungen je
E-Mail-Adresse und Kalendertag. Abschalten unter *Einstellungen →
Demo & Betrieb*; das Fenster zeigt dann nur Telefonnummer und Sprechzeiten.

### Anfragen-Posteingang

Alles, was kein Termin ist: Rückrufbitten aus dem Chat, Folgerezepte,
Überweisungen, Befundkopien – mit Frist, Stand und verschlüsselten
Kontaktdaten. Jede Anfrage von außen löst eine kurze Meldung an die Praxis
aus (`EMAIL_PRACTICE_TO`); im Cockpit angelegte Zeilen bleiben still.

Noch offen (als ehrlich beschriftete Platzhalter angelegt):
Website-Steuerung, Aufnahmebogen, Statistik.

```bash
cd cockpit
npm install
cp .env.example .env.local      # Schlüssel erzeugen: openssl rand -base64 48 / 32
npm run dev                     # PGlite unter .pglite/dev – kein Postgres nötig
npm run db:bootstrap-admin      # ersten Administrator anlegen (einmalig)
npm test                        # Node-Suiten: Tokens, Krypto, Terminmotor, DB-Integrität
npm run e2e                     # Playwright: startet Cockpit UND Website und bucht wirklich durch
                                # (CHROME_PATH setzen; Mails landen als JSON in .mail-outbox-e2e/)
```

Die Browser-Suite deckt drei Wege ab: das Team (Einladung → Passkey → TOTP →
Termin → Anfragen-Posteingang), die Patientin am Formular (Website →
verbindliche Buchung → Bestätigungsmail mit .ics → bestätigen → absagen →
Wartelisten-Angebot → annehmen) und die Patientin im Chat (`public-chat.spec.ts`,
sechzehn Abnahmefälle vom Notfall bis zum Abschalter), dazu Missbrauchsschutz,
CORS und drei Axe-Prüfungen. Das Sprachmodell ist dabei gestellt
(`e2e/fake-llm.mjs`, OpenAI-kompatibel, Modi `ok|fail|timeout|hallucinate`);
es zählt seine Aufrufe mit, damit auch beweisbar ist, was *nicht* passiert –
bei Notfall und medizinischer Frage wird es kein einziges Mal gefragt.

Grundsätze, die im Code erzwungen werden:

- **Keine erfundenen Menschen.** Konten entstehen nur per Einladung, den
  Namen trägt die Person selbst ein. Demo-Daten tragen `is_demo`, sind mit
  einem Klick löschbar, und `booking_live` lässt sich erst einschalten, wenn
  keine Demo-Zeile mehr existiert.
- **Personenbezug verschlüsselt.** Namen, Kontaktdaten und Notizen liegen
  als AES-256-GCM-Umschlag mit Datensatzbindung (AAD) in `*_enc`; gesucht
  wird über HMAC-Blind-Indizes. Schlüssel `DATA_KEY_V<n>`, Rotation über
  eine neue Version.
- **Doppelbuchung ist unmöglich.** Ein `EXCLUDE`-Constraint auf
  `tstzrange(starts_at, blocks_until)` sperrt überlappende aktive Termine
  auf Datenbankebene – auch bei parallelen Anfragen.
- **Audit-Log nur INSERT.** Ein Trigger verweigert UPDATE/DELETE, jede Zeile
  ist per Hash mit der Vorgängerin verkettet.
- **Keine Tokens in URLs.** Einladungs- und Termin-Links tragen ihr Token im
  Fragment (`/t/#…`); die Seite schickt es per POST – es erreicht weder
  Server-Logs noch Referrer.
- **E-Mails ohne Medizin.** Bestätigungen, Erinnerungen und Absagen nennen
  Terminart, Zeit, Ort und Referenz – auf Deutsch oder Englisch, je nachdem,
  in welcher Sprache gebucht wurde (`appointments.locale`). Vorbereitungs-
  hinweise kommen ausschließlich aus Vorlagen, die die Praxis selbst pflegt.
- **Kein Personenbezug zum Sprachmodell.** Der Typ, den das Modell zu sehen
  bekommt, hat kein Feld für Name, E-Mail oder Telefon; Freitext wird vorher
  maskiert und auf Gesundheitsangaben geprüft. Zwei Tests im
  Gesprächsablauf sind reine Kanarienvögel: Sie legen Kontaktdaten an und
  prüfen, dass sie in keinem Modellaufruf auftauchen.
- **Nur `:free` bei OpenRouter.** Modell-Ids ohne dieses Suffix werden
  verworfen – geprüft beim Lesen der Kette und noch einmal unmittelbar vor
  dem Netzaufruf. Ein Anbieter ohne Schlüssel wird ohne Netzaufruf
  übersprungen.
- **Kein Versand ohne Schlüssel.** Ohne `EMAIL_API_KEY` läuft der
  Protokoll-Kanal: Nichts verlässt das System, jede Nachricht steht mit
  Zeitpunkt und Status unter *Einstellungen → Demo & Betrieb*.
- **Markentokens gespiegelt.** `cockpit/app/tokens.css` kopiert den
  `@theme`-Block dieser Website; `lib/design/tokens.test.mjs` schlägt bei
  Abweichung fehl.

Betrieb (Schritte der Praxis, nicht des Codes): Vercel-Projekt mit Root
Directory `cockpit` und Region `fra1`; Postgres in `eu-central-1`
(`DATABASE_URL`, z. B. über die Neon- oder Supabase-Integration aus dem
Vercel-Marketplace); `BETTER_AUTH_SECRET`, `DATA_KEY_V1`, `INDEX_KEY`,
`COCKPIT_URL` (Passkeys binden sich an dessen Hostname); Migrationen per
`npm run db:migrate`, erster Admin per `npm run db:bootstrap-admin`.

**Marketplace-Datenbanken sind "sensitive":** Ein über die Vercel-Integration
angelegtes `DATABASE_URL` lässt sich nach dem Speichern durch niemanden mehr
auslesen – auch nicht über die API oder `vercel env pull`. Die beiden
Skripte oben brauchen die Variable dann lokal, wo sie nicht existiert.
Für genau diesen Fall gibt es per Geheimnis abgesicherte Routen, die
innerhalb der laufenden Vercel-Funktion arbeiten: `POST /api/internal/migrate`
(`MIGRATE_SECRET`), `POST /api/internal/bootstrap-admin`
(`BOOTSTRAP_ADMIN_EMAIL`/`_SECRET`, kein Body) und
`POST /api/internal/settings` (`MIGRATE_SECRET`, Body
`{ bookingLive?, bookingPaused?, bannerText?, chatEnabled? }` – schaltet die Online-Buchung
über denselben `updateSettings`-Weg wie das Cockpit, samt Demo-Sperre und
Audit; Antwort ist der öffentliche Status). Alle antworten ohne
konfiguriertes Geheimnis mit 404; `bootstrap-admin` verweigert sich
zusätzlich dauerhaft, sobald ein erstes Konto existiert.

Vor dem ersten echten Patientendatensatz: DSB-Freigabe und DSFA, AVVs mit
Vercel und dem Datenbank-Anbieter, Datenschutzerklärung ergänzen (siehe
Plan im PR).

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
