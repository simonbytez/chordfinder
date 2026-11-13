import "./load-env";
import { usingPostgres, withDb } from "../db";
import { seedDatabase } from "../db/seed";

/**
 * npm run lumenpulse:db:seed            → seed sources + lights into an empty catalog
 * npm run lumenpulse:db:reset           → wipe catalog/alerts tables and reseed
 *
 * With embedded PGlite, stop `npm run dev` first: PGlite is single-process and
 * the dev server holds the data directory open. (The app also seeds itself
 * automatically on first boot, so this script is optional.)
 */
async function main() {
  const reset = process.argv.includes("--reset");
  await withDb(async (db) => {
    await seedDatabase(db, { reset, log: (m) => console.log(m) });
  });
  console.log(`✓ Seed complete (${usingPostgres() ? "PostgreSQL" : "embedded PGlite"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
