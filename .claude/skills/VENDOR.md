# Eingebundene Design-Skills – Herkunft und bewusste Abweichungen

Alle Skills hier sind **Projekt-Skills für Claude Code** (`.claude/skills/<name>/SKILL.md`). Claude Code
erkennt sie in jeder Sitzung in diesem Repository automatisch über ihre `description` und bietet
sie als `/<name>` an (`/impeccable`, `/ui-ux-pro-max`, `/frontend-design`, `/web-design-guidelines`,
`/react-best-practices`, `/ui-animation`). Alle sind reiner Text (Anleitungen und
Nachschlagewerke) – keine npm-Pakete, keine Hooks, keine MCP-Server, keine Programme, die beim
Laden starten. Projektweite Regeln für ihren Einsatz und die Rollenverteilung stehen in
`/CLAUDE.md`, die Gestaltungsregeln in `/DESIGN.md`, die Produktfakten in `/PRODUCT.md`.

## impeccable

| | |
|---|---|
| Quelle | https://github.com/pbakaus/impeccable |
| Stand | Commit `2f98774f86bc05563876643db37e6c37c322850f` (2026-10-14), Skill-Version 4.5.2 |
| Lizenz | Apache-2.0 – `LICENSE` und `NOTICE.md` liegen im Skill-Ordner |
| Übernommen | `plugin/skills/impeccable/SKILL.md` und `reference/` – **byte-gleich, unverändert** |
| Weggelassen | `scripts/` (Startskript `impeccable`, `impeccable.cmd`, Live-Browser-Skripte, Schriftindex), die Claude-Code-Hooks (`plugin/hooks/hooks.json`) und die vier Unter-Agenten (`plugin/agents/*`) |

**Warum weggelassen:** Das Startskript lädt beim ersten Aufruf ein vorkompiliertes Programm aus dem
Internet nach `~/.impeccable/bin` und führt es aus; die Hooks starten dieses Programm nach jedem
Bearbeiten einer Datei und bei jedem Sitzungsende. Ein Fremdprogramm, dessen Inhalt hier nicht
geprüft werden kann, widerspricht der Projektvorgabe „keine ungeprüften Installationsskripte".
Die Unter-Agenten rufen ausschließlich dieses Programm auf.

**Folge:** Die Skill arbeitet im von ihr selbst vorgesehenen Fallback („Launcher unavailable"):
Sie liest `PRODUCT.md` und `DESIGN.md` direkt und führt alle Befehle (`critique`, `audit`,
`polish`, `layout`, `typeset`, `adapt` …) als Anleitung aus. Nicht verfügbar sind nur die
programmgestützten Teile: der automatische Detektor (59 Regeln), `live`/`generate`
(Browser-Varianten), `pin`, `hooks`, `doctor` und Bildgenerierung über Unter-Agenten.

**Später nachrüsten (nur mit ausdrücklicher Freigabe):** `npx impeccable install --providers=claude --scope=project`
bzw. den Ordner `scripts/` und `plugin/hooks/hooks.json` übernehmen. Vorher die Programmversion
(`scripts/VERSION`) und ihre Prüfsumme gegen das Release vergleichen.

## ui-ux-pro-max

| | |
|---|---|
| Quelle | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| Stand | Commit `7246805992a42b7bba37d4cac83b01416f0c6c44` (2026-10-12), Version 2.15.0 |
| Lizenz | MIT – `LICENSE` liegt im Skill-Ordner |
| Übernommen | `.claude/skills/ui-ux-pro-max/` aus dem Repo: `SKILL.md`, `references/`, `data/`, `scripts/*.py` – byte-gleich |
| Geändert | **Nur** in `SKILL.md` der Plugin-Pfad `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py` → `.claude/skills/ui-ux-pro-max/scripts/search.py` (11 Stellen). Genau diese Ersetzung macht auch der offizielle Installer bei einer Projektinstallation (`cli/src/utils/template.ts`, `renderSkillFile`). |
| Weggelassen | `scripts/tests/` und die sechs Neben-Skills des Repos (banner-design, brand, design, design-system, slides, ui-styling) – nicht angefragt, kein Nutzen für dieses Projekt |

**Geprüft:** Die Python-Skripte nutzen nur die Standardbibliothek, haben keinen Netzwerkzugriff
und keine Systemaufrufe. Einziger Schreibzugriff ist die Option `--persist` (legt
`design-system/…/MASTER.md` an) – laut `/CLAUDE.md` in diesem Projekt **nicht** verwenden.
Benötigt `python3` (in der Cloud-Umgebung vorhanden).

## frontend-design

| | |
|---|---|
| Quelle | https://github.com/anthropics/skills (`skills/frontend-design`) |
| Stand | Commit `dbd4588f9e1033efb41dad4bef2f7947c8993d44` (2026-10-09) |
| Lizenz | Apache-2.0 – `LICENSE.txt` liegt im Skill-Ordner |
| Übernommen | `SKILL.md`, `LICENSE.txt` – **byte-gleich, unverändert** |

Gestaltungsrichtung für neue Oberflächen. Die Skill fordert ausdrücklich eigenwillige Schrift- und
Farbwahl; in diesem Projekt sind Marke, Schriften (Fraunces + Inter) und Farben aber gesetzt –
`/DESIGN.md` hat Vorrang (siehe `/CLAUDE.md`).

## web-design-guidelines

| | |
|---|---|
| Quelle | https://github.com/vercel-labs/agent-skills (`skills/web-design-guidelines`) |
| Stand | Commit `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28), Skill-Version 1.0.0 |
| Regeln | https://github.com/vercel-labs/web-interface-guidelines, Datei `command.md`, Commit `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05) → `guidelines.md`, **byte-gleich** |
| Lizenz | MIT – `LICENSE-guidelines` (Regeln, © Vercel Labs), `LICENSE-NOTE` (Skill; das Repo nennt MIT im README, eine eigene Lizenzdatei gibt es dort nicht) |
| Geändert | **Nur** in `SKILL.md` die Quellangabe (Zeilen 23, 26, 29, 34, 36): Statt bei jeder Prüfung die Regeln per WebFetch vom unversionierten GitHub-`main` zu laden, liest die Skill die gepinnte lokale Kopie `guidelines.md`. Grund: dieselbe Prüfung soll morgen dieselben Regeln anwenden, und fremder Text aus dem Netz soll nicht ungeprüft als Anweisung geladen werden. |

