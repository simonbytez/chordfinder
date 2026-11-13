import { connection } from "next/server";
import { sendDueDigests } from "@lp/lib/alerts/digest";
import { processPendingEvents } from "@lp/lib/alerts/matcher";
import { checkCronAuth } from "@lp/lib/cron-auth";

export const maxDuration = 120;

/**
 * Send due email digests (daily, or Fridays for weekly).  Safe to call hourly:
 * users are skipped until their schedule is due.  ?force=1 ignores schedules.
 */
async function handle(req: Request) {
  await connection();
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const alerts = await processPendingEvents();
  const digests = await sendDueDigests({ force });
  return Response.json({ alerts, digests });
}

export const GET = handle;
export const POST = handle;
