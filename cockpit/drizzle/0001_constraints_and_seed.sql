-- Fachliche Integrität, die Drizzle nicht ausdrücken kann, plus Stammdaten.

-- 1) Belegter Zeitraum inkl. Puffer. Bewusst KEINE generierte Spalte:
--    timestamptz + interval ist in Postgres nur STABLE, nicht IMMUTABLE,
--    und darf deshalb weder in GENERATED-Spalten noch in Index-Ausdrücken
--    stehen. Ein BEFORE-Trigger pflegt die Spalte stattdessen.
ALTER TABLE "appointments" ADD COLUMN "blocks_until" timestamptz;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION appointments_fill_blocks_until() RETURNS trigger AS $$
BEGIN
  NEW.blocks_until := NEW.ends_at + (NEW.buffer_min * interval '1 minute');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER appointments_blocks_until
  BEFORE INSERT OR UPDATE OF ends_at, buffer_min ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION appointments_fill_blocks_until();
--> statement-breakpoint

-- 2) Ausschluss-Constraint: zwei aktive Termine können sich nie überlappen –
--    nicht in der App, nicht per SQL, nicht bei parallelen Buchungen.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "blocks_until", '[)') WITH &&)
  WHERE ("status" IN ('booked', 'confirmed', 'reminded'));
--> statement-breakpoint

-- 3) Audit-Log ist revisionssicher: UPDATE/DELETE scheitern auf Datenbankebene.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log ist unveränderlich (nur INSERT)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_change
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint

-- 4) updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER appointments_touch BEFORE UPDATE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER requests_touch BEFORE UPDATE ON "requests"
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint

-- 5) Stammdaten. Einstellungen als Singleton; Sprechzeiten = die echten,
--    bestätigten Zeiten der Praxis (content/site.ts der Website).
INSERT INTO "practice_settings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "opening_hours" ("weekday", "opens", "closes") VALUES
  (1, '07:00', '12:00'),
  (2, '07:00', '12:00'), (2, '14:00', '18:00'),
  (3, '07:00', '12:00'),
  (4, '07:00', '12:00'), (4, '14:00', '18:00'),
  (5, '07:00', '12:00');
--> statement-breakpoint

-- Terminarten: dieselben sieben wie in der Buchungskarte der Website
-- (content/booking.ts). Dauer/Puffer sind Standardwerte, die die Praxis
-- im Cockpit anpasst – keine medizinischen Annahmen.
INSERT INTO "appointment_types" ("id", "label", "note", "duration_min", "buffer_min", "sort_order", "color") VALUES
  ('unklar',           'Beschwerden / unklar',              'Wir klären das gemeinsam', 20, 0, 10, 'green'),
  ('erstuntersuchung', 'Proktologische Erstuntersuchung',   NULL,                       30, 0, 20, 'moss'),
  ('kontrolle',        'Kontrolltermin',                    NULL,                       15, 0, 30, 'slate'),
  ('haemorrhoiden',    'Hämorrhoiden',                      NULL,                       20, 0, 40, 'green'),
  ('analfissur',       'Analfissur',                        NULL,                       20, 0, 50, 'green'),
  ('analfistel',       'Analfistel',                        NULL,                       20, 0, 60, 'green'),
  ('nachsorge',        'Nachsorge',                         NULL,                       15, 0, 70, 'blue')
ON CONFLICT DO NOTHING;
