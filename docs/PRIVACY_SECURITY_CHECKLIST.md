# Datenschutz- und Sicherheits-Prüfliste

> **Das ist eine Prüfliste, keine Rechtsauskunft und keine Bestätigung, dass irgendetwas
> DSGVO-konform ist.** Sie hält fest, was der Code am 17.10.2026 tatsächlich tut (mit
> Fundstellen), was fehlt und was die Praxis bzw. eine Fachperson (Datenschutzbeauftragte/r,
> Rechtsberatung) entscheiden muss. Nur lesend erhoben – an Code, Daten und Einstellungen wurde
> dafür nichts geändert.

Status: **✅ vorhanden** · **❌ fehlt** · **❓ unklar / zu prüfen**.
Pfade relativ zum Repository; `cockpit/` = Praxis-Cockpit, sonst Website.

## 0. Voraussetzungen (aus README und `docs/sprachkanal-openai.md`)

**Live-Stand 17.10.2026:** Die Website bucht verbindlich ins Cockpit
(`/api/public/v1/status` → `bookingLive: true`), und der Sprachkanal ist eingeschaltet
(`voice: true`). Es können also bereits echte Patientendaten gespeichert werden.

Das Projekt hat sich diese Punkte selbst als Voraussetzung für echte Patientendaten gesetzt;
keiner ist im Repository belegt (ob sie außerhalb erledigt sind, muss die Praxis bestätigen):

- [ ] Freigabe durch die/den Datenschutzbeauftragte/n
- [ ] Datenschutz-Folgenabschätzung (DSFA) – Gesundheitsdaten nach Art. 9 DSGVO
- [ ] Auftragsverarbeitungsverträge (AVV): Vercel (Hosting), Neon (Datenbank), Brevo (E-Mail);
      für den Sprachkanal zusätzlich OpenAI
- [ ] Verzeichnis von Verarbeitungstätigkeiten (Art. 30), TOM-Beschreibung
- [ ] Schweigepflicht-Erklärungen (§ 203 StGB) der Dienstleister, soweit nötig
- [ ] Datenschutzerklärung fertigstellen (siehe Abschnitt 7)

## 1. Welche Daten wohin gehen

| Weg | Erhobene Felder | Ziel | Fundstelle |
|---|---|---|---|
| Terminanfrage Website (Ausweichweg, wenn das Cockpit pausiert/nicht erreichbar ist) | Vorname, Name, Telefon, E-Mail, Datum, Uhrzeit, **Terminart** | `mailto:`-Entwurf → normale E-Mail (`formEndpoint` ist leer) | `lib/booking/requestProvider.ts:107-145`, `content/site.ts:146` |
| Terminbuchung über Cockpit (**live**) | wie oben + Einwilligung, Formular-Token, Honigtopf; **kein Freitext** | Cockpit-API → Postgres | `cockpit/lib/booking/public.ts:102-116` |
| Rückruf Website | Name, Telefon, Wunschzeit; **keine Einwilligungs-Checkbox** | `mailto:` | `components/booking/CallbackDisclosure.tsx` |
| Rückruf/Anliegen über Chat | Art (Rückruf, Folgerezept, Überweisung, Befundkopie, Sonstiges), Name, Telefon, E-Mail optional, Wunschzeit, Notiz ≤ 500 Zeichen | Cockpit → Postgres | `cockpit/lib/booking/requests.ts:178-188` |
| Warteliste (API, auf der Website derzeit nicht genutzt) | Name, E-Mail, Telefon, Zeitfenster, Notiz ≤ 300 Zeichen | Cockpit → Postgres | `cockpit/lib/booking/public.ts:313-326` |
| Chat-Verlauf | Nachrichten | nur im Browser (`sessionStorage`), keine Chat-Tabelle auf dem Server | `lib/chat/session.ts`, `cockpit/app/api/public/v1/chat/route.ts` |
| Chat-Formulierung durch KI | maskierter Satz ohne erkannte Gesundheitsbegriffe | NVIDIA NIM, ersatzweise OpenRouter (`:free`), beide USA, **ohne AVV** | `cockpit/lib/chat/llm.ts`, `safety.ts:351-376`, `orchestrator.ts` |
| Sprachkanal | Mikrofon-Audio, gesprochener Name/E-Mail | Browser → OpenAI (`api.openai.com`, nicht EU-Endpunkt) | `lib/voice/webrtc.ts:16`, `cockpit/lib/voice/openai.ts:77-81` |
| E-Mails | Terminbestätigung, Erinnerung usw. an Patient/in; Hinweis an die Praxis | Brevo | `cockpit/lib/messaging/email.ts`, `templates.ts` |

