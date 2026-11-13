import { timingSafeEqual } from "node:crypto";

/**
 * Cron endpoints require `Authorization: Bearer ${CRON_SECRET}`.
 * Returns an error Response when unauthorized, otherwise null.
 */
export function checkCronAuth(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured on the server" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="lumenpulse-cron"' } });
  }
  return null;
}

export function cronParams(req: Request) {
  const url = new URL(req.url);
  const max = Number(url.searchParams.get("max"));
  return {
    sourceId: url.searchParams.get("source") ?? undefined,
    force: url.searchParams.get("force") === "1",
    maxSources: Number.isFinite(max) && max > 0 ? Math.min(max, 20) : undefined,
  };
}
