# Sprachkanal mit OpenAI – Entscheidungsgrundlage

> **Stand 08.09.2026. Recherche-Momentaufnahme, kein Vertrag.**
>
> Dieses Dokument entstand aus sechs unabhängigen Recherchen (Spracherkennung,
> Sprachausgabe, Datenschutz, Telefonie, Kosten, Architektur), von denen jede
> anschließend gegengeprüft wurde: Ein zweiter Durchgang hatte ausdrücklich den
> Auftrag, die tragenden Aussagen zu widerlegen. Wo eine Aussage der Prüfung
> nicht standhielt, steht hier die korrigierte Fassung.
>
> **Trotzdem gilt: Preise, Modellnamen, Endpunkte und vor allem die Zusagen zur
> EU-Datenverarbeitung ändern sich. Jede Aussage, an der ein Vertrag oder die
> DSFA hängt, muss vor dem Bauen schriftlich von OpenAI, sipgate und Hetzner
> bestätigt werden.** Die Belege sind als Links im Text angegeben, damit sie
> nachprüfbar sind und nicht geglaubt werden müssen.
>
> Entscheidung des Betreibers, auf der dieses Dokument steht: **für die Sprache
> ausschließlich OpenAI** (Erkennung und Ausgabe), die Gesprächslogik bleibt
> beim deterministischen Automaten und den kostenlosen Modellen.

## Entscheidungsdokument: Sprachschicht (STT/TTS) mit OpenAI für die Praxis Proktologie Eimsbüttel

Stand: 08.09.2026. Grundlage: sechs recherchierte Dimensionen (stt, tts, dpa, telephony, pricing, architecture), jeweils adversarial gegengeprüft. Widersprüche zwischen den Dimensionen sind unten aufgelöst und als solche gekennzeichnet.

---

## 1. Verdikt

**Technisch ja, rechtlich derzeit nein — und die Sperre ist nicht softwareseitig lösbar.** Der blockierende Punkt zuerst: Die EU-Datenresidenz (`eu.api.openai.com`) ist bei OpenAI **kein Self-Service**. Wörtlich: „Contact our sales team to see if you're eligible for using data residency controls" und „To use data residency with any region other than the United States, you must be approved for abuse monitoring controls, and execute a Modified Retention amendment" (https://developers.openai.com/api/docs/guides/your-data). Ohne diese Freigabe laufen gesprochene Symptomschilderungen über US-Endpunkte, und die Default-Aufbewahrung für Abuse-Monitoring beträgt bei `/v1/audio/speech` und `/v1/realtime` **30 Tage**. Für Art.-9-DSGVO-Gesundheitsdaten in einer proktologischen Praxis ist das nicht vertretbar. Verschärfend: OpenAIs eigener AVV erklärt in Schedule 1, Ziffer 5 wörtlich „No sensitive data is intended to be transferred unless the user includes it unexpectedly in unstructured data" (https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) — dieses Projekt überträgt Art.-9-Daten systematisch und dauerhaft, also exakt das Gegenteil. Dritter, von der DSGVO unabhängiger Blocker: § 203 Abs. 3 StGB verlangt für jeden „sonstigen mitwirkenden" Dienstleister eine **eigene schriftliche Verschwiegenheitsverpflichtung mit Hinweis auf die Strafbarkeit** — für OpenAI, für den Telefonanbieter und für den Relay-Hoster. Ein AVV ersetzt sie nicht. Zweitens, weniger dramatisch, aber ebenso bindend: „OpenAI only" lässt sich für den Telefonkanal **nicht** einhalten. OpenAIs SIP-Endpunkt akzeptiert beim Annehmen eines Anrufs ausschließlich `type: "realtime"` — es gibt keine Transkriptions-Variante (https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/accept) — und würde damit genau das Sprache-zu-Sprache-Modell in die Entscheidungslogik setzen, das Sie ausgeschlossen haben. Außerdem kennt der OpenAI-SIP-Leitfaden **kein DTMF**, das „Drücken Sie die 1" ist dort also nicht baubar. Fazit: Die Architektur trägt, der Bauplan ist konkret, aber **vor der ersten Sekunde Patientenaudio müssen drei Unterschriften vorliegen** (OpenAI-Freigabe + Modified Retention Amendment, § 203-Verpflichtungen, DSFA). Alles Übrige lässt sich ohne API-Key gegen einen Fake-Provider bauen und testen.

---

## 2. Die Architektur, die der Evidenz standhält

**Ohren — `/v1/realtime/transcription_sessions`.** Eine Transkriptions-Session kann strukturell nicht antworten; das ist der sauberste Beweis, dass OpenAI nicht denkt. Verbindung über WebSocket, dann:

```json
{"type":"session.update","session":{"type":"transcription","audio":{"input":{
  "format":{"type":"audio/pcm","rate":24000},
  "noise_reduction":{"type":"near_field"},
  "transcription":{"model":"gpt-transcribe","languages":["de","en"],"delay":"low",
    "prompt":"Anruf in einer proktologischen Praxis in Hamburg zur Terminvereinbarung.",
    "keywords":["Hämorrhoiden","Proktologie","Fistel","Überweisung","Rezept","Vorsorge","Eimsbüttel"]},
  "turn_detection":{"type":"server_vad","threshold":0.6,"prefix_padding_ms":300,"silence_duration_ms":700}}}}}
```

