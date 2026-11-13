import "./load-env";
import { usingPostgres, withDb } from "../db";

async function main() {
  await withDb(async () => {
    console.log(`✓ Migrations applied (${usingPostgres() ? "PostgreSQL" : "embedded PGlite"})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
