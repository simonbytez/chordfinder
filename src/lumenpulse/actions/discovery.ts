"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@lp/db";
import { sources } from "@lp/db/schema";
import { processPendingEvents } from "@lp/lib/alerts/matcher";
import { syncSource } from "@lp/lib/ingestion/engine";

const MIN_REFRESH_MS = 10 * 60_000;

/**
 * Public "pull the latest buzz" button on Community Radar. Rate-limited per
 * source (10 min) so it can't be used to hammer Reddit/BLF.
 */
export async function refreshRadar(): Promise<{ refreshed: string[]; skipped: string[]; errors: string[] }> {
  const db = await getDb();
  const list = await db.select().from(sources).where(eq(sources.adapterType, "reddit_rss"));
  const refreshed: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const src of list) {
    if (src.status === "paused") continue;
    if (src.lastPolledAt && Date.now() - src.lastPolledAt.getTime() < MIN_REFRESH_MS) {
      skipped.push(src.name);
      continue;
    }
    const r = await syncSource(src.id, { force: true });
    if (r.ok) refreshed.push(src.name);
    else errors.push(`${src.name}: ${r.error}`);
  }
  await processPendingEvents();
  refresh();
  return { refreshed, skipped, errors };
}
