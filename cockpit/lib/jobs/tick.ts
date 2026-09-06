import { expireHolds } from "../booking/lifecycle.ts";
import * as repo from "../booking/repo.ts";
import { cleanupRateLimits } from "../ratelimit.ts";
import { registerAllHandlers } from "./handlers.ts";
import { enqueue, runDue, type RunReport } from "./queue.ts";

/**
 * Der Herzschlag der Automatisierung. Wird alle 15 Minuten von außen
 * angestoßen (GitHub Actions → /api/internal/tick mit CRON_SECRET) und
 * zusätzlich lazy aus dem Cockpit (höchstens alle 5 Minuten). Jeder
 * Schritt ist idempotent – ein Tick zu viel schadet nie.
 */
export interface TickReport {
  at: string;
  remindersQueued: number;
  holdsExpired: number;
  jobs: RunReport;
  rateLimitRowsRemoved: number;
  ms: number;
}

/** Erinnerungen einreihen: für jeden Vorlauf (z. B. 48 h, 24 h) alle Termine, deren Zeitpunkt in diesem Fenster liegt. */
export async function queueReminders(now = new Date()): Promise<number> {
  const settings = await repo.getSettings();
  if (!settings.bookingLive) return 0;
  const offsets = [...new Set(settings.reminderOffsetsH.filter((h) => h > 0))].sort((a, b) => b - a);
  if (!offsets.length) return 0;
  const maxH = Math.max(...offsets);
  // Termine ab jetzt bis zum größten Vorlauf – ältere Erinnerungen wären verspätet und bleiben aus
  const upcoming = await repo.appointmentsForReminder(new Date(now.getTime() + 30 * 60_000), new Date(now.getTime() + maxH * 3600_000));
  let queued = 0;
  for (const a of upcoming) {
    const startsIn = (new Date(a.startsAt).getTime() - now.getTime()) / 3600_000;
    for (const h of offsets) {
      // Fällig, sobald der Termin näher als h Stunden liegt – und nicht schon ein kürzerer Vorlauf erledigt ist
      if (startsIn <= h && !(await repo.messageSent(a.id, `reminder:${h}h`))) {
        const ok = await enqueue({ kind: "mail.reminder", payload: { appointmentId: a.id, hoursBefore: h }, dedupeKey: `mail.reminder:${a.id}:${h}` });
        if (ok) queued++;
        break; // pro Tick eine Erinnerung je Termin
      }
    }
  }
  return queued;
}

/**
 * Jobs erzeugen Folgejobs: Eine Absage gibt den Platz frei, das Angebot an die
 * Warteliste schreibt eine Mail. Deshalb wird nachgefasst, solange noch etwas
 * fällig wird – begrenzt, damit ein fehlerhafter Job keine Endlosschleife baut.
 *
 * Wichtig: Jede Runde fragt die ECHTE Uhrzeit ab, nicht den eingefrorenen
 * Tick-Zeitpunkt. Ein währenddessen eingereihter Job trägt eine Fälligkeit
 * wenige Millisekunden nach Tick-Beginn – gegen `now` gemessen wäre er „noch
 * nicht fällig“ und die Angebotsmail käme erst beim nächsten Herzschlag,
 * also bis zu 15 Minuten später.
 */
const MAX_PASSES = 3;

export async function runTick(now = new Date()): Promise<TickReport> {
  const t0 = Date.now();
  registerAllHandlers();
  const holdsExpired = await expireHolds(now);
  const remindersQueued = await queueReminders(now);
  const jobs: RunReport = { claimed: 0, done: 0, failed: 0, errors: [] };
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const r = await runDue({ now: new Date() });
    jobs.claimed += r.claimed;
    jobs.done += r.done;
    jobs.failed += r.failed;
    jobs.errors.push(...r.errors);
    if (r.claimed === 0) break;
  }
  const rateLimitRowsRemoved = await cleanupRateLimits(now);
  return { at: now.toISOString(), remindersQueued, holdsExpired, jobs, rateLimitRowsRemoved, ms: Date.now() - t0 };
}

const LAZY_INTERVAL_MS = 5 * 60_000;
const g = globalThis as unknown as { __cockpitLastTick?: number; __cockpitTickRunning?: boolean };

/** Sicherheitsnetz: aus Seitenaufrufen heraus, gedrosselt, nie blockierend. */
export async function maybeTick(): Promise<void> {
  const now = Date.now();
  if (g.__cockpitTickRunning) return;
  if (g.__cockpitLastTick && now - g.__cockpitLastTick < LAZY_INTERVAL_MS) return;
  g.__cockpitLastTick = now;
  g.__cockpitTickRunning = true;
  try {
    await runTick(new Date(now));
  } catch {
    /* still – der externe Tick wiederholt es */
  } finally {
    g.__cockpitTickRunning = false;
  }
}
