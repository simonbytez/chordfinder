import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

// Same lookup as databaseUrl() in db/index.ts.
const url = [process.env.LUMENPULSE_DATABASE_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL].find(
  (u) => !!u && /^postgres(ql)?:\/\//.test(u),
);
const usePostgres = !!url;

/**
 * Run from the repo root (the npm scripts pass --config for you).
 * `npm run lumenpulse:db:generate` only diffs the schema, so it works without a database.
 * `drizzle-kit studio/push` talk to Postgres when a database URL is set, otherwise
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
