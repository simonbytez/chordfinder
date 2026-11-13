import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * One typed Drizzle handle for two drivers:
 *  - LUMENPULSE_DATABASE_URL=postgres://…  → postgres.js (Supabase, Neon, RDS, local PG)
 *  - no LUMENPULSE_DATABASE_URL → embedded PGlite (real Postgres 18 compiled to
 *                                 WASM) persisted under .data/lumenpulse, for
 *                                 zero-setup local development. On Vercel the
 *                                 only writable place is /tmp, so it lives there
 *                                 and resets on every cold start; set
 *                                 LUMENPULSE_DATABASE_URL for real use.
 *
 * Both expose the same query-builder API; we type the handle as the postgres-js
 * flavour and only use builder methods whose results are identical across drivers.
 */
export type Database = PostgresJsDatabase<typeof schema>;

type Handle = { db: Database; ready: Promise<void>; kind: "postgres" | "pglite"; close: () => Promise<void> };

const g = globalThis as unknown as { __lumenpulseDb?: Promise<Handle> };

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "src", "lumenpulse", "drizzle");

/** True when the database is a throwaway PGlite in /tmp on a serverless host. */
export const ephemeralDb = () => !usingPostgres() && !!process.env.VERCEL && !process.env.LUMENPULSE_PGLITE_DIR;

export function usingPostgres(): boolean {
  const url = process.env.LUMENPULSE_DATABASE_URL;
  return !!url && /^postgres(ql)?:\/\//.test(url);
}

async function createHandle(): Promise<Handle> {
  if (usingPostgres()) {
    const { default: postgres } = await import("postgres");
    const client = postgres(process.env.LUMENPULSE_DATABASE_URL!, {
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
  const dataDir =
    process.env.LUMENPULSE_PGLITE_DIR ?? (process.env.VERCEL ? "/tmp/lumenpulse-pglite" : path.join(process.cwd(), ".data", "lumenpulse"));
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
