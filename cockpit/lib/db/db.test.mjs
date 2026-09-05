/**
 * Datenbank-Integrität gegen PGlite (echtes Postgres, im Speicher):
 * Migrationen laufen durch, der Ausschluss-Constraint verhindert
 * Doppelbuchungen, das Audit-Log ist unveränderlich, Stammdaten sitzen.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.PGLITE_DIR = ":memory:";
delete process.env.DATABASE_URL;

const { getDb } = await import("./client.ts");
const schema = await import("./schema.ts");
const { sql } = await import("drizzle-orm");

// Drizzle verpackt DB-Fehler ("Failed query …"); die Ursache steht in cause
const says = (re) => (e) => re.test(`${e?.message ?? ""} ${e?.cause?.message ?? ""}`);

let db;
before(async () => {
  db = await getDb();
});
after(async () => {
  // PGlite im Speicher – nichts aufzuräumen
});

test("Migrationen: Stammdaten vorhanden", async () => {
  const settings = await db.select().from(schema.practiceSettings);
  assert.equal(settings.length, 1);
  assert.equal(settings[0].bookingLive, false);
  const hours = await db.select().from(schema.openingHours);
  assert.equal(hours.length, 7);
  const types = await db.select().from(schema.appointmentTypes);
  assert.equal(types.length, 7);
  assert.ok(types.some((t) => t.id === "unklar"));
});

test("Ausschluss-Constraint: überlappende aktive Termine sind unmöglich", async () => {
  const a = {
    ref: "PE-TEST",
    typeId: "kontrolle",
    startsAt: new Date("2026-03-02T07:00:00Z"),
    endsAt: new Date("2026-03-02T07:20:00Z"),
    bufferMin: 10,
    piiEnc: "v1:x:y:z",
    status: "booked",
  };
  await db.insert(schema.appointments).values(a);
  // 07:25 liegt im Puffer (07:20 + 10 min) → muss scheitern
  await assert.rejects(
    db.insert(schema.appointments).values({
      ...a,
      ref: "PE-TES2",
      startsAt: new Date("2026-03-02T07:25:00Z"),
      endsAt: new Date("2026-03-02T07:45:00Z"),
    }),
    says(/appointments_no_overlap/),
  );
  // Stornierte Termine blockieren nicht
  await db.insert(schema.appointments).values({
    ...a,
    ref: "PE-TES3",
    status: "cancelled",
    startsAt: new Date("2026-03-02T07:25:00Z"),
    endsAt: new Date("2026-03-02T07:45:00Z"),
  });
  // Nach dem Puffer ist frei
  await db.insert(schema.appointments).values({
    ...a,
    ref: "PE-TES4",
    startsAt: new Date("2026-03-02T07:30:00Z"),
    endsAt: new Date("2026-03-02T07:50:00Z"),
  });
  const rows = await db.select().from(schema.appointments);
  assert.equal(rows.length, 3);
});

test("Audit-Log: UPDATE und DELETE werden vom Trigger abgewiesen", async () => {
  const [row] = await db
    .insert(schema.auditLog)
    .values({ action: "test", entity: "x", hash: "h1" })
    .returning();
  await assert.rejects(
    db.execute(sql`UPDATE audit_log SET action = 'geändert' WHERE id = ${row.id}`),
    says(/unveränderlich/),
  );
  await assert.rejects(db.execute(sql`DELETE FROM audit_log WHERE id = ${row.id}`), says(/unveränderlich/));
  const [again] = await db.select().from(schema.auditLog);
  assert.equal(again.action, "test");
  assert.equal(typeof again.seq, "number");
});

test("updated_at wird beim UPDATE automatisch gesetzt", async () => {
  const [row] = await db
    .insert(schema.appointments)
    .values({
      ref: "PE-UPD1",
      typeId: "kontrolle",
      startsAt: new Date("2026-03-03T07:00:00Z"),
      endsAt: new Date("2026-03-03T07:15:00Z"),
      piiEnc: "v1:x:y:z",
      updatedAt: new Date("2020-01-01T00:00:00Z"),
    })
    .returning();
  await db.execute(sql`UPDATE appointments SET status = 'confirmed' WHERE id = ${row.id}`);
  const [after] = await db.select().from(schema.appointments).where(sql`id = ${row.id}`);
  assert.ok(after.updatedAt.getTime() > new Date("2025-01-01").getTime());
});
