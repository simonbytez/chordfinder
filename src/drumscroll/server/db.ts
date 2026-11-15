import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type Handle = {
  db: Database;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
};

const g = globalThis as unknown as { __drumscrollDb?: Promise<Handle> };

const URL_VARS = ["DRUMSCROLL_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"] as const;

export function databaseUrl(): string | undefined {
  for (const name of URL_VARS) {
    const url = process.env[name];
    if (url && /^postgres(ql)?:\/\//.test(url)) return url;
  }
  return undefined;
}

export const usingPostgres = () => !!databaseUrl();

/** On Vercel without a Postgres URL there is no persistent database. */
export const databaseMissing = () =>
  !usingPostgres() && !!process.env.VERCEL && !process.env.DRUMSCROLL_PGLITE_DIR;

async function createHandle(): Promise<Handle> {
  if (databaseMissing()) {
    throw new Error(
      "DrumScroll has no database: connect a Postgres database (e.g. Neon) to the Vercel project so DATABASE_URL is set, then redeploy.",
    );
  }

  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, {
      max: Number(process.env.DRUMSCROLL_DB_POOL_MAX ?? 5),
      prepare: false, // Safe for Supabase / Neon pooled connections
      onnotice: () => {},
    });
    const db = drizzlePostgres({ client, schema });
    return { db, kind: "postgres", close: () => client.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dataDir = process.env.DRUMSCROLL_PGLITE_DIR ?? path.join(process.cwd(), ".data", "drumscroll");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite({ client, schema }) as unknown as Database;
  return { db, kind: "pglite", close: () => client.close() };
}

async function ensureTables(db: Database): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drumscroll_transcriptions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      artist_or_corps TEXT NOT NULL DEFAULT 'Unknown',
      instrument TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      difficulty_overridden BOOLEAN NOT NULL DEFAULT FALSE,
      page_count INTEGER NOT NULL DEFAULT 1,
      source_url TEXT NOT NULL,
      pdf_url TEXT NOT NULL,
      preview_image_url TEXT,
      bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
      source_site TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS drumscroll_transcriptions_pdf_url_idx
      ON drumscroll_transcriptions (pdf_url);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS drumscroll_transcriptions_filters_idx
      ON drumscroll_transcriptions (instrument, category, difficulty, bookmarked);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drumscroll_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      instrument TEXT NOT NULL,
      default_category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      last_run_at TIMESTAMPTZ,
      last_status TEXT NOT NULL DEFAULT 'idle',
      item_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
}

async function init(): Promise<Handle> {
  const handle = await createHandle();
  await ensureTables(handle.db);
  if (process.env.DRUMSCROLL_AUTO_SEED !== "false") {
    const { seedDrumScrollDatabase } = await import("./seed");
    await seedDrumScrollDatabase(handle.db);
  }
  return handle;
}

/** Lazily connect, ensure tables exist, and auto-seed on first boot. */
export async function getDb(): Promise<Database> {
  if (!g.__drumscrollDb) {
    g.__drumscrollDb = init().catch((err) => {
      g.__drumscrollDb = undefined;
      throw err;
    });
  }
  return (await g.__drumscrollDb).db;
}

export async function getDbKind(): Promise<"postgres" | "pglite"> {
  if (!g.__drumscrollDb) {
    await getDb();
  }
  return (await g.__drumscrollDb!).kind;
}

/** For CLI scripts: run fn with a db handle, then close cleanly. */
export async function withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const handle = await createHandle();
  try {
    await ensureTables(handle.db);
    return await fn(handle.db);
  } finally {
    await handle.close();
  }
}

export { schema };