Modellwahl: EU-residenzfähig sind für diesen Endpunkt **nur** `gpt-realtime-whisper`, `gpt-live-transcribe`, `gpt-transcribe`. Startempfehlung `gpt-transcribe` (0,0045 $/min, liefert ebenfalls Deltas vor dem `completed`-Event); Upgrade auf `gpt-live-transcribe` (0,017 $/min, echte Live-Deltas während des Sprechens) nur, wenn die Messung an echten Anrufen es rechtfertigt. **Nicht bauen auf** `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` / `whisper-1` / `gpt-4o-transcribe-diarize`: am 26.08.2026 zur Abschaltung am **26.02.2027** angekündigt (https://developers.openai.com/api/docs/deprecations), und für Realtime ohnehin „Not supported".

**Mund — `POST /v1/audio/speech`**, `response_format:"pcm"` (headerlos, 24 kHz, 16 bit LE), Streaming per Chunked Transfer. **Hier liegt die unangenehmste Einschränkung**: Die EU-Residenz-Tabelle nennt für `/v1/audio/speech` als zulässige Modelle `tts-1`, `whisper-1`, `gpt-4o-tts`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-transcribe` — **`gpt-4o-mini-tts` steht dort nicht**, und `gpt-4o-tts` hat keine Modellseite (404). Übrig bleibt praktisch **`tts-1`**, das laut Referenz den `instructions`-Parameter nicht unterstützt („Does not work with tts-1 or tts-1-hd", https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create). DSGVO-Konformität kostet hier also die steuerbare, modernere Stimme. Das muss vor Baubeginn schriftlich mit OpenAI geklärt werden.

**Dazwischen — ein eigener Relay.** Node 22 + TypeScript + `ws`, Dauerbetrieb, **Hetzner Falkenstein oder Nürnberg** (deutsches Rechenzentrum, AVV vorhanden). Vercel scheidet aus: keine langlebigen WebSockets. Der Relay ist der einzige Ort, an dem Audio existiert — **niemals auf Platte, niemals ins Log**. Sauberer Schnitt: alles oberhalb der Transportschicht spricht PCM16 @ 24 kHz mono; µ-law↔PCM passiert ausschließlich an der Telefon-Transportkante. Ein `SpeechProvider`-Interface (`openStt` / `speak`) kapselt OpenAI in genau einer Datei — falls die Freigabe scheitert oder die deutsche Qualität durchfällt, ist der Anbieterwechsel eine Datei, kein Umbau.

**Gehirn — unverändert.** Der Relay ist ein **dummer Träger des `ChatState`**. Er ruft `POST /api/public/v1/chat` mit `{v:1, sessionId, state, message|action}` auf und ersetzt `state` vollständig durch die Antwort. Er inspiziert, repariert oder erfindet keine Felder. Damit erbt der Sprachkanal jede getestete Sicherheitsregel des bestehenden Orchestrators (Notfallpfad, Blockliste, Buchungslimit, Grounding-Check) geschenkt. Der Stage-Automat (`idle|type|date|time|contact|confirm|callback|done`) und die Quick-IDs sind bereits vorhanden (`cockpit/lib/chat/orchestrator.ts`).

**Telefon — hier ist ein zweiter Anbieter unvermeidbar.** Ein Telefonieanbieter ist keine Sprach-KI; „OpenAI only" bezieht sich sinnvoll auf STT/TTS, nicht auf den Netzzugang. Empfehlung: **sipgate** (Düsseldorf, Server ausschließlich in Deutschland, AVV online abschließbar) plus die **MIT-lizenzierte `sipgate-sip-stream-bridge`** (https://github.com/sipgate/sipgate-sip-stream-bridge), die das Twilio-Media-Streams-Protokoll spricht — inklusive `mark`, `clear` und `dtmf`. Damit gilt: ein Relay-Codepfad für sipgate **und** für Twilio als Ausweichoption (Twilio Media Streams in der Region IE1/Irland). `AUDIO_MODE=twilio` liefert reines PCMU 8 kHz. Wertvolles Detail der Bridge: Beim Weiterleiten an das Team wird der WebSocket-Stream **vor** dem ausgehenden INVITE geschlossen — der Bot hört das Gespräch mit dem Team nicht mit, was datenschutzrechtlich genau richtig ist.

**Anrufablauf 040 490 80 21.** Der Ansageteil („Sie sprechen mit dem automatischen Terminassistenten … für den Assistenten die 1, oder bleiben Sie dran für das Team") läuft **beim Carrier**, nicht bei OpenAI. Erst bei Ziffer 1 wird der Medienstrom an den Relay gegeben; jede andere Eingabe, Timeout oder ein ausgefallener Relay führt zur normalen Zustellung an die Praxis. Der sichere Zustand ist damit bauartbedingt „Mensch". Zur Rufnummer: § 59 Abs. 5 TKG erlaubt Portierung geografischer Rufnummern nur „an einem bestimmten Standort" (https://www.gesetze-im-internet.de/tkg_2021/__59.html); die Praxis hat einen Hamburger Betriebssitz, eine Portierung ist also zulässig — BNetzA-Verfügung 25/2006 nennt für freie Berufe ausdrücklich die Kammerbescheinigung als Nachweis. **Empfehlung trotzdem: zunächst nicht portieren**, sondern eine zweite DID als Assistenten-Nummer betreiben und aus der Bestandsanlage bedingt weiterleiten. Portierung der Hauptnummer einer Praxis ist ein Risiko ohne Nutzen in Phase 1.

**Browser-Mikrofon.** `getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:true}})`, **kein** `sampleRate` in den Constraints und **kein** `new AudioContext({sampleRate})` (Safari ignoriert das seit Jahren). Stattdessen `ctx.sampleRate` auslesen und im AudioWorklet auf 24 kHz resamplen. Der Worklet liegt als klassisches Skript unter `/public/voice/pcm-worklet.js` und wird per Literalpfad geladen — `new URL(..., import.meta.url)` würde vom Bundler gehasht. TTS **im selben AudioContext** abspielen (nicht per `<audio>`), sonst verliert die Browser-Echounterdrückung ihr Referenzsignal und der Assistent unterbricht sich selbst. Wichtig für den AVV-Umfang: `gpt-transcribe` ist laut Doku **WebSocket-only, kein WebRTC** — Browseraudio läuft also ebenfalls über den eigenen Relay, nicht direkt zu OpenAI.

**Offen und vor Designfestlegung zu messen:** ob eine Transkriptions-Session `{"type":"audio/pcmu"}` am Eingang akzeptiert (die GA-Feldbeschreibung nennt nur PCM 24 kHz, die Typunion nennt pcmu/pcma, der Legacy-REST-Body kennt explizit `g711_ulaw`). Bis das mit einem Wegwerf-Key belegt ist: **8 kHz → 24 kHz Resampling im Relay einplanen** (Tabellen-Lookup + Interpolation, billig, aber es ändert das Latenzbudget). Ebenso zu prüfen: die genaue GA-WebSocket-URL für Transkriptions-Sessions und ihr EU-Pendant — `?intent=transcription` ist in den aktuellen Guides nicht dokumentiert, nur durch einen LiveKit-Produktionsbericht und ein Tutorial belegt; `wss://eu.api.openai.com/...` ist aus dem REST-Muster abgeleitet, nirgends dokumentiert.

