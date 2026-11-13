import { connection } from "next/server";
import { checkCronAuth, cronParams } from "@lp/lib/cron-auth";
import { runCommunityIngestion } from "@lp/lib/ingestion/run";

// Vercel Hobby caps functions at 60 s; ingestion stops starting new work before then (see lib/ingestion/run.ts).
export const maxDuration = 60;

/** Poll r/flashlight (+ BLF) for release buzz.  Authorization: Bearer $CRON_SECRET */
async function handle(req: Request) {
  await connection();
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const report = await runCommunityIngestion(cronParams(req));
  return Response.json(report);
}

export const GET = handle;
export const POST = handle;
