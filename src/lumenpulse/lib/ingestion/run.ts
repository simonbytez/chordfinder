import { and, asc, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@lp/db";
import { sources } from "@lp/db/schema";
import { processPendingEvents, type MatchSummary } from "../alerts/matcher";
import { decayStatuses, sourceIsDue, syncSource, type SyncOutcome } from "./engine";

export type IngestionReport = { ran: SyncOutcome[]; alerts: MatchSummary; durationMs: number };

const STORE_TYPES = ["shopify_json", "sitemap_xml"] as const;

/**
 * Vercel Hobby kills a function at 60 s. A run stops fetching pages once this
 * budget is spent, leaving ~15 s for writes and the alert matcher; anything it
 * didn't reach stays due and the next call picks it up.
 */
export const RUN_BUDGET_MS = 45_000;
/**
 * Don't start another source after this point. A sitemap store's sync took up to
 * 33 s when measured, so quick sources still batch up while slow ones run alone.
 */
export const START_SOURCE_BEFORE_MS = 10_000;

/**
 * Process due sources of the given kind (oldest poll first), then run the alert
 * matcher. `maxSources` and the time budget keep one invocation inside serverless
 * time limits; call the cron endpoint again (or more often) to drain the queue.
 */
async function runKind(kind: "store" | "community", opts: { sourceId?: string; force?: boolean; maxSources?: number }): Promise<IngestionReport> {
  const started = Date.now();
  const deadline = started + RUN_BUDGET_MS;
  const db = await getDb();
  const types = kind === "store" ? [...STORE_TYPES] : (["reddit_rss"] as const);

  let ids: string[];
  if (opts.sourceId) {
    ids = [opts.sourceId];
  } else {
    const due = await db
      .select({ id: sources.id })
      .from(sources)
      .where(
        and(
          inArray(sources.adapterType, [...types]),
          ne(sources.status, "paused"),
          sourceIsDue,
        ),
      )
      .orderBy(sql`${sources.lastPolledAt} ASC NULLS FIRST`, asc(sources.name))
      .limit(opts.maxSources ?? (kind === "store" ? 3 : 5));
    ids = due.map((d) => d.id);
  }

  const ran: SyncOutcome[] = [];
  for (const id of ids) {
    // Unstarted sources were never claimed, so they stay due for the next call.
    if (ran.length && Date.now() - started > START_SOURCE_BEFORE_MS) break;
    ran.push(await syncSource(id, { force: opts.force, deadline }));
  }
  if (kind === "store") await decayStatuses();
  const alerts = await processPendingEvents();
  return { ran, alerts, durationMs: Date.now() - started };
}

export const runStoreIngestion = (opts: { sourceId?: string; force?: boolean; maxSources?: number } = {}) => runKind("store", opts);
export const runCommunityIngestion = (opts: { sourceId?: string; force?: boolean; maxSources?: number } = {}) => runKind("community", opts);
