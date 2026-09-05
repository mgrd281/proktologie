/**
 * Vorführdaten anlegen (siehe lib/demo/seed.ts): npm run db:seed-demo
 */
async function main() {
  const { seedDemo } = await import("../lib/demo/seed.ts");
  const r = await seedDemo(null);
  console.log(`Demo-Daten angelegt: ${r.appointments} Termine, ${r.exceptions} Ausnahmen, ${r.requests} Anfragen, ${r.waitlist} Wartelisten-Eintrag.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
