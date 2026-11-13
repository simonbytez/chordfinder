import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@lp/db";
import { pushSubscriptions } from "@lp/db/schema";
import { requireUserId } from "@lp/lib/user";

const SubSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(8).max(200) }),
});

/** Save (or move to this device identity) a Web Push subscription. */
export async function POST(req: Request) {
  const parsed = SubSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid subscription" }, { status: 400 });
  const userId = await requireUserId();
  const db = await getDb();
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth, failureCount: 0 },
    });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return Response.json({ error: "endpoint required" }, { status: 400 });
  const userId = await requireUserId();
  const db = await getDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, body.endpoint), eq(pushSubscriptions.userId, userId)));
  return Response.json({ ok: true });
}
