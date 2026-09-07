-- Chat-Assistent: Sprache der Patienten-Mails je Termin (Bestätigung,
-- Erinnerung, Verschiebung, Absage folgen der Sprache der Buchung; Bestand
-- bleibt Deutsch) und der Schalter für das Chat-Symbol auf der Website
-- (true, damit ein bestehender Bestand nicht stumm bleibt – Abschalten
-- geschieht bewusst im Cockpit unter Einstellungen → Demo & Betrieb).
ALTER TABLE "appointments" ADD COLUMN "locale" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_settings" ADD COLUMN "chat_enabled" boolean DEFAULT true NOT NULL;