import { connection } from "next/server";
import { checkCronAuth, cronParams } from "@lp/lib/cron-auth";
import { runCommunityIngestion } from "@lp/lib/ingestion/run";

export const maxDuration = 120;

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
