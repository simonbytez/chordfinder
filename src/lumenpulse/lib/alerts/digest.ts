import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@lp/db";
import * as s from "@lp/db/schema";
import { getLightsByIds } from "../queries";
import type { DeliveryResultDTO } from "../types";
import { sendEmail } from "./channels";
import { renderDigestEmail } from "./email-templates";
import { buildEventPayload } from "./payload";

export type DigestRunResult = { userId: string; sent: boolean; items: number; detail: string };

function isDue(schedule: "daily" | "weekly_friday", last: Date | null, now: Date): boolean {
  const since = last ? now.getTime() - last.getTime() : Infinity;
  if (schedule === "daily") return since >= 20 * 3600_000;
  return now.getUTCDay() === 5 && since >= 6 * 24 * 3600_000;
}

/**
 * Send email digests that are due. Idempotent: each match is marked
 * digest_sent_at once included, and users are skipped until their schedule is
 * due again. `force` ignores the schedule (admin "Send digests now").
 */
export async function sendDueDigests(opts: { force?: boolean; userId?: string; now?: Date } = {}): Promise<DigestRunResult[]> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const settings = await db
    .select()
    .from(s.notificationSettings)
    .where(and(isNotNull(s.notificationSettings.emailAddress), opts.userId ? eq(s.notificationSettings.userId, opts.userId) : undefined));

  const out: DigestRunResult[] = [];
  for (const st of settings) {
    if (!opts.force && !isDue(st.digestSchedule, st.lastDigestSentAt, now)) continue;
    const pending = await db
      .select()
      .from(s.alertMatches)
      .where(and(eq(s.alertMatches.userId, st.userId), eq(s.alertMatches.digestPending, true), isNull(s.alertMatches.digestSentAt)))
      .orderBy(asc(s.alertMatches.createdAt))
      .limit(60);
    if (!pending.length) {
      out.push({ userId: st.userId, sent: false, items: 0, detail: "Nothing pending" });
      continue;
    }

    // One entry per (light, event type), newest event wins.
    const eventIds = [...new Set(pending.map((m) => m.eventId))];
    const events = await db.select().from(s.productEvents).where(inArray(s.productEvents.id, eventIds));
    const lights = new Map((await getLightsByIds([...new Set(events.map((e) => e.flashlightId))], st.userId)).map((l) => [l.id, l]));
    const seen = new Set<string>();
    const payloads = events
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((e) => {
        const k = `${e.flashlightId}:${e.type}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((e) => {
        const light = lights.get(e.flashlightId);
        return light ? buildEventPayload(e.type, light, { oldPrice: e.oldPrice, newPrice: e.newPrice }) : null;
      })
      .filter((p): p is NonNullable<typeof p> => !!p);

    const result: DeliveryResultDTO = await sendEmail(st.emailAddress!, renderDigestEmail(payloads, st.digestSchedule), "email_digest");
    if (result.ok) {
      await db
        .update(s.alertMatches)
        .set({ digestSentAt: now, digestPending: false })
        .where(
          inArray(
            s.alertMatches.id,
            pending.map((m) => m.id),
          ),
        );
      await db.update(s.notificationSettings).set({ lastDigestSentAt: now }).where(eq(s.notificationSettings.userId, st.userId));
    }
    out.push({ userId: st.userId, sent: result.ok, items: payloads.length, detail: result.detail });
  }
  return out;
}
