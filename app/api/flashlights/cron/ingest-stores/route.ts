import { connection } from "next/server";
import { checkCronAuth, cronParams } from "@lp/lib/cron-auth";
import { runStoreIngestion } from "@lp/lib/ingestion/run";

// Vercel Hobby caps functions at 60 s; ingestion stops starting new work before then (see lib/ingestion/run.ts).
export const maxDuration = 60;

/**
 * Poll due Shopify + sitemap sources, then run the alert matcher.
 *   GET|POST /api/flashlights/cron/ingest-stores   (Authorization: Bearer $CRON_SECRET)
 *   ?source=<id>  only this source   ?force=1  ignore poll interval   ?max=N  sources per call
 */
async function handle(req: Request) {
  await connection();
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const report = await runStoreIngestion(cronParams(req));
  return Response.json(report);
}

export const GET = handle;
export const POST = handle;
