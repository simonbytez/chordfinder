import { and, asc, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@lp/db";
import { sources } from "@lp/db/schema";
import { processPendingEvents, type MatchSummary } from "../alerts/matcher";
import { decayStatuses, syncSource, type SyncOutcome } from "./engine";

export type IngestionReport = { ran: SyncOutcome[]; alerts: MatchSummary; durationMs: number };

const STORE_TYPES = ["shopify_json", "sitemap_xml"] as const;

/**
 * Process due sources of the given kind (oldest poll first), then run the alert
 * matcher. `maxSources` keeps one invocation inside serverless time limits;
 * call the cron endpoint again (or more often) to drain the queue.
 */
async function runKind(kind: "store" | "community", opts: { sourceId?: string; force?: boolean; maxSources?: number }): Promise<IngestionReport> {
  const started = Date.now();
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
          sql`(${sources.lastPolledAt} IS NULL OR ${sources.lastPolledAt} <= now() - make_interval(mins => ${sources.pollIntervalMins}))`,
        ),
      )
      .orderBy(sql`${sources.lastPolledAt} ASC NULLS FIRST`, asc(sources.name))
      .limit(opts.maxSources ?? (kind === "store" ? 3 : 5));
    ids = due.map((d) => d.id);
  }

  const ran: SyncOutcome[] = [];
  for (const id of ids) ran.push(await syncSource(id, { force: opts.force }));
  if (kind === "store") await decayStatuses();
  const alerts = await processPendingEvents();
  return { ran, alerts, durationMs: Date.now() - started };
}

export const runStoreIngestion = (opts: { sourceId?: string; force?: boolean; maxSources?: number } = {}) => runKind("store", opts);
export const runCommunityIngestion = (opts: { sourceId?: string; force?: boolean; maxSources?: number } = {}) => runKind("community", opts);
