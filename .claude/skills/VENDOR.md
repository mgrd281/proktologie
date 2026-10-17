# Eingebundene Design-Skills – Herkunft und bewusste Abweichungen

Beide Skills sind **Projekt-Skills für Claude Code** (`.claude/skills/<name>/SKILL.md`). Claude Code
erkennt sie in jeder Sitzung in diesem Repository automatisch über ihre `description` und bietet
sie als `/impeccable` bzw. `/ui-ux-pro-max` an. Projektweite Regeln für ihren Einsatz stehen in
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

## Aktualisieren

Kein `npx`-Installer. Repository klonen, die oben genannten Pfade erneut kopieren, bei
ui-ux-pro-max die eine Pfadersetzung wiederholen, Commit und Datum hier eintragen, dann die
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
| Anthropic Frontend Design | nicht vorhanden, nichts entfernt | Impeccable baut darauf auf und deckt sie ab. |