---

## 3. Datenschutz: Was gesichert ist, was Risiko bleibt

### Harte Fakten

| Fakt | Beleg |
|---|---|
| AVV existiert, Klick-Abschluss; für EWR/Schweiz ist Vertragspartner **OpenAI Ireland Ltd.**, nicht die US-Gesellschaft. Art.-28-Inhalte (Weisungsbindung, Vertraulichkeit, TOM, Unterauftragnehmer, Audit, Meldung „without undue delay") sind vorhanden. | https://openai.com/policies/data-processing-addendum/ |
| API-Daten werden **nicht** zum Training genutzt — Default, vertraglich, in jeder Endpunktzeile „Data used for training: No". | https://developers.openai.com/api/docs/guides/your-data |
| **Die Realtime-API ist von der EU-Residenz erfasst** — entgegen der ursprünglichen Projektannahme. `/v1/realtime`, `/v1/realtime/transcription_sessions`, `/v1/audio/transcriptions`, `/v1/audio/speech` haben **Storage *und* Processing** in „Europe (EEA + Switzerland)" über `eu.api.openai.com`. TLS-Terminierung erfolgt via Cloudflare Regional Services in der Region. | https://developers.openai.com/api/docs/guides/your-data |
| Default-Aufbewahrung: `/v1/audio/transcriptions` = **keine**; `/v1/audio/speech` = **30 Tage**; `/v1/realtime` = **30 Tage**. | ebd. |
| EU-Residenz erzwingt ZDR oder Modified Abuse Monitoring — die Kopplung ist hier zu unseren Gunsten: EU-Residenz ohne Retention-Kontrolle ist gar nicht konfigurierbar. Eyes Off / Safety Retention sind für die Audio-Endpunkte „No", scheiden als Qualifikation also aus. | ebd. |
| Datenresidenz ist **projektgebunden** und nur für **neue** Projekte konfigurierbar; ein bestehendes Projekt lässt sich nicht umstellen. Aufschlag **+10 %** für Modelle ab 05.03.2026. | ebd. |
| Tracing ist für `/v1/realtime` **nicht** EU-residenzkonform — muss nachweislich aus sein. | ebd. |
| sipgate: deutsches Unternehmen, Infrastruktur ausschließlich in Deutschland, AVV online. | https://www.sipgate.de/av |

### Residualrisiken, offen zu benennen

1. **Die Freigabe selbst.** OpenAI veröffentlicht keine Eignungskriterien, keinen Mindestumsatz, keine Stufe. Ob eine Einzelpraxis EU-Residenz + ZDR erhält, ist unbekannt. **Das ist die Projekt-Gate-Frage, nicht eine Randnotiz.**
2. **Modell-Allowlist bricht Residenz lautlos.** Residenz gilt **pro Modell**, nicht pro Endpunkt. Ein Wechsel auf `gpt-4o-mini-tts`, weil die Stimme besser klingt, verlässt die EU-Verarbeitung **ohne Fehlermeldung**. Gegenmaßnahme: Modell-ID hart kodieren und einen Test, der bei Abweichung fehlschlägt.
3. **`/v1/realtime/transcription_sessions` hat keine eigene Zeile in der Retentionstabelle.** ZDR-Eignung ist für genau diesen Endpunkt nicht dokumentiert; die Tabellenregel lautet, dass nicht gelistete Endpunkte Application State behalten können. Schriftlich klären.
4. **Schedule 1 widerspricht dem Vorhaben** (siehe § 1). Entweder eine Änderung von Annex I aushandeln oder in der eigenen DSFA und im Verzeichnis von Verarbeitungstätigkeiten dokumentieren, dass Art.-9-Daten bewusst auf Grundlage von Art. 9 Abs. 2 lit. a übertragen werden, mit EU-Residenz und ZDR als Garantien.
5. **Der HIPAA-BAA hilft in Hamburg nicht.** OpenAI schließt ihn (baa@openai.com), das Dokument enthält 38-mal „HIPAA" und **null**-mal „GDPR". Er ist Indiz dafür, dass OpenAI Gesundheitsdaten kommerziell vorsieht — mehr nicht. Wer ihn als DSGVO-Antwort anbietet, disqualifiziert sich.
6. **ZDR/MAM sind widerruflich.** OpenAI behält sich vor, Modelle für einzelne Kunden nach schriftlicher Vorankündigung aus ZDR/MAM zu nehmen; für die Audio-Endpunkte gibt es dann kein „Eyes Off"-Auffangnetz. Worst Case: Rückfall auf 30 Tage mit möglicher menschlicher Sichtung. In den AVV-Unterlagen benennen.
7. **CLOUD Act.** Vertragspartner ist eine EWR-Gesellschaft, Verarbeitung und Speicherung liegen in der EU, und mit ZDR existiert kein Bestand an Patientenaudio, der herausgegeben werden könnte. Restrisiko sind Transitzeitpunkt und Systemdaten (Konto, Metadaten, Nutzungsstatistik) — Residenz gilt für diese ausdrücklich nicht. Das ist eine vertretbare DSFA-Aussage; „keine US-Exposition" wäre falsch.
8. **§ 203 StGB.** Getrennte schriftliche Verpflichtung für OpenAI, sipgate und Hetzner. Der Standard-AVV von OpenAI enthält sie nicht. Ob OpenAI sie zeichnet, ist ungeklärt und kann das Vorhaben unabhängig von der DSGVO stoppen.
9. **EU AI Act Art. 50** gilt seit 02.08.2026: Die Offenlegung, dass ein automatisierter Assistent spricht, muss **an den Anfang** der Ansage, nicht in eine spätere Passage.

### Vor der ersten Sekunde Patientenaudio zu unterschreiben

AVV mit OpenAI Ireland (ausgeführt, PDF und Unterauftragnehmerliste archiviert) · Modified Retention Amendment · ZDR- oder MAM-Freigabe, aktiv auf Org- **und** Projektebene · neues EU-Projekt auf `eu.api.openai.com` · AVV sipgate · AVV Hetzner · § 203-Verpflichtungserklärungen aller drei · DSFA nach Art. 35 · Eintrag im Verzeichnis von Verarbeitungstätigkeiten · angepasste Datenschutzerklärung. **Bis dahin: kein einziger Testanruf mit echtem Patientenaudio** — Entwicklungstests laufen gegen den Fake-Provider und gegen eingesprochene Testaufnahmen des Teams mit dokumentierter Einwilligung.

---

## 4. Turn-Taking und Unterbrechung

### (a) Verstehen, während der Patient spricht

`gpt-transcribe` bzw. `gpt-live-transcribe` liefern `conversation.item.input_audio_transcription.delta` fortlaufend, `.completed` am Turn-Ende. `delay` steuert den Kompromiss (`minimal|low|medium|high|xhigh`). Die einzige unabhängige Messung (englisches Audio, Median aus 3 Läufen) ergibt für die Zeit bis zum ersten Teiltranskript: minimal 0,70 s, low 1,19 s, medium 1,39 s, high 2,09 s, xhigh 2,91 s. OpenAI selbst nennt keine Millisekundenwerte und schreibt ausdrücklich: „benchmark with representative audio instead of assuming a fixed timing per level". **Deutsche und telefonbandbreitige Zahlen existieren nirgends.** Startwert `delay:"low"`, danach an echten Aufnahmen messen.

### (b) Aufhören, sobald der Patient spricht

**Der Auslöser ist niemals ein Transkript.** 0,70 s wären viel zu spät. Auslöser ist `input_audio_buffer.speech_started` (akustisch, feuert auf Energie) plus lokale VAD im Relay bzw. im Browser-Worklet. OpenAI übernimmt das nicht: `create_response` und `interrupt_response` sind laut VAD-Guide „conversation-only" und in Transkriptions-Sessions wirkungslos (https://developers.openai.com/api/docs/guides/realtime-vad). Dreistufig, damit ein Husten kein Gespräch zerlegt:

1. **Ducken (≤ 30 ms, lokal, rücknehmbar).** Nach 3 aufeinanderfolgenden stimmhaften 20-ms-Frames: Player-Gain in 15 ms auf 0 rampen, TTS-Stream nicht mehr in den Ringpuffer schreiben. Noch nichts verwerfen.
2. **Bestätigen (150–300 ms).** Nur wenn `speech_started` eintrifft **oder** die lokale Stimmhaftigkeit ≥ 250 ms anhält: Ringpuffer leeren, **erst die eigene Ausgabewarteschlange, dann** `{"event":"clear","streamSid":…}` an die Bridge senden (umgekehrte Reihenfolge ist der klassische Fehler — man leert den Carrier und füllt ihn sofort wieder), `AbortController.abort()` auf den `/v1/audio/speech`-Fetch, `playedMs` festhalten.
3. **Fortsetzen (400-ms-Wachhund).** Kommt keine Bestätigung, Gain zurück auf 1,0 — kein hörbarer Aussetzer.

`playedMs` liefert das `mark`-Echo: Jeder gesendete `mark` kommt zurück, **wenn** das zugehörige Audio den Anrufer erreicht hat. Das letzte Echo vor dem `clear` ist die Wahrheit darüber, was der Patient gehört hat — nötig für die Entscheidung „Satz wiederholen" vs. „weiter" und für das Protokoll.

**Selbstunterbrechung verhindern:** Browser-AEC nur wirksam, wenn TTS durch denselben AudioContext läuft. Zusätzlich in beiden Kanälen: solange `state === "speaking"` gilt Schwelle Rauschboden + 10 dB statt + 5 dB und ≥ 250 ms statt ≥ 60 ms, mit 200 ms Nachlauf nach dem letzten TTS-Sample; die ersten 300 ms jeder Äußerung sind gesperrt. Kommt danach ein Transkript, das ein Präfix des gerade gesprochenen Satzes ist (normalisierte Levenshtein-Distanz ≤ 0,25), war es Echo: verwerfen, ab `playedMs` fortsetzen, `bargein=echo` protokollieren.

**Rückkanalwörter sind keine Unterbrechung:** `mhm, hm, ja, jaja, joa, okay, genau, aha, verstehe, gut, alles klar` unter 1,2 s Länge → weiterreden. **Ausnahme:** in `stage === "confirm"` ist ein blankes „ja" die Antwort, dort ist die Unterdrückung abgeschaltet.

**VAD-Wahl:** `server_vad` ist der Auslieferungs-Default (threshold 0.6, prefix_padding_ms 300, silence_duration_ms 700). `semantic_vad` mit `eagerness:"low"` (8 s Maximaltimeout) wäre für ältere Anrufer mit Sprechpausen ideal — aber die OpenAI-Referenz sagt an **drei** Stellen, dass in Transkriptions-Sessions „only `server_vad` is currently supported", während der VAD-Guide das Gegenteil nahelegt; ein Community-Thread dazu lief 18 Monate und endete am 07.09.2026 mit „we haven't confirmed a fix". Zudem ist `speech_started` selbst als „Sent by the server when in `server_vad` mode" dokumentiert. **Semantic VAD ist eine zu messende Option, keine Planungsgrundlage.**

### (c) Erkennen, dass der Patient mit jemand anderem spricht

**Es gibt dafür keine Herstellerfunktion, und das muss dem Praxisinhaber so gesagt werden.** `gpt-live-transcribe` liefert „no word-level timestamps, speaker labels, or transcription confidence scores". Das einzige diarisierende Modell, `gpt-4o-transcribe-diarize`, ist für Realtime „Not supported", steht nicht auf der EU-Residenzliste und wird am 26.02.2027 abgeschaltet. Über eine Telefonleitung kommt ohnehin ein einziger gemischter Monokanal an — es gibt kein räumliches Merkmal.

Also Heuristik in einem reinen, testbaren Modul (`lib/voice/addressee.ts`), gespeist aus: Energie relativ zum sitzungsindividuellen Sprechboden, dem Urteil der **bestehenden** deterministischen Parser, lexikalischen Markern, Stage-Erwartung und Dauer.

```
score = 0
+2  nichts geparst (kein Typ, Datum, Uhrzeit, Thema, Quick-ID, Ja/Nein)
+2  medianDb < sprechBodenDb - 9            // abgewandt / quer durch den Raum
+2  Drittansprache-Marker: "moment", "warte", "sag mal", "hol mal", "guck mal",
    "er sagt", "ich telefonier", "nicht mit dir", "nein du", "schatz", "mama",
    oder reiner Vorname ohne Verb
+1  Stage erwartet eine Antwort, es kommt keine
+1  Dauer < 400 ms oder > 12 s
+3  überlappte Assistentenausgabe und Echo-Verdacht
-2  Ansprache-Marker: "Sie", "Ihnen", "ich möchte", "ich hätte gern",
    "können Sie", "bitte", "sagen Sie"
-3  eindeutige Quick-ID, oder Ja/Nein in stage "confirm"
-99 Notfallerkennung  // ein Notfall ist NIE Nebengespräch
```

| Score | Urteil | Handlung |
|---|---|---|
| ≥ 3 | `aside` | **Schweigen.** Kein Aufruf von `/api/public/v1/chat`. `ChatState` unverändert, `failures` **nicht** erhöhen, `lastOffer` **nicht** löschen. Mikrofon bleibt offen. |
| 1–2 | `unsure` | Nur nachfragen, nie handeln. Höchstens einmal pro 60 s „Entschuldigung — war das an mich? Ich bin noch da." In `confirm` stattdessen `confirmAgain`. |
| ≤ 0 | `me` | Normaler Turn. |

**Unverhandelbare Leitplanken, unabhängig vom Score:** Eine Buchung erfolgt **ausschließlich** aus `stage === "confirm"`, bei **Ganzäußerungs-Treffer** gegen eine geschlossene Ja-Liste (`ja`, `ja bitte`, `ja gerne`, `genau`, `richtig`, `passt`, `buchen`) und bei Score ≤ 0 — niemals durch Teilstring-Treffer in einem längeren Satz („ja also ich weiß nicht ob Dienstag geht" darf nichts buchen). Zweimal `aside` in `confirm` → einmal `confirmAgain`, dann Rückruf anbieten, dann Team. Fünf `aside` insgesamt → Übergabe anbieten. Am Telefon durchgängig ein DTMF-Notausgang: „Drücken Sie die 9, wenn ich Sie falsch verstanden habe" — DTMF ist zu 100 % zuverlässig und immun gegen alles oben Genannte. Im Browser mobil **standardmäßig „Zum Sprechen halten"**; das löst das Problem vollständig und ist im Wartezimmer die ehrliche Voreinstellung.

---

## 5. Kosten

Annahmen: 300 Anrufe × 3 min = 900 Telefonminuten, 500 Web-Sessions × 2 min = 1.000 Webminuten, zusammen 1.900 Eingangsminuten; TTS-Sprechzeit 40 % = 760 min ≈ 722.000 Zeichen (≈ 950 Zeichen/min Deutsch). Kurs 1 EUR = 1,1623 USD (08.09.2026). Relay-seitige VAD leitet nur stimmhaftes Audio weiter (~35 % der Sitzungsdauer = 665 min).

| Position | Rechnung | EUR/Monat |
|---|---|---|
| STT `gpt-transcribe`, VAD-gefiltert, +10 % EU | 665 × 0,0045 $ = 2,99 $ × 1,1 = 3,29 $ | **2,83** |
| TTS `tts-1` (EU-fähig), 722.000 Zeichen × 15 $/1M | 10,83 $ (kein Aufschlag, Modell vor 05.03.2026) | **9,32** |
| sipgate trunking business 2, netto | pauschal | **9,95** |
| Relay Hetzner CX23 + IPv4 | 5,49 € + 0,50 € | **5,99** |
| **Summe (Basisvariante)** | | **28,09** |
| Aufpreis `gpt-live-transcribe` statt `gpt-transcribe` | 665 × 0,017 $ × 1,1 = 12,44 $ = 10,70 € | +7,87 |
| Ohne VAD-Filterung (1.900 statt 665 min, live) | 1.900 × 0,017 $ × 1,1 = 35,53 $ | +27,74 |
| Weiterleitung ans Team, falls nicht im selben Trunk | 630 min × 0,5–0,84 ct | +3,15 bis 5,29 |
| **Risiko: sipgate-Inbound-Minuten** (siehe unten) | 900 × 3,9 ct | **+35,10** |

**Realistischer Korridor: 28–40 € netto/Monat**, im schlechtesten dokumentierbaren Fall knapp 75 €. Zum Vergleich: sipgates eigenes AI-Agents-Produkt kostet bei 900 Telefonminuten **180–351 €/Monat** (Preisliste Mai 2026: Large 1.000 min = 199,95 €, flexibel 0,39 €/min). Der Eigenbau spart also rund 2.000 €/Jahr — und erkauft das mit Betriebs- und Rechtsverantwortung.

**Kostenfallen, benannt:**
- **Offener Browser-Tab.** Die Transkriptions-Session wird nach Audiodauer abgerechnet. Ein durchgehend streamender Tab über einen Arbeitstag = 480 min. Bei `gpt-live-transcribe` sind das 7 €/Tag; ein einen Monat vergessener Tab 632 €. Gegenmaßnahmen: Socket **nie** beim Seitenaufruf öffnen, nur per Mikrofonknopf; `visibilitychange`/`pagehide` schließen; harte serverseitige Obergrenze; Tages-Kontingent pro Session und IP **im Relay**, nicht im Browser. Mit VAD-Filterung existiert das Problem strukturell nicht — es wird nichts gesendet, also nichts abgerechnet.
- **Stille.** OpenAI dokumentiert die VAD-Stille-Befreiung nur für tokenbasierte Konversationssessions, **nicht** für die dauerbasierte Transkription. Ein Anrufer, der 3 min schweigt, kostet möglicherweise voll. In Woche 1 empirisch mit einer bewusst stillen 5-Minuten-Session gegen das Usage-Dashboard prüfen. Bis dahin: Stille gar nicht erst weiterleiten, nach 8 s „Sind Sie noch da?", nach zweimal Nichtantwort auflegen.
- **Verworfene TTS bei Barge-in.** Satzweise synthetisieren, nicht absatzweise; dann geht bei einer Unterbrechung höchstens ein Satz verloren. Ob OpenAI bei Verbindungsabbruch aufhört zu berechnen, ist **nicht dokumentiert** — konservativ kalkulieren.
- **Raumgespräche transkribieren.** Wer erst alles sendet und danach klassifiziert, bezahlt jedes Wort des Dritten und hat obendrein die Sprache eines Unbeteiligten übertragen. Hier fallen billige und rechtmäßige Architektur zusammen: **vor** OpenAI filtern.
- **Retries.** Ein naives Retry-on-5xx verdreifacht einen Dauerzähler lautlos. Maximal ein Wiederholungsversuch, idempotent pro Äußerungs-ID, Circuit Breaker.
- **sipgate-Inbound ist nicht bestätigt.** In der Preisliste steht unter *Trunking* kein Inbound-Minutenpreis, unter *Contact Center* dagegen sehr wohl (3,9 ct/min bis 2,0 ct/min, ohne Paket 9 ct/min). sipgates eigener Doku-Assistent antwortete auf direkte Nachfrage, eingehende Gespräche seien „nicht pauschal kostenlos". **Schriftliches Angebot einholen, bevor 9,95 € in ein Budget wandern.**
- **+10 % EU-Aufschlag** auf residenzfähige Modelle ab 05.03.2026 und **Wechselkursrisiko** (OpenAI fakturiert in USD).
- **Harte Sicherung:** Monatslimit im OpenAI-Dashboard bei ca. 100 € und ein Kosten-Zähler pro Session (gestreamte Minuten, erzeugte Zeichen) im Cockpit. Bei diesen Beträgen schaut sonst niemand hin.

---

## 6. Bauplan

### Phase 0 — Was der Inhaber persönlich tun muss, in dieser Reihenfolge

1. **BLOCKED ON OWNER — OpenAI Sales kontaktieren.** In einem Gespräch klären und **schriftlich** bestätigen lassen: (a) Eignung für EU-Datenresidenz, (b) ZDR oder Modified Abuse Monitoring, (c) Modified Retention Amendment, (d) **welches TTS-Modell konkret EU-verarbeitbar ist** (`tts-1`? `gpt-4o-tts`? `gpt-4o-mini-tts`?), (e) ZDR-Status für `/v1/realtime/transcription_sessions`, (f) ob Custom Voices verfügbar sind. Das ist der längste Vorlauf im gesamten Projekt.
2. **BLOCKED ON OWNER — AVV ausführen** (platform.openai.com → Settings → Privacy), PDF und Unterauftragnehmerliste am Tag des Abschlusses im Browser abrufen und archivieren. **Neues** Projekt mit Region Europa anlegen (bestehende sind nicht umstellbar).
3. **BLOCKED ON OWNER — Anwalt/DSB.** DSFA nach Art. 35, Einwilligungstext nach Art. 9 Abs. 2 lit. a, § 203-Verpflichtungserklärungen für OpenAI, sipgate und Hetzner, Nachverhandlung von Schedule 1 Ziffer 5, KI-VO-Art.-50-Ansage, Eintrag ins Verzeichnis von Verarbeitungstätigkeiten, Ergänzung der Datenschutzerklärung.
4. **BLOCKED ON OWNER — sipgate.** Trunk-Vertrag, AVV, **schriftliche** Bestätigung zu Inbound-Minuten, Entscheidung Weiterleitung vs. Portierung von 040 490 80 21.
5. **BLOCKED ON OWNER — Hetzner** Konto und AVV (Falkenstein oder Nürnberg).
6. **BLOCKED ON OWNER — Testkorpus.** 30–50 anonymisierte, mit Einwilligung aufgenommene deutsche Anrufaufnahmen (Uhrzeiten, Datumsangaben, Hamburger Nachnamen, Straßennamen, Fachbegriffe, Referenzcodes) als Abnahmegrundlage. Ohne dieses Material gibt es **keine** belastbare Aussage zur deutschen Erkennungsqualität — es existiert keine einzige veröffentlichte Zahl für Deutsch, Telefonband oder ältere Sprecher.

### Phase 1 — Ohne Key baubar und testbar

- **AP1 — BUILDABLE NOW.** Reine Audiomodule mit `node --test`: `mulaw.ts` (Rundlauf über alle 256 Codes), `resample.ts` (8k↔24k, 48k→24k; bytegenaue Fixture-Vergleiche wie im Projekt üblich), `vad.ts` (Rauschboden, Stimmhaftigkeit, Nachlauf unter 20-dB-Sprung).
- **AP2 — BUILDABLE NOW.** `addressee.ts` als reine Funktion plus deutscher Fixture-Korpus: 30 adressierte Äußerungen, 30 Nebengespräche, 10 Echos, 10 Rückkanalwörter, 10 Notfälle. Test-Zusicherung: **kein `aside` erzeugt je einen HTTP-Aufruf, kein Notfall wird je unterdrückt.**
- **AP3 — BUILDABLE NOW.** `letters.ts`: Buchstabierparser, der **gleichzeitig** DIN 5009:2022 (Aachen, Berlin, Chemnitz … Zwickau), die alte Namenstafel (Anton, Berta, Cäsar) und NATO akzeptiert, weil Anrufer sie mischen; dazu die 15 häufigsten deutschen E-Mail-Domains als Abkürzung (gmx.de, web.de, t-online.de …) und die Zeichentabelle (at/ätt/klammeraffe, punkt, bindestrich, unterstrich).
- **AP4 — BUILDABLE NOW.** `spoken.ts`: `ChatResponse` → Sprechtext. Deutsche Normalisierung mit Unit-Tests (Uhrzeiten „sieben Uhr fünfzehn", Datum „am zwölften März", Rufnummer gruppiert, Abkürzungen ausgeschrieben). Referenzcode **immer** buchstabiert und dann klar wiederholt: „P wie Potsdam, E wie Essen, Bindestrich, vier, F wie Frankfurt, sieben, K wie Köln — also: P E, vier F sieben K." Achtung: Das vorhandene Alphabet in `cockpit/lib/ref.ts` schließt 0/O/1/I bereits aus, enthält aber weiterhin die deutsche Reimgruppe B/P/D/E/G/T/V/Z/C sowie M/N und F/S — beim Zurücklesen durch den Anrufer nur unscharf gegen die tatsächlichen Kandidaten matchen, nie blind parsen. Zusätzlich: Für Großbuchstaben-Eingaben ist bei OpenAI-TTS „kein Ton bei HTTP 200" gemeldet worden — der Codevorlesetext ist die riskanteste Äußerung des ganzen Systems und muss end-to-end über den echten 8-kHz-µ-law-Pfad aufgezeichnet abgenommen werden.
- **AP5 — BUILDABLE NOW.** Quick-Reply-Matcher (deutsche Synonymtabellen je Quick-ID → `{action:{kind:"quick",id}}`, was die LLM-Klassifikation vollständig umgeht und damit sicherer ist als Freitext).
- **AP6 — BUILDABLE NOW.** Relay-Gerüst: `SpeechProvider`-Interface, Session-Automat (`idle → greeting → listening ⇄ ducked → thinking → speaking → closing`), Timeouts (Stille-Nachfrage 7 s, Ende 20 s, Turn-Maximum 30 s, Denk-Füller 1,2 s, Denk-Timeout 8 s, Grace 30 s), harte Kappen (Session 8/10 min, 40 Turns, 6 min abgerechnetes Audio, 4 gleichzeitige Sitzungen, 3 Web-Sessions/IP/Stunde, 5 Anrufe/Nummer/Tag). Jede Kappe endet **gesprochen** mit Praxisnummer, nie in Stille.
- **AP7 — BUILDABLE NOW.** `e2e/fake-speech.mjs` nach dem Muster von `e2e/fake-llm.mjs`, inklusive `POST /__mode` und `GET /__calls`. Modi: `ok`, `slow`, `drop`, `garbage`, `aside`, `echo`, `hang`. Das Fake erkennt keine Sprache — der Test schickt per `POST /__script` die Transkripte, das Fake gibt das nächste aus, sobald ≥ 300 ms Nicht-Stille und ≥ 400 ms Stille vorlagen. Damit bleiben die **echte** VAD-, Turn- und Barge-in-Logik unter Test, während der Test nur einen 440-Hz-Sinus und Nullen braucht. Echte Ereignisnamen emittieren.
- **AP8 — BUILDABLE NOW.** Browser: `pcm-worklet.js`, `player-worklet.js` (Ringpuffer, `flush`-Kommando), `MicButton.tsx`, `data-voice-state` am Widget-Root. Playwright mit `--use-file-for-fake-audio-capture` gibt einen echten `getUserMedia`→Worklet→PCM24k-Pfad ohne Hardware und ohne Key. Barge-in-Test: `ducked` in < 100 ms, `listening` in < 400 ms, `aborted: 1` im Fake-Log.
- **AP9 — BUILDABLE NOW.** IVR-Ansagen als vorgerenderte WAV-Dateien (mono, 16 bit PCM, 8 kHz — sipgate-Anforderung), zunächst mit einer Menschenstimme aus dem Team eingesprochen. Das entfernt die höchstfrequente Ausgabe komplett vom Live-TTS-Pfad und ist zugleich die Rückfallebene, falls die deutsche Sprachqualität durchfällt.

### Phase 2 — Erst nach Phase 0

- **AP10 — BLOCKED ON OWNER.** `speech/openai.ts` implementieren (~200 Zeilen) und die drei offenen Empirie-Fragen mit einem Wegwerf-Key klären: WebSocket-URL und EU-Pendant, G.711-Akzeptanz, ob `delay` von `gpt-transcribe` respektiert wird.
- **AP11 — BLOCKED ON OWNER.** sipgate-Bridge aufsetzen (Docker, registriert auf UDP 5060, RTP 10000–10099, erreichbare öffentliche IP über `SDP_CONTACT_IP`), IVR-Fluss end-to-end, Rückfall auf Team bei jedem Fehler.
- **AP12 — BLOCKED ON OWNER — Abnahme-Gate.** Deutscher Hörtest durch Muttersprachler über den **echten** 8-kHz-Telefonpfad an genau den Sätzen, die produktiv fallen (Begrüßung, Terminangebot mit Uhrzeit, Bestätigung, Referenzcode, Rufnummer). Parallel WER-Messung an den 30–50 Aufnahmen. **Go/No-Go, kein Optimierungsschritt.**
- **AP13 — BLOCKED ON OWNER.** Ausfallkonzept: zweiter Relay plus carrierseitiger Health-Check, der die Nummer direkt an das Team leitet. 12 €/Monat statt 6 € — der Unterschied zwischen „Assistent degradiert" und „Praxis nicht erreichbar".

---

## 7. Was ich Ihnen zu überdenken raten würde

**„OpenAI only" für die Stimme ist in dieser Form nicht haltbar, und das ist kein Formalismus.** Erstens braucht der Telefonkanal zwingend einen Carrier — OpenAIs eigener SIP-Weg erzwingt die Sprache-zu-Sprache-Session, die Sie ausgeschlossen haben, und kennt kein DTMF. Zweitens, und schwerer: Sobald Sie EU-Residenz durchsetzen, bleibt als Mund praktisch nur **`tts-1`** übrig — ein älteres Modell ohne `instructions`-Steuerung. Sie haben dann eine nicht steuerbare Stimme in einem Modell, dessen deutsche Qualität von **keiner Seite** gemessen ist: OpenAI schreibt selbst, die Stimmen seien „optimized for English", es gibt keinen Sprach- oder Locale-Parameter, und ich konnte keine einzige unabhängige, reproduzierbare Bewertung deutscher OpenAI-TTS-Ausgabe finden — weder positiv noch negativ. Was existiert, sind Community-Berichte über einen hörbaren amerikanischen Einschlag in nicht-englischen Sprachen und, für das neuere Modell, gemeldete Fehlerraten von ~14–20 % bei abgeschnittenen Sätzen und stillen HTTP-200-Antworten. Ein still verschlucktes „Ihr Termin ist am Dienstag um neun Uhr" ist auf einer Praxisleitung ein aufgelegter Patient. **Die Konsequenz: Behandeln Sie die deutsche Sprachqualität als Go/No-Go-Gate mit Muttersprachler-Hörtest über die echte Telefonleitung, bevor Sie irgendetwas zusagen — und planen Sie ein Budget dafür ein, dass dieser Test scheitert.** Der Notausgang wäre dann: vorgesprochene menschliche Ansagen plus reiner Textkanal im Web, oder ein EU-nativer TTS-Anbieter mit eigenem AVV. Letzteres widerspricht Ihrer Entscheidung — ich nenne es trotzdem, weil die Alternative ist, Patienten mit einer schlechten Stimme zu empfangen.

**Die Schwäche des Splits „freie LLMs für Logik, OpenAI für Stimme" liegt nicht dort, wo man sie vermutet.** Die Logiktrennung selbst ist richtig und die stärkste Eigenschaft des Entwurfs: Der Relay trägt `ChatState` blind weiter, damit erbt der Sprachkanal Notfallpfad, Blockliste, Buchungslimit und Grounding-Check des bestehenden Orchestrators geschenkt. Die eigentlichen Schwächen sind zwei andere. Erstens: Weil Sie die Realtime-Konversationssession meiden, verzichten Sie auf OpenAIs eingebaute Barge-in-Primitive (`response.cancel`, `conversation.item.truncate`, automatisches Abschneiden ungespielter Ausgabe) und bauen sie im Relay nach. Das ist machbar — die Anleitung oben ist vollständig — aber es ist echte Arbeit und es ist der Teil, der im Fehlerfall am unangenehmsten auffällt. Zweitens: Die kostenlosen LLM-Tarife haben keine Zusage zu Verfügbarkeit oder Latenz. Im Textchat ist ein langsamer oder fehlender Klassifikator eine Sekunde Wartezeit; am Telefon ist es Stille in der Leitung. Der Denk-Timeout von 8 s mit Füllersatz und harter Übergabe an das Team ist deshalb keine Feinheit, sondern tragende Struktur.

**Die Anforderung „erkennen, wenn der Patient mit jemand anderem spricht" wird nicht erfüllt, sondern angenähert.** Kein Modell in OpenAIs Programm liefert Sprecheridentität im Livebetrieb, und dasjenige, das Sprecherlabels könnte, ist weder realtime-fähig noch EU-residenzfähig noch langfristig verfügbar. Sie bekommen eine Heuristik mit definiertem Fehlverhalten: im Zweifel schweigen, nie buchen, nachfragen, an den Menschen übergeben. Das ist die richtige Ausrichtung des Fehlers, aber es ist nicht das, was die Anforderung wörtlich verlangt. Sagen Sie das intern klar, bevor jemand es dem Team anders verspricht.

**Zwei Vereinfachungen, die ich ernsthaft erwägen würde.** Erstens: `bookPublicSlot` verlangt eine E-Mail-Adresse, und eine E-Mail per Telefon zu buchstabieren ist der mit Abstand schlechteste Schritt in jedem Sprachdialog und der häufigste Abbruchgrund. Lassen Sie den Sprachkanal **Name und Rückrufnummer** aufnehmen und einen Rückrufwunsch (`kind:"rueckruf"`) mit dem gewünschten Termin in der Notiz erzeugen — das Team bestätigt. Kein Buchstabieren, keine Fehlbuchung, keine Willenserklärung per Maschine. Zweitens: Starten Sie mit dem **Web-Mikrofon allein**. Es hat keine Nummernportierung, keinen Carriervertrag, keine SIP-Firewallregeln, kein 8-kHz-Qualitätsproblem, kein Notfallrisiko einer stummen Praxisleitung — und es beantwortet alle drei Ihrer inhaltlichen Fragen (Verstehen beim Sprechen, Unterbrechen, Nebengespräche) an echten Nutzern. Wenn das trägt, ist der Telefonkanal danach überwiegend Integrationsarbeit auf bereits bewiesener Logik.

**Und schließlich der ehrliche Kaufvergleich.** sipgate verkauft einen fertigen deutschen KI-Telefonassistenten für 180–351 €/Monat bei Ihrem Volumen; der Eigenbau liegt bei 28–40 €. Die Ersparnis von rund 2.000 €/Jahr ist nicht das entscheidende Argument — sie entspricht etwa einem halben Tag Praxisumsatz. Das entscheidende Argument für den Eigenbau ist, dass Ihre Buchungslogik, Ihre Sicherheitsregeln und Ihr Datenfluss bei Ihnen bleiben und Sie den einzigen Anbieter im Pfad, der Gesundheitsdaten sieht, jederzeit in einer Datei austauschen können. Das entscheidende Argument dagegen ist, dass an der Telefonleitung einer Arztpraxis dann ein 6-€-Server hängt, für den Sie die Bereitschaft tragen. Bauen Sie die Rückfallebene auf den Menschen vom ersten Tag an — sonst ist der Vergleich nicht fair.