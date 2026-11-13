import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@lp/db";
import * as s from "@lp/db/schema";
import type { AlertChannel } from "../constants";
import { combine, buildConditions } from "../filter-sql";
import { parseFilters } from "../filters";
import { getLightsByIds } from "../queries";
import { dispatchToUser } from "./dispatch";
import { buildEventPayload } from "./payload";

export type MatchSummary = { events: number; matches: number; notifications: number };

/**
 * Evaluate unprocessed product_events against every active alert rule, using
 * the same SQL filter compiler as the catalog. Idempotent: matches are unique
 * per (rule, event), and events are marked processed only after dispatch.
 * Several rules matching one event for one user produce ONE notification per
 * channel.
 */
export async function processPendingEvents(limit = 300): Promise<MatchSummary> {
  const db = await getDb();
  const events = await db.select().from(s.productEvents).where(isNull(s.productEvents.processedAt)).orderBy(asc(s.productEvents.createdAt)).limit(limit);
  if (!events.length) return { events: 0, matches: 0, notifications: 0 };

  const rules = await db.select().from(s.alertRules).where(eq(s.alertRules.isActive, true));
  type Pending = { ruleIds: string[]; matchIds: string[]; channels: Set<AlertChannel>; event: (typeof events)[number]; userId: string };
  const pending = new Map<string, Pending>(); // key: userId:eventId
  let matches = 0;

  for (const rule of rules) {
    const relevant = events.filter((e) => rule.triggerEvents.includes(e.type));
    if (!relevant.length) continue;
    const filters = parseFilters(rule.filterCriteriaJson);
    const ids = [...new Set(relevant.map((e) => e.flashlightId))];
    const matched = await db
      .select({ id: s.flashlights.id })
      .from(s.flashlights)
      .where(combine([...buildConditions(filters, { userId: rule.userId, excludeIgnored: true }), inArray(s.flashlights.id, ids)]));
    const matchedSet = new Set(matched.map((m) => m.id));

    for (const ev of relevant) {
      if (!matchedSet.has(ev.flashlightId)) continue;
      const [row] = await db
        .insert(s.alertMatches)
        .values({
          ruleId: rule.id,
          eventId: ev.id,
          flashlightId: ev.flashlightId,
          userId: rule.userId,
          eventType: ev.type,
          digestPending: rule.channels.includes("email_digest"),
        })
        .onConflictDoNothing()
        .returning({ id: s.alertMatches.id });
      if (!row) continue; // already matched in an earlier run
      matches++;
      const key = `${rule.userId}:${ev.id}`;
      const p = pending.get(key) ?? { ruleIds: [], matchIds: [], channels: new Set<AlertChannel>(), event: ev, userId: rule.userId };
      p.ruleIds.push(rule.id);
      p.matchIds.push(row.id);
      rule.channels.forEach((c) => p.channels.add(c));
      pending.set(key, p);
    }
  }

  let notifications = 0;
  if (pending.size) {
    const lightIds = [...new Set([...pending.values()].map((p) => p.event.flashlightId))];
    const lights = new Map((await getLightsByIds(lightIds, null)).map((l) => [l.id, l]));
    const listingIds = [...new Set([...pending.values()].map((p) => p.event.listingId).filter((x): x is string => !!x))];
    const listingRows = listingIds.length
      ? await db
          .select({ id: s.vendorListings.id, url: s.vendorListings.productUrl, vendor: s.sources.name })
          .from(s.vendorListings)
          .innerJoin(s.sources, eq(s.sources.id, s.vendorListings.sourceId))
          .where(inArray(s.vendorListings.id, listingIds))
      : [];
    const listings = new Map(listingRows.map((l) => [l.id, l]));

    for (const p of pending.values()) {
      const light = lights.get(p.event.flashlightId);
      if (!light) continue;
      const listing = p.event.listingId ? listings.get(p.event.listingId) : undefined;
      const payload = buildEventPayload(p.event.type, light, {
        oldPrice: p.event.oldPrice,
        newPrice: p.event.newPrice,
        listingUrl: listing?.url,
        vendor: listing?.vendor,
      });
      const results = await dispatchToUser(p.userId, [...p.channels], payload);
      notifications += results.filter((r) => r.ok && r.channel !== "email_digest").length;
      await db.update(s.alertMatches).set({ deliveryResults: results }).where(inArray(s.alertMatches.id, p.matchIds));
      await db.update(s.alertRules).set({ lastTriggeredAt: new Date() }).where(inArray(s.alertRules.id, p.ruleIds));
    }
  }

  await db
    .update(s.productEvents)
    .set({ processedAt: new Date() })
    .where(
      and(
        inArray(
          s.productEvents.id,
          events.map((e) => e.id),
        ),
        sql`${s.productEvents.processedAt} IS NULL`,
      ),
    );
  return { events: events.length, matches, notifications };
}
