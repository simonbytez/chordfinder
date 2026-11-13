"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@lp/db";
import { sources } from "@lp/db/schema";
import { processPendingEvents } from "@lp/lib/alerts/matcher";
import { syncSource } from "@lp/lib/ingestion/engine";
import { RUN_BUDGET_MS, START_SOURCE_BEFORE_MS } from "@lp/lib/ingestion/run";

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
  const started = Date.now();
  const deadline = started + RUN_BUDGET_MS;
  for (const src of list) {
    if (src.status === "paused") continue;
    // Same time budget as the cron runs; sources not reached keep their old poll time.
    if (refreshed.length + errors.length && Date.now() - started > START_SOURCE_BEFORE_MS) break;
    if (src.lastPolledAt && Date.now() - src.lastPolledAt.getTime() < MIN_REFRESH_MS) {
      skipped.push(src.name);
      continue;
    }
    const r = await syncSource(src.id, { force: true, deadline });
    if (r.ok) refreshed.push(src.name);
    else errors.push(`${src.name}: ${r.error}`);
  }
  await processPendingEvents();
  refresh();
  return { refreshed, skipped, errors };
}
