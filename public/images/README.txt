dr-kunstreich.webp  – freigestelltes Porträt (WebP mit Transparenz, 1086 x 1448)

Foto austauschen: diese Datei überschreiben (Hochformat 3:4, freigestellt,
transparenter Hintergrund). Es erscheint automatisch auf der Website –
keine Code-Änderung nötig.

praxis-raum-*.webp  – Umgebungsebene der Team-Szene (1600/960 px, plus die
weichgezeichnete Variante praxis-raum-soft-*.webp). Aktuell aus dem echten
Gruppenfoto abgeleitet.

Empfangsfoto austauschen: die vier praxis-raum-Dateien mit dem neuen Motiv
überschreiben (Querformat, ~3:2, möglichst ohne Personen). Die weiche
Variante entsteht mit `sharp(...).blur(w/34).modulate({ brightness: 1.06 })`.

Danach zwei Werte anheben, damit der Raum sichtbar wird (siehe README):
  app/globals.css              .team-env-blur { opacity: 0 }  ->  0.85
  components/team/TeamScene.tsx  ENV_REVEAL = 0               ->  0.6

untersuchungsraum-*.webp – der ECHTE Untersuchungsraum (vom Praxisinhaber
geliefert, 1536 x 1024). Trägt die Zustände Diagnostik und Behandlung der
Kamerafahrt (Klassen .exam-env-soft / .exam-env-sharp in app/globals.css).
Austausch: die vier Dateien 1:1 überschreiben; die weiche Variante entsteht
mit `sharp(...).blur(w/34).modulate({ brightness: 1.06 })`.
