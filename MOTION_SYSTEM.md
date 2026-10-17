# Motion System – Proktologie Eimsbüttel

Bestandsaufnahme und Regeln für Bewegung in Website und Cockpit. Grundlage für `/ui-animation`
und `/impeccable`. Bei Widerspruch gilt diese Datei vor jeder Skill; Farben, Schriften und
Komponenten stehen in `DESIGN.md`.

> Stand: 17.10.2026 – beschreibt, was im Code **tatsächlich** vorhanden ist. Neue Bewegung nur
> nach diesen Regeln. Einzige Animationsbibliothek ist **Motion für React** (Paket
> `framer-motion`, MIT, vom Betreiber am 17.10.2026 freigegeben) – keine weitere (GSAP, Rive,
> Lottie …) ohne Zustimmung.

## Haltung

Bewegung erklärt, sie unterhält nicht. Unsere Besucherinnen und Besucher sind oft verunsichert,
viele sind älter, viele lesen auf dem Handy. Darum:

1. **Ruhe vor Effekt.** Eine Bewegung muss eine Frage beantworten: *Woher kommt das? Was hat sich
   geändert? Wo bin ich?* Sonst weglassen.
2. **Nie Pflicht.** Jeder Inhalt ist ohne Bewegung und ohne JavaScript vollständig sichtbar und
   bedienbar.
3. **Keine Töne.** Keine Klick-, Hinweis- oder Erfolgsgeräusche – weder auf der Website noch im
   Cockpit. (Der Chat-Assistent spricht nur, wenn die Person die Sprachfunktion selbst startet.)
4. **Kein Wackeln, Hüpfen, Blinken** an Gesundheitsinhalten, Preisen, Fehlermeldungen oder
   Notfallhinweisen.

## Tokens

| Token | Wert | Wo | Einsatz |
|---|---|---|---|
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | `app/globals.css`, `cockpit/app/tokens.css` | Standard-Kurve für alles, was hereinkommt |
| `ease` / `ease-in-out` | Browser-Standard | Website | nur Farb-/Deckkraftwechsel und Endlos-Hinweis |
| Kurz | 150–200 ms | Tailwind `duration-150/200` | Hover, Farbe, kleine Zustände |
| Mittel | 280–320 ms | `rise-in`, `slide-in-right`, `step-in`, `menu-in`, `duration-300` | Dialog, Drawer, Toast, Buchungsschritt, Handy-Menü |
| Lang | 500–700 ms | `reveal-in`, `beat-label`, `team-veil`, `duration-500/700` | Einblendung beim Scrollen, Filmszenen |
| Scroll-Glättung | Lenis, `duration: 1.2`, Exponential-Kurve | `providers/LenisProvider.tsx` | nur Startseiten-Kamerafahrt; bei reduzierter Bewegung gar nicht gestartet |
| Film-Nachlauf | `LERP = 0.12` pro Bild | `lib/cinema/frames.ts` | eine einzige rAF-Schleife folgt dem Scrollen |

Neue Werte nur, wenn keiner der vorhandenen passt – dann hier eintragen.

## Motion (Bibliothek)

- **Wo:** nur Website, derzeit nur `components/booking/StepFrame.tsx` (Schritte der
  Buchungskarte). Nicht im Cockpit.
- **Wie:** Import aus `framer-motion` (nicht aus `motion/react`: dessen Sammel-Import zieht die ganze
  Bibliothek in die Startseite, +45 statt +17 KB gzip); `LazyMotion` (strict) mit `m`-Komponenten,
  Funktionspaket über `lib/motionFeatures.ts` nachgeladen. Keine `motion.*`-Komponenten.
- **Werte:** dieselben Tokens wie oben – `ease-out-soft` als `[0.22, 1, 0.36, 1]`, Eintritt 280 ms,
  Austritt 180 ms, Versatz 24 px, keine Federn.
- **Reduzierte Bewegung:** `useReducedMotion()` → Dauer 0, kein Versatz; das statische HTML zeigt
  den Endzustand (`initial={false}`).
- **Ausblendende Inhalte** sind `inert` (nicht antippbar, nicht fokussierbar, für Screenreader weg).
- **Positionierte Ebenen** (`relative`) mit bewegtem Inhalt brauchen einen deckenden Hintergrund
  hinter dem Text, sonst glättet Chrome Schrift nur in Graustufen (`bg-white bg-clip-content`).

**Animiert werden nur `transform` und `opacity`** (Ausnahmen bestehen bereits: `stroke` der grünen
Bahn, `color`/`text-shadow` der Filmbeschriftung). Kein `filter: blur()` und kein
`backdrop-filter` auf bewegten Ebenen – Tiefenschärfe läuft über Schleier mit reiner Deckkraft
(`data-blur`, siehe `.team-veil`, `.cinema-panel-veil`).

## Bestand – Website

| Bewegung | Umsetzung | Dauer / Kurve | Reduzierte Bewegung | Ohne JS |
|---|---|---|---|---|
| **Kamerafahrt** durch die Praxis (Startseite) | `components/cinema/MasterSequence.tsx`: 500 Bilder (Handy 250), Spur 1000vh (Handy 500vh), Scroll → Bildnummer, ein rAF mit LERP | folgt dem Scrollen | Spur ausgeblendet (`motion-safe:block`), stattdessen Standbild (`cinema-still`, `<source media="(prefers-reduced-motion: reduce)">`) und statische Fassungen (`CinemaStatic`, `HeroStatic`, `TeamStatic`) | Standbild + Beat 1 sichtbar |
| Beat-Beschriftung („0X — …") | `.beat-label-enter` | 0,5 s `ease-out-soft` | aus | Beat 1 sichtbar |
| Team-Bühne / Leistungs-Korridor | `TeamStage`, `LeistungenLayer`: Tiefe über `transform` + Schleier | Schleier 0,5–0,6 s | statische Fassung | statische Fassung |
| Scroll-Hinweis | `.animate-scroll-cue` | 2,2 s `ease-in-out`, endlos | eine Runde, dann still | – |
| Einblendung beim Scrollen | `components/ui/Reveal.tsx` (IntersectionObserver, einmalig), `.reveal-init` → `.reveal-in` | 0,7 s `ease-out-soft`, Staffelung über `--reveal-delay` | nie versteckt | sichtbar (Ausblendung erst nach dem Laden) |
| Buchungsschritte | Motion, `StepFrame`: neuer Schritt von rechts herein, alter nach links hinaus (zurück: umgekehrt); Kartenhöhe gleitet mit | 280 ms herein / 180 ms hinaus, 24 px, `ease-out-soft` | sofortiger Wechsel | erster Schritt sichtbar |
| Kalendermonat, Rückruf | `.animate-step-in` | 0,3 s `ease-out-soft`, 10 px nach oben | aus | – (Buchung braucht JS) |
| Handy-Menü | `.animate-menu-in` nur unter `prefers-reduced-motion: no-preference` | 320 ms `ease-out-soft` | keine Animation | – |
| Buchungskarte, Schrittwechsel (nur Handy) | `BookingCard`: Lenis `scrollTo(Karte)` mit Header-Abstand, ein Bild verzögert (Scroll Anchoring) | Lenis 1,2 s | Sprung statt Fahrt | – |
| Hover/Farbe | `transition-colors`, `duration-200/300` | kurz | aus | – |
| Chat: „hört zu" / Sprechtaste | `animate-pulse`, `motion-safe:animate-pulse` | Tailwind-Standard | aus | – |

Global in `app/globals.css`: unter `prefers-reduced-motion: reduce` werden alle Animationen und
Übergänge auf 0,01 ms gesetzt; Druckansicht zeigt alle Reveal-Inhalte.

## Bestand – Cockpit

| Bewegung | Umsetzung | Dauer / Kurve | Einsatz |
|---|---|---|---|
| `rise-in` | `cockpit/app/globals.css` | 0,28 s `ease-out-soft`, 6 px | Dialog, Toast, Anmeldekarte, Befehlspalette |
| `slide-in-right` | `cockpit/app/globals.css` | 0,32 s `ease-out-soft`, 16 px | Drawer von rechts |
| `skeleton` (Shimmer) | `cockpit/app/globals.css` | 1,6 s linear, endlos | Ladeplatzhalter |
| `animate-spin` | Tailwind | Standard | Lade-Symbol in Buttons und Terminverwaltung |
| Hover/Farbe | `duration-150/200/300` | kurz | Listen, Buttons |

Auch im Cockpit schaltet `prefers-reduced-motion: reduce` alles global ab. Grundsatz Cockpit:
**Tempo vor Ausdruck** – keine Bewegung, die eine Eingabe verzögert.

## Regeln für neue Bewegung

1. **Erst fragen, ob es sie braucht.** Häufig benutzte Aktionen (Cockpit-Listen, Formular-Tippen)
   bekommen keine oder nur 150–200 ms Farbbewegung.
2. **Eintritt ≤ 320 ms, Austritt kürzer oder gar keiner.** Kurve `--ease-out-soft`. Keine
   Federn mit sichtbarem Überschwingen.
3. **Wege kurz halten:** 6–24 px Versatz, keine Drehungen, kein Skalieren über 1.
4. **Zustand vor Bewegung:** Erst stimmt der Inhalt (Text, Fokus, `aria-live`), dann läuft die
   Bewegung. Fokus springt nie in ein noch animierendes Element, das danach verschwindet.
5. **Reduzierte Bewegung:** entweder nur unter `prefers-reduced-motion: no-preference` einschalten
   (Muster `animate-menu-in`) oder sich auf die globale Abschaltung verlassen – und in beiden
   Fällen prüfen, dass das Endbild ohne Animation stimmt.
6. **Ohne JavaScript:** Ausgangszustand im HTML ist der sichtbare Endzustand; erst Script blendet
   aus (Muster `Reveal`). Nichts darf ohne JS unsichtbar bleiben.
7. **Endlos-Animationen** nur als Lade- oder Zuhör-Hinweis, nie als Schmuck; höchstens eine
   gleichzeitig im Blickfeld.
8. **Kamerafahrt** ist der einzige große Bewegungsmoment der Website. Weitere scroll-gesteuerte
   Effekte nicht daneben stellen.
9. **Leistung:** 60 fps auf einem Mittelklasse-Handy; keine Layout-Eigenschaften (`top`, `height`,
   `width`, `margin`) animieren; `will-change` nur auf tatsächlich bewegten Ebenen.
   **Einzige Ausnahme:** die Höhe der Buchungskarte (ein Element, 280 ms) – bei FLIP-Technik
   stünde der Inhalt unter der Karte sofort am neuen Platz und würde überdeckt.

## Prüfen

- Handy 390×844 und 360×780, Desktop 1366×768: Bewegung flüssig, nichts springt.
- Systemeinstellung „Bewegung reduzieren" an: keine Fahrt, keine Einblendungen, alles sichtbar.
- JavaScript aus: alle Inhalte sichtbar.
- Playwright-Tests im Cockpit (`cockpit/e2e`) bestehen weiterhin.
