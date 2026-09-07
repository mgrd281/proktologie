import { NextResponse } from "next/server";
import { z } from "zod";
import { bearerAuthorized } from "@/lib/api/bearer";
import { publicStatus } from "@/lib/booking/public";
import * as repo from "@/lib/booking/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Betriebsschalter der Online-Buchung von außen – für den Fall, dass gerade
 * niemand mit frischer Sitzung im Cockpit sitzt (Erstinbetriebnahme,
 * Notfall). Geht denselben Weg wie der Schalter „Website-Buchung live“ in
 * den Einstellungen: `repo.updateSettings`. Die Sperre „kein Live-Betrieb
 * mit Demo-Daten“ und das Audit-Protokoll gelten also auch hier; ersetzt
 * wird nur die Schritt-hoch-Prüfung der Sitzung durch das Betriebsgeheimnis,
 * das ohnehin Migrationen ausführen darf.
 *
 * Aufruf: POST mit `Authorization: Bearer <MIGRATE_SECRET>` und JSON-Körper
 * `{ bookingLive?, bookingPaused?, bannerText? }`. Antwort: der öffentliche
 * Zustand, wie ihn die Website sieht. Ohne Geheimnis existiert die Route
 * nach außen nicht (404).
 */
const schema = z
  .object({
    bookingLive: z.boolean().optional(),
    bookingPaused: z.boolean().optional(),
    bannerText: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

export async function POST(req: Request) {
  if (!bearerAuthorized(req, process.env.MIGRATE_SECRET)) return new NextResponse(null, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Erwartet: { bookingLive?: boolean, bookingPaused?: boolean, bannerText?: string | null }" },
      { status: 400 },
    );
  }
  try {
    await repo.updateSettings(parsed.data, "betrieb");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Nur die Demo-Sperre aus updateSettings ist ein Konflikt – alles andere
    // (Datenbank nicht erreichbar, Migrationen fehlen) ist ein echter Fehler
    // und darf keine Verbindungszeichenkette oder SQL nach außen tragen.
    if (message.startsWith("Live-Betrieb nicht möglich")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: "Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
  }
  return NextResponse.json(await publicStatus());
}