## react-best-practices (Aufruf `/react-best-practices`; in der Datei heißt sie `vercel-react-best-practices`)

| | |
|---|---|
| Quelle | https://github.com/vercel-labs/agent-skills (`skills/react-best-practices`) |
| Stand | Commit `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28), Skill-Version 1.0.0 |
| Lizenz | MIT (laut `SKILL.md` und README des Repos) – `LICENSE-NOTE` |
| Übernommen | `SKILL.md`, `AGENTS.md`, `rules/` (72 Dateien) – **byte-gleich, unverändert** |
| Weggelassen | `README.md`, `metadata.json` (nur Repo-Verwaltung) |

## ui-animation

| | |
|---|---|
| Quelle | https://github.com/mblode/agent-skills (`skills/ui-animation`) |
| Stand | Commit `81d0af2f6d4b32d791fb26caa82b17603ef4d807` (2026-10-17) |
| Lizenz | MIT, © 2026 Matthew Blode – `LICENSE` (Kopie der `LICENSE.md` des Repos) |
| Übernommen | `SKILL.md`, `references/` (18 Dateien) – **byte-gleich, unverändert** |
| Weggelassen | `scripts/` (Python-/ffmpeg-Skripte zum Vermessen von Bildschirmaufnahmen; brauchen `opencv-python`, `numpy`, `scipy`) und `evals/` (Testfälle der Skill) |

**Folge:** Der Abschnitt „Reverse-engineer workflow" in `SKILL.md` (Bewegung aus einem Video
vermessen) ist hier nicht ausführbar. Der Abschnitt zu Interface-Tönen (`interface-sfx.md`) gilt
in diesem Projekt nicht: **keine Töne** (siehe `/CLAUDE.md`). Die Skill verweist auf eine Skill
`ui-design`, die hier nicht installiert ist – stattdessen `/impeccable` bzw. `/DESIGN.md`.

## Aktualisieren

Kein `npx`-Installer. Repository klonen, die oben genannten Pfade erneut kopieren, bei
ui-ux-pro-max die eine Pfadersetzung und bei web-design-guidelines die Quellangabe wiederholen
(und `guidelines.md` neu aus `command.md` kopieren), Commit und Datum hier eintragen, dann die
Prüfschritte aus `/CLAUDE.md` („Design-Skills prüfen") ausführen.

## Geprüft, aber bewusst nicht installiert (17.10.2026)

Auftrag „Premium UI Components, Iconography & Appointment Systems“. Auf Wunsch des Betreibers
nur für dieses Praxis-Projekt bewertet; die Snapfly-Teile gehören in ein anderes Repository.

| Werkzeug | Ergebnis | Grund |
|---|---|---|
| shadcn/ui-Skill (`shadcn-ui/ui/skills/shadcn`, MIT, Commit d2fba50) | nicht installiert | `SKILL.md` führt beim Laden automatisch `npx shadcn@latest info --json` aus (unversioniertes Programm aus npm) und greift laut Beschreibung auch bei „DESIGN.md anwenden“. Setzt `components.json` und shadcn-Komponenten voraus, die es hier nicht gibt; ihre Regeln widersprechen dem bestehenden Code. Brauchbare Grundsätze stehen als eigene Regeln in `/DESIGN.md` (Buttons, Icons). |
| Lucide (ISC) | als Quelle, nicht als Paket | Neue Icons als Pfaddaten in die eigenen `Icon.tsx` übernehmen, Strich 1,6; kein `lucide-react`. |
| Phosphor Icons | übersprungen | Eine Icon-Familie pro Produkt. |
| Floating UI | übersprungen | Kein konkreter Bedarf; eigene, barrierefreie Dialoge/Menüs; native `popover`/`dialog` zuerst. |
| daisyUI | übersprungen | Würde das bestehende Designsystem doppeln. |
| FullCalendar | bewertet, nicht installiert | Cockpit hat einen eigenen Kalender. Möglich später für Woche/Monat mit Drag-&-Drop (Kern MIT; Ressourcen-Ansichten kostenpflichtig) – nur mit Zustimmung. |
| Cal.com | übersprungen | Eigene Buchung vorhanden; externer Dienst hieße Patientendaten an Dritte → erst AVV/DSGVO-Prüfung. |
| Medplum | übersprungen | Kein FHIR-/Klinikdaten-Bedarf. |

## Werkzeug-Übersicht (Auftrag „Elite Medical UX, Booking, Brand & Engineering", 17.10.2026)

Alle Quellen wurden geklont und gelesen, bevor entschieden wurde. Eingerichtet wurde nur, was reiner
Text ist und zu Stack und Marke passt.

| # | Werkzeug | Art | Entscheidung | Grund |
|---|---|---|---|---|
| 1 | Anthropic Frontend Design | Skill | **installiert** (`frontend-design`) | Richtung für neue Oberflächen; `DESIGN.md` hat Vorrang |
| 2 | UI/UX Pro Max | Skill | bereits installiert | siehe oben |
| 3 | Context7 | MCP-Server (externer Dienst) | nicht eingerichtet | Next.js-16-Doku liegt lokal in `node_modules/next/dist/docs` (siehe `cockpit/AGENTS.md`); ein Projekt-MCP fragt in jeder Sitzung nach Freigabe und schickt Suchanfragen an einen Fremddienst. Auf Wunsch nachrüstbar |
| 4 | Vercel Web Interface Guidelines | Skill | **installiert, Regeln gepinnt** (`web-design-guidelines`) | Prüfliste für UI-Code; lokale Regelkopie statt Live-Abruf |
| 4b | Vercel React Best Practices | Skill | **installiert** (`react-best-practices`) | Performance-Regeln für React/Next.js – genau dieser Stack |
| 5 | Playwright | Testwerkzeug | bereits installiert | `cockpit/e2e`, deckt auch die Website ab |
| 6 | Playwright MCP | MCP-Server | übersprungen | doppelt zu 5; startet ein unversioniertes `npx`-Paket |
| 7 | UI Animation (mblode) | Skill | **installiert ohne Skripte** (`ui-animation`) | Bewegungsregeln; Messskripte und Töne ausgeschlossen |
| 8 | Motion (motion.dev) | Laufzeit-Bibliothek | übersprungen | CSS-Übergänge und Web Animations reichen (`/MOTION_SYSTEM.md`); kein neues Paket |
| 9 | GSAP | Laufzeit-Bibliothek | übersprungen | wie 8; die Kamerafahrt läuft bereits ohne Bibliothek |
| 10 | Remotion-Skills | Skills (Video) | übersprungen | Videoproduktion nicht im Umfang; später eigener Arbeitsbereich |
| 11 | Rive | Laufzeit + Editor | übersprungen | keine interaktiven Vektoranimationen geplant; neues Paket |
| 12 | dotLottie | Laufzeit-Bibliothek | übersprungen | wie 11 |
| 13 | Brand-building-skills | Skills (Marketing) | übersprungen | Marke steht fest (`DESIGN.md`, `PRODUCT.md`); Marketing-Vorlagen laden zu erfundenen Aussagen ein |
| 14 | AgentsORG `.design` | Skill + eigenes Dateiformat | übersprungen | würde eine zweite, konkurrierende Designdatei neben `DESIGN.md` anlegen |
| 15 | Canvas Design (Anthropic) | Skill | übersprungen | erzeugt Plakate/Grafiken; keine statischen Grafiken im Umfang |
| 16–23 | shadcn, Lucide, Phosphor, Floating UI, daisyUI, FullCalendar, Cal.com, Medplum | – | unverändert | Bewertung im Abschnitt davor |