## 2. Gesundheitsdaten

- ❌ **Die Terminarten sind selbst Diagnosen** (z. B. Hämorrhoiden, Analfissur, Analfistel –
  `cockpit/drizzle/0001_constraints_and_seed.sql:71-79`, `content/booking.ts:11-17`). Damit ist
  jede Buchung eine Gesundheitsangabe.
- ❌ Die Terminart liegt **unverschlüsselt** in `appointments.type_id`, `waitlist.type_id`
  (`cockpit/lib/db/schema.ts:127,178`); ebenso `requests.kind` (u. a. Folgerezept,
  Befundkopie, `schema.ts:212`), im Audit-Protokoll (`repo.ts:441`) und in Job-Daten (`public.ts:305`).
- ❌ Die Terminart steht **in jeder E-Mail** (Bestätigung, Verschiebung, Absage, Erinnerung,
  Warteliste – `templates.ts:138-207`), im **Betreff** der Praxis-Benachrichtigung
  (`templates.ts:229`: „Neue Buchung: <Terminart> am …") und im Titel der Kalenderdatei
  (`send.ts:81`). Widerspricht README:542 („E-Mails ohne Medizin").
- ❌ Notizen aus dem **Web**-Rückrufweg und der Warteliste laufen nicht durch den
  Gesundheitsfilter (nur der Chat filtert, `orchestrator.ts:1179`).
- ✅ Kein Freitextfeld im Buchungsformular; der Chat fragt keine Symptome ab und schickt Sätze mit
  Gesundheitsbegriffen nicht an ein Sprachmodell.

**Zu entscheiden (Praxis + DSB):** neutrale Bezeichnungen nach außen (z. B. „Sprechstunde",
„Kontrolle") und in E-Mails/Kalenderdatei; Terminart verschlüsseln oder in neutrale Kategorien
überführen (wäre eine Schema-Änderung → nur mit Zustimmung).

## 3. Verschlüsselung und Schlüssel

- ✅ AES-256-GCM mit Versionskennung und Bindung an den Datensatz (`cockpit/lib/crypto/aead.ts`).
- ✅ Verschlüsselt: Kontaktdaten, Notizen und Verwaltungs-Token von Terminen, Warteliste,
  Anfragen; Aufnahmebögen (`pii_enc`, `note_enc`, `message_enc`, `payload_enc`).
- ✅ Suche über verschlüsselte Daten nur per HMAC-Blindindex (`blindIndex.ts`).
- ❌ Ein Skript zum **Schlüsseltausch** wird in `cockpit/.env.example` erwähnt, existiert aber nicht.
- ❓ Ratenbegrenzung fällt auf das Salz `"dev"` zurück, wenn `INDEX_KEY` fehlt (`ratelimit.ts:149`).
- ❓ Links zum Verwalten eines Termins (Token) **laufen nie ab** (`repo.ts:522-526`).
- ✅ Schlüssel nur aus Umgebungsvariablen; nur `.env.example`-Dateien sind eingecheckt.
- ❓ Eine `.env` im **Repository-Root** wäre nicht durch `.gitignore` geschützt (nur `cockpit/.env`).

## 4. Aufbewahrung und Löschung

- ❌ **Kein** Vorgang löscht oder anonymisiert echte Termine, Warteliste, Anfragen, Nachrichten
  oder Jobs. Der Takt (`cockpit/lib/jobs/tick.ts:59-75`) räumt nur Reservierungen und
  Ratenbegrenzungs-Einträge (> 24 h) auf.
- ❌ `intakeRetentionDays` (30) und `intake_forms.delete_after` existieren, werden aber nicht benutzt.
- ❌ Keine Funktion für Auskunft (Art. 15) oder Löschung (Art. 17) für eine einzelne Person;
  nur Demodaten lassen sich entfernen (`repo.ts:890-899`).
- ❓ Das Audit-Protokoll ist bewusst unveränderlich, enthält aber die Terminart → Konflikt mit
  Löschpflichten klären.
- ❓ Der GitHub-Takt schreibt die komplette Antwort in das Actions-Protokoll
  (`.github/workflows/cockpit-tick.yml`: `cat /tmp/tick.json`), inkl. Fehlertexten des
  Mail-Dienstes. Wer das Protokoll sehen kann, hängt von der Sichtbarkeit des Repositorys ab.

**Zu entscheiden:** Aufbewahrungsfristen je Datenart (Terminanfrage, abgesagter Termin,
Warteliste, Rückruf, Audit) – danach löschen oder anonymisieren.

## 5. Protokolle und Drittanbieter

- ✅ KI- und Chat-Protokolle enthalten nur Anbieter, Modell, Status, Dauer; keine IP-Adressen.
- ❓ `console.error` bei fehlgeschlagener Chat-Buchung/-Rückruf schreibt das ganze Fehlerobjekt
  (`chat/route.ts:172,216`) – kann Abfrageparameter enthalten.
- ✅ Kein Tracking, keine Analyse-Skripte; Schriften werden beim Build selbst gehostet.
- ✅ Google-Karte erst nach Klick (`components/ui/MapEmbed.tsx`).
- ❌ `maskPii` entfernt E-Mail, Telefon, Versicherten-Nr., IBAN – **aber keine Namen**
  (`safety.ts:357-376`). Die Datenschutzerklärung behauptet, Namen würden entfernt
  (`app/datenschutz/page.tsx:150-157`) → Text oder Code angleichen.
- ❌ **Sprachkanal (in Produktion eingeschaltet):** schaltet sich ein, sobald `OPENAI_API_KEY`
  gesetzt ist; keine eigene Einwilligung für Mikrofon/OpenAI in der Oberfläche; Standard ist der
  US-Endpunkt; die Sprechausgabe nimmt beliebigen Text an (`voice/speak/route.ts`).
  `docs/sprachkanal-openai.md` nennt als offene Voraussetzungen AVV, DSFA und
  § 203-Erklärungen → mit der/dem Datenschutzbeauftragten klären, ob der Kanal bis dahin
  abgeschaltet wird (Abschalten = `OPENAI_API_KEY` im Cockpit-Projekt entfernen).

## 6. Zugriff des Praxisteams

- ✅ Nur auf Einladung (72-h-Link, als Hash gespeichert); Registrierung abgeschaltet.
- ✅ Zweiter Faktor erzwungen: TOTP **und** mindestens ein Passkey (`cockpit/lib/auth/actor.ts:65-85`).
- ✅ Sitzung: 60 min Leerlauf, 12 h maximal, erneute Bestätigung nach 10 min für heikle Aktionen.
- ✅ Rollen Arzt, Empfang, Admin. ❓ **Alle Rollen** (auch Empfang) sehen alle Termine, Notizen,
  Anfragen – fachlich bestätigen lassen.
- ❓ Anmelde-Ratenbegrenzung von Better Auth liegt **im Arbeitsspeicher** – auf Serverless nicht verlässlich.
- ❓ Better-Auth-Admin-Endpunkte (`/api/auth/admin/*`: Nutzer imitieren, Passwort setzen,
  löschen) umgehen die Setup-Prüfung und das eigene Audit-Protokoll.
- ❓ Passkey-Anmeldung mit `userVerification: "preferred"` statt `"required"` (`auth.ts:60`).
- ✅ Unveränderliches, verkettetes Audit-Protokoll für Änderungen.
  ❌ Kein Protokoll für **Lesezugriffe**, Anmeldungen, Fehlversuche, Exporte.
- ℹ️ Eine vorübergehende Passwort-Rücksetz-Route (Commits 23b5abd, 882f061) ist entfernt, steht
  aber in der Git-Historie. Das damals gesetzte Admin-Passwort nach der ersten Anmeldung ändern.

## 7. Technische Schutzmaßnahmen

- ❌ **Website (statischer Export) sendet keine Sicherheits-Header**: kein CSP, HSTS,
  X-Frame-Options, Referrer-Policy (kein `vercel.json` im Root).
- ✅ Cockpit: X-Frame-Options DENY, nosniff, `Referrer-Policy: no-referrer`,
  Permissions-Policy, HSTS 2 Jahre, `noindex` (`cockpit/next.config.ts`). ❌ **Kein CSP.**
- ❓ CORS setzt nur Erlaubnis-Header; Anfragen anderer Herkunft werden nicht abgewiesen.
  Standardliste enthält `http://localhost:3000`.
- ✅ Bot-Schutz: signiertes Formular-Token (3 s–30 min), Honigtopf, Ratenbegrenzung in der
  Datenbank, Obergrenze je E-Mail; Chat-Grenzen je Sitzung/IP. Kein Captcha; `powEnabled`
  ungenutzt.
- ✅ Interne Routen nur mit Geheimnis (zeitkonstanter Vergleich); Test-Route in Produktion aus.

## 8. Datenschutzerklärung (`app/datenschutz/page.tsx`)

- ❌ Noch als **„MUSTER"** markiert, mit sichtbarem Hinweis. Platzhalter: Hosting, Übertragungsweg
  des Formulars, AVV für den Chat, Speicherdauer, Aufsichtsbehörde, Stand-Datum.
- ❌ Es fehlen: Brevo, Cockpit/Vercel, Datenbank (Neon, Frankfurt laut `.env.example`),
  Sprachkanal/OpenAI, Warteliste.
- ❓ Einwilligungstext im Chat nennt Terminart/Gesundheitsbezug nicht (Formular schon:
  `content/booking.ts:77`).

## 9. Testdaten

- ✅ Demodaten mit `@example.invalid` und `040 000 …`; Playwright mit Zufallsschlüsseln,
  Fake-KI, Mails nur ins Protokoll.
- ❓ Einige Unit-Tests nutzen realistisch aussehende Adressen bei echten Anbietern
  (`…@gmx.de`, `…@gmail.com`, `…@web.de`) und die echte Praxisnummer – nichts wird versendet,
  trotzdem besser auf `example.invalid` umstellen.

## Vorschlag zur Reihenfolge (jede Umsetzung erst nach Freigabe)

1. **Sofort, ohne Code:** Admin-Passwort ändern; Vercel-Token „migration" löschen; entscheiden,
   ob der Sprachkanal bis zur AVV-/DSFA-Klärung abgeschaltet wird.
2. **Kurz, nur Code:** neutrale Terminbezeichnung in E-Mail-Betreff, -Text und Kalenderdatei;
   Gesundheitsfilter auch für Web-Notizen; Sicherheits-Header (inkl. CSP) für Website und
   Cockpit; `.env` im Root ignorieren; Tick-Protokoll kürzen; Datenschutztext zu Namen angleichen.
3. **Mit Entscheidung der Praxis:** Aufbewahrungsfristen + Löschlauf, Auskunft/Löschung je
   Person, Rollenrechte des Empfangs, Ablauf der Verwaltungs-Links.
4. **Mit Fachperson:** DSFA, AVVs, Verzeichnis, Datenschutzerklärung fertigstellen.
