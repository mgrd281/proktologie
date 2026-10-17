# Terminbuchung – Architektur, Ist-Zustand und offene Entscheidungen

> Bestandsaufnahme vom 17.10.2026, nur lesend aus dem Code erhoben (Pfade mit Zeilen) und an
> der echten Route geprüft. **Nichts davon ist ein Umsetzungsauftrag** – jede Änderung erst nach
> Freigabe des Betreibers. Datenschutz-Sicht: `docs/PRIVACY_SECURITY_CHECKLIST.md`.
> Darstellungsregeln: `DESIGN.md` → „Termin-UX".

## 1. Kurzfassung

- Die Praxis hat eine **eigene** Buchung: Website-Karte → öffentliche API des Cockpits →
  Postgres (Neon). Kein externer Buchungsdienst, keine Verbindung zu Doctolib.
- **Live geprüft:** Die Website ist mit `bookingProvider:"cockpit"` gebaut, das Cockpit meldet
  `GET /api/public/v1/status` → `bookingLive: true, bookingPaused: false`. Online-Buchungen sind
  also **verbindlich** („Termin verbindlich gebucht").
- Ist das Cockpit pausiert, nicht live oder nicht erreichbar, fällt die Karte automatisch auf den
  **Wunschtermin per E-Mail-Entwurf** (`mailto:`) zurück (`lib/booking/provider.ts:51-70`,
  `lib/booking/status.ts`).
- Doppelbuchungen verhindert die **Datenbank** selbst (EXCLUDE-Regel), nicht die Oberfläche.

```
Website (statisch, Vercel)                    Cockpit (Next.js, Vercel fra1)           Neon Postgres
BookingCard ─ GET status / appointment-types ─▶ /api/public/v1/*  ─ generateSlots ─────▶ appointments
            ─ GET availability (Monat)       ─▶  (CORS-Liste,        (engine.ts)          opening_hours
            ─ POST bookings                  ─▶   Formular-Token,  ─ insert ─────────────▶ calendar_exceptions
                                                  Ratenbegrenzung)  ─ Job: Mail + ICS ───▶ jobs → Brevo
Praxisteam ◀───────── Cockpit-Kalender (Tag/Woche/Agenda), Anfragen, Warteliste ─────────▶ audit_log
```

## 2. Datenmodell (`cockpit/lib/db/schema.ts`, `cockpit/drizzle/`)

| Tabelle | Wichtig |
|---|---|
| `appointments` | `starts_at`/`ends_at` (UTC), `buffer_min`, `status`, `source` (web, cockpit, telefon, chat), `ref` „PE-XXXX", `type_id`; Kontaktdaten/Notiz verschlüsselt + Blindindex. Dauer = Dauer der Terminart. |
| `appointment_types` | 7 Arten (15–30 min, Puffer 0), `visibility` öffentlich/intern, `lead_time_hours` (Standard 24), `max_ahead_days` (Standard 56). `capacity`, `prep_template_id` ungenutzt. |
| `opening_hours` | Wochentag + Von/Bis; Gültigkeitsdaten im Modell, aber nicht pflegbar. |
| `calendar_exceptions` | `closed`, `blocker`, `urlaub`, `extern` (z. B. Zeiten, die über Doctolib vergeben sind – **von Hand** einzutragen). |
| `waitlist`, `requests` | Warteliste (Angebot mit Haltezeit) und Anliegen (Rückruf, Folgerezept, Überweisung, Befundkopie, Sonstiges). |
| `practice_settings` | Raster 15 min, `booking_live`, `booking_paused`, Erinnerungen 48 h/24 h, max. 2 offene Termine je E-Mail. |
| `audit_log`, `jobs`, `messages`, `rate_limits` | Protokoll (nur anfügen), Warteschlange, Versandlog ohne Inhalt, Missbrauchsschutz. |

**Doppelbuchungsschutz** (`cockpit/drizzle/0001_constraints_and_seed.sql:23-26`):
`EXCLUDE USING gist (tstzrange(starts_at, blocks_until, '[)') WITH &&)` für die Status
`booked`, `confirmed`, `reminded`; `blocks_until = ends_at + buffer_min` per Trigger. Die
gesamte Praxis gilt als **eine** Ressource (keine Spalte für Arzt oder Raum).

**Statuswerte:** `booked` → `confirmed` (Patient/Praxis bestätigt das Erscheinen) →
`reminded` → `completed` / `no_show` / `cancelled`. Nur als TypeScript-Typ, in der Datenbank
freier Text ohne Prüfregel; keine Übergangsregeln.

## 3. Verfügbarkeit (`cockpit/lib/booking/engine.ts`, `repo.ts:236-286`)

- Raster `slotStepMin` innerhalb der Sprechzeiten; Dauer + Puffer müssen vor Ende passen.
- Belegt: aktive Termine (inkl. Puffer), `blocker`/`extern`-Ausnahmen; `closed`/`urlaub`
  schließt den ganzen Tag.
- Frühestens jetzt + 24 h (Standard) → **kein Online-Termin am selben Tag**; spätestens + 56 Tage.
- Zeitzone: alles in **Europe/Berlin** gerechnet, UTC gespeichert (`cockpit/lib/time.ts`);
  Zeitumstellung getestet (`engine.test.mjs`). Kalenderdateien mit `TZID=Europe/Berlin`.

## 4. Ablauf einer Online-Buchung (`cockpit/lib/booking/public.ts:102-200`)

1. Felder: Terminart, Datum, Uhrzeit, Vor-/Nachname, E-Mail, Telefon, Einwilligung,
   Formular-Token (3 s–30 min), Honigtopf. **Kein Freitext, keine Gesundheitsfragen.**
2. Ratenbegrenzung (6/h je IP) → Buchung live? → Terminart öffentlich? → Zeit **neu berechnet**
   und noch frei? → höchstens 2 offene Termine je E-Mail.
3. Einfügen als `booked`; bei gleichzeitiger Buchung greift die Datenbank (Fehler 23P01 →
   409 „Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.").
4. Erfolg erst nach Serverantwort: „Termin verbindlich gebucht", Referenz „PE-…".
5. Bestätigungs-Mail mit Kalenderdatei über die Warteschlange (Brevo); Link zum Verwalten
   (`/t/#<token>`, Token nur im Fragment) für Bestätigen, Verschieben, Absagen.
6. Erinnerungen 48 h und 24 h vorher (Takt alle 15 min per GitHub Actions + täglich per Vercel).

## 5. Praxisseite

- Rollen Arzt, Empfang, Admin; Passkey **und** TOTP Pflicht. Einstellungen/Terminarten/
  Sprechzeiten nur Arzt/Admin; Termine, Anfragen, Warteliste **alle Rollen**.
- Kalender: Tag, Woche, Agenda – **keine Monatsansicht, kein Ziehen zum Verschieben**
  (Verschieben über Formular mit freien Zeiten).
- Praxis-Termine (Telefon) prüfen nur Überschneidung, nicht Urlaub/Sperrzeit/Vorlauf.

## 6. Doctolib, Telefon, Notfall

- Doctolib: nur Link auf das Profil; im Cockpit-Modus ausgeblendet; **nie synchronisiert**.
  Schutz gegen Doppelvergabe nur durch von Hand eingetragene `extern`-Zeiten.
- Telefon 040 490 80 21 in Fehlermeldungen, Mails, Verwaltungsseite und als Ausweg, wenn die
  Buchung nicht lädt.
- Notfall: Chat erkennt Notfälle vor allem anderen und verweist auf 112 / 116 117. Die
  Buchungskarte selbst hat keinen Notfallhinweis (nur der Kontaktbereich).

## 7. Lücken – nach Wirkung sortiert

| # | Lücke | Folge | Fundstelle |
|---|---|---|---|
| 1 | Terminart (z. B. „Hämorrhoiden") in **Mail-Text, Praxis-Betreff und Kalendertitel** | Gesundheitsangabe in Postfächern und Kalendern | `templates.ts:138-229`, `send.ts:81` |
| 2 | Buchung, Protokoll und Mail-Auftrag **nicht in einer Transaktion** | Termin existiert, Patient sieht aber Fehler; evtl. keine Bestätigung | `repo.ts:426-443` |
| 3 | Keine Wiederholungs-Kennung (Idempotenz) | Verbindungsabbruch + erneuter Klick → „Zeit vergeben"/„zu viele" für den eigenen Termin | `public.ts`, `StepConfirm.tsx:84` |
| 4 | Doppelte Bestätigungs-Mail möglich (Chat sendet direkt **und** Warteschlange) | zwei Mails | `chat/route.ts:183-196`, `repo.ts:837-868` |
| 5 | Abgelaufene Warteliste-Reservierungen blockieren weiter bis zum nächsten Takt | freie Zeit bis 15 min unsichtbar; abgelaufenes Angebot noch annehmbar | `repo.ts:236-243`, `public.ts:243-279` |
| 6 | Urlaub/Sperrzeit gilt nicht für Praxis-Termine und automatische Warteliste-Angebote | Termin im Urlaub möglich | `repo.ts:386-394`, `lifecycle.ts:59-78` |
| 7 | Keine Zeitlimits für Aufrufe Website→Cockpit, Brevo, Datenbank | hängende Anfrage; Mail-Job kann nach 5 min doppelt laufen | `cockpitProvider.ts`, `email.ts:39`, `queue.ts:29` |
| 8 | Freie Zeiten im Browser ohne Ablauf zwischengespeichert; Terminarten-Liste statisch | veraltete Zeiten; inaktive Art zeigt leeren Kalender | `cockpitProvider.ts:71`, `BookingCard.tsx:244` |
| 9 | Status ohne Datenbank-Prüfregel, ohne Übergangsregeln, ohne Versionsschutz | widersprüchliche Zustände bei gleichzeitiger Änderung | `schema.ts:114-120`, `actions/appointments.ts:109-129` |
| 10 | Audit-Kette liest den Vorgänger ohne Sperre | Kette kann bei Gleichzeitigkeit „gebrochen" melden | `audit.ts:39-41` |
| 11 | Erinnerungen stoppen ganz, wenn „Buchung live" aus ist – auch für Telefon-Termine | keine Erinnerungen | `tick.ts:25` |
| 12 | Verwaltungs-Links laufen nie ab; keine Absagefrist | Link bleibt dauerhaft gültig | `repo.ts:522-526`, `public.ts:243-262` |
| 13 | Nach Absage eines Warteliste-Angebots verspricht die Seite eine Mail, die nicht kommt | falsche Erwartung | `ManageClient.tsx:180`, `public.ts:286` |
| 14 | Kein Online-Termin am selben Tag; keine Alternativvorschläge bei „Zeit vergeben" | Umweg über Telefon | `engine.ts:105`, `BookingCard.tsx:295-299` |

## 8. Anbieter-Vergleich (Bewertung, keine Empfehlung zum Wechsel)

| Weg | Stärken | Grenzen für diese Praxis |
|---|---|---|
| **Eigene Buchung (Ist)** | Daten bleiben in eigener Datenbank (Frankfurt), keine Gesundheitsdaten bei Dritten außer Mail-Dienst; Doppelbuchung von der Datenbank verhindert; Marke und Texte frei | Wartung liegt beim Projekt; Lücken oben; nur eine Ressource |
| **Doctolib** (existiert parallel) | Patientinnen kennen es; eigene Erinnerungen | keine Synchronisation mit dem Cockpit → Doppelvergabe nur durch Handpflege vermeidbar; Daten beim Anbieter |
| **Cal.com** (bewertet in `.claude/skills/VENDOR.md`) | fertige Buchungsseiten, Kalender-Abgleich | externer Dienst → Patientendaten an Dritte, AVV/DSFA nötig; doppelt zur eigenen Lösung |
| **FullCalendar** (nur Praxis-Oberfläche) | Monatsansicht, Ziehen zum Verschieben | neues Paket; Ressourcen-Ansichten kostenpflichtig; ersetzt keine Buchungslogik |

## 9. Offene Fragen an die Praxis (nicht erfinden – erst klären)

1. Wie viele **Ärztinnen/Ärzte** und **Behandlungsräume** gibt es, die gleichzeitig Termine
   haben können? (Heute: eine Ressource für alles.)
2. Welche **Terminarten** sollen online buchbar sein, mit welcher Dauer und welchem Puffer?
   Dürfen sie nach außen **neutral** heißen (z. B. „Sprechstunde", „Kontrolle")?
3. Soll eine Online-Buchung **verbindlich** sein (heute) oder erst eine **Anfrage**, die das Team
   bestätigt?
4. Welche **Praxissoftware (PVS)** wird genutzt, und sollen Termine dorthin übertragen werden?
5. Bleibt **Doctolib** parallel? Wer trägt Doctolib-Termine als „extern" im Cockpit ein?
6. **Vorlauf und Horizont:** Termine am selben Tag online? Wie weit im Voraus (heute 56 Tage)?
7. **Absage-/Verschiebefrist** für Patientinnen und Patienten (heute: bis zum Termin)?
8. **Erinnerungen:** 48 h und 24 h per E-Mail passend? SMS gewünscht (neuer Dienst → AVV)?
9. Darf der **Empfang** alle Termine, Notizen und Anfragen sehen?
10. **Aufbewahrung:** Wie lange sollen Termine, Absagen, Anfragen, Warteliste gespeichert bleiben?

## 10. Mögliche nächste Schritte (je nach Antwort, jeweils nur mit Freigabe)

- **Ohne Schemaänderung:** neutrale Bezeichnung in Mails/Kalenderdatei; Buchung + Protokoll +
  Mail-Auftrag in eine Transaktion; Wiederholungs-Kennung; Zeitlimits; Ablauf der
  Warteliste-Reservierung sofort berücksichtigen; Urlaub/Sperrzeit auch für Praxis-Termine;
  Alternativvorschläge bei „Zeit vergeben"; Text nach Absage korrigieren.
- **Mit Schemaänderung** (ausdrückliche Zustimmung nötig): Ressource Arzt/Raum in der
  EXCLUDE-Regel; Prüfregel für Status; Ablaufdatum für Verwaltungs-Links; Löschfristen.
- **Nur mit DSGVO-/AVV-Prüfung:** SMS, PVS-Anbindung, externe Kalender.
