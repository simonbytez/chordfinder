import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * One typed Drizzle handle for two drivers:
 *  - a Postgres URL (see databaseUrl) → postgres.js (Neon, Supabase, RDS, local PG)
 *  - no URL → embedded PGlite (real Postgres 18 compiled to WASM) persisted under
 *             .data/lumenpulse, for zero-setup local development. Not on Vercel:
 *             setting it up takes ~800 MB, which a Hobby function (1 GB) can't
 *             spare, and /tmp would lose everything on each cold start anyway.
 *
 * Both expose the same query-builder API; we type the handle as the postgres-js
 * flavour and only use builder methods whose results are identical across drivers.
 */
export type Database = PostgresJsDatabase<typeof schema>;

type Handle = { db: Database; ready: Promise<void>; kind: "postgres" | "pglite"; close: () => Promise<void> };

const g = globalThis as unknown as { __lumenpulseDb?: Promise<Handle> };

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "src", "lumenpulse", "drizzle");

/**
 * LUMENPULSE_DATABASE_URL wins. Otherwise DATABASE_URL or POSTGRES_URL, the names Vercel's
 * Neon integration creates, so connecting a database in the dashboard is all it takes.
 */
const URL_VARS = ["LUMENPULSE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"] as const;

export function databaseUrl(): string | undefined {
  for (const name of URL_VARS) {
    const url = process.env[name];
    if (url && /^postgres(ql)?:\/\//.test(url)) return url;
  }
  return undefined;
}

export const usingPostgres = () => !!databaseUrl();

/** On Vercel without a Postgres URL there is no usable database (see the note at the top). */
export const databaseMissing = () => !usingPostgres() && !!process.env.VERCEL && !process.env.LUMENPULSE_PGLITE_DIR;

async function createHandle(): Promise<Handle> {
  if (databaseMissing()) {
    throw new Error("LumenPulse has no database: connect a Postgres database (e.g. Neon) to the Vercel project so DATABASE_URL is set, then redeploy");
  }
  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, {
      max: Number(process.env.LUMENPULSE_DB_POOL_MAX ?? 5),
      // Supabase/PgBouncer transaction pooling does not support prepared statements.
      prepare: false,
      onnotice: () => {},
    });
    const db = drizzlePostgres({ client, schema });
    return { db, kind: "postgres", ready: Promise.resolve(), close: () => client.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dataDir = process.env.LUMENPULSE_PGLITE_DIR ?? path.join(process.cwd(), ".data", "lumenpulse");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite({ client, schema }) as unknown as Database;
  return { db, kind: "pglite", ready: Promise.resolve(), close: () => client.close() };
}

async function migrateHandle(h: Handle) {
  if (process.env.LUMENPULSE_AUTO_MIGRATE === "false") return;
  if (h.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(h.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(h.db as any, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}

async function init(): Promise<Handle> {
  const h = await createHandle();
  await migrateHandle(h);
  if (process.env.LUMENPULSE_AUTO_SEED !== "false") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase(h.db, { log: (m) => console.log(`[lumenpulse] ${m}`) });
  }
  return h;
}

/** Lazily connect, migrate and (first run only) seed. Cached across hot reloads. */
export async function getDb(): Promise<Database> {
  if (!g.__lumenpulseDb) {
    g.__lumenpulseDb = init().catch((err) => {
      g.__lumenpulseDb = undefined; // allow retry on next request
      throw err;
    });
  }
  return (await g.__lumenpulseDb).db;
}

/** For CLI scripts: run fn with a db handle, then close it so the process can exit. */
export async function withDb<T>(fn: (db: Database) => Promise<T>, opts: { migrate?: boolean } = {}): Promise<T> {
  const h = await createHandle();
  try {
    if (opts.migrate !== false) await migrateHandle(h);
    return await fn(h.db);
  } finally {
    await h.close();
  }
}

export { schema };
