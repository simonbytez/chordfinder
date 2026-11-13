import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.LUMENPULSE_DATABASE_URL;
const usePostgres = !!url && /^postgres(ql)?:\/\//.test(url);

/**
 * Run from the repo root (the npm scripts pass --config for you).
 * `npm run lumenpulse:db:generate` only diffs the schema, so it works without a database.
 * `drizzle-kit studio/push` talk to Postgres when LUMENPULSE_DATABASE_URL is set, otherwise
 * to the embedded PGlite data dir used for zero-setup local development.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lumenpulse/db/schema.ts",
  out: "./src/lumenpulse/drizzle",
  ...(usePostgres
    ? { dbCredentials: { url: url! } }
    : { driver: "pglite", dbCredentials: { url: process.env.LUMENPULSE_PGLITE_DIR ?? "./.data/lumenpulse" } }),
  strict: true,
  verbose: true,
});
