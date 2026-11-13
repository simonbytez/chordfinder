import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@lp/db";
import * as s from "@lp/db/schema";
import { describeFilterChips, parseFilters, type Filters, type ViewState } from "./filters";
import { buildConditions, combine, freshCondition, grailOrder, orderBy } from "./filter-sql";
import type {
  AlertRuleDTO,
  BestPrice,
  BrandFacet,
  LightDTO,
  ListingDTO,
  MatchHistoryDTO,
  MentionDTO,
  NotificationSettingsDTO,
} from "./types";

type FlashlightRow = typeof s.flashlights.$inferSelect;

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Hydrate flashlight rows with emitters, listings, collection + watch state and latest event. */
export async function hydrateLights(rows: FlashlightRow[], userId: string | null): Promise<LightDTO[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);

  const [emitters, listings, collections, watches, events] = await Promise.all([
    db.select().from(s.flashlightEmitters).where(inArray(s.flashlightEmitters.flashlightId, ids)),
    db
      .select({ l: s.vendorListings, sourceName: s.sources.name })
      .from(s.vendorListings)
      .innerJoin(s.sources, eq(s.sources.id, s.vendorListings.sourceId))
      .where(inArray(s.vendorListings.flashlightId, ids)),
    userId
      ? db
          .select({ flashlightId: s.userCollections.flashlightId, status: s.userCollections.status })
          .from(s.userCollections)
          .where(and(eq(s.userCollections.userId, userId), inArray(s.userCollections.flashlightId, ids)))
      : Promise.resolve([]),
    userId
      ? db
          .select({ flashlightId: s.alertRules.watchFlashlightId })
          .from(s.alertRules)
          .where(and(eq(s.alertRules.userId, userId), inArray(s.alertRules.watchFlashlightId, ids)))
      : Promise.resolve([]),
    db
      .selectDistinctOn([s.productEvents.flashlightId], {
        flashlightId: s.productEvents.flashlightId,
        type: s.productEvents.type,
        createdAt: s.productEvents.createdAt,
        oldPrice: s.productEvents.oldPrice,
        newPrice: s.productEvents.newPrice,
      })
      .from(s.productEvents)
      .where(inArray(s.productEvents.flashlightId, ids))
      .orderBy(s.productEvents.flashlightId, desc(s.productEvents.createdAt)),
  ]);

  const collectionMap = new Map(collections.map((c) => [c.flashlightId, c.status]));
  const watchSet = new Set(watches.map((w) => w.flashlightId));
  const eventMap = new Map(events.map((e) => [e.flashlightId, e]));

  return rows.map((r) => {
    const ls: ListingDTO[] = listings
      .filter((x) => x.l.flashlightId === r.id)
      .map(({ l, sourceName }) => ({
        id: l.id,
        sourceId: l.sourceId,
        sourceName,
        productUrl: l.productUrl,
        title: l.title,
        priceUsd: l.priceUsd,
        inStock: l.inStock,
        lastCheckedAt: iso(l.lastCheckedAt),
        priceHistory: l.priceHistoryJson ?? [],
      }))
      .sort((a, b) => Number(!!b.lastCheckedAt) - Number(!!a.lastCheckedAt) || (a.priceUsd ?? 1e9) - (b.priceUsd ?? 1e9));

    const verifiedInStock = ls.filter((x) => x.lastCheckedAt && x.inStock && x.priceUsd !== null);
    const anyPriced = ls.filter((x) => x.priceUsd !== null);
    const pick = (verifiedInStock.length ? verifiedInStock : anyPriced).sort((a, b) => a.priceUsd! - b.priceUsd!)[0];
    const bestPrice: BestPrice | null = pick
      ? { price: pick.priceUsd!, verified: !!pick.lastCheckedAt, inStock: pick.inStock, url: pick.productUrl, sourceName: pick.sourceName }
      : null;

    const ev = eventMap.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      brand: r.brand,
      modelName: r.modelName,
      releaseStatus: r.releaseStatus,
      firstSeenAt: iso(r.firstSeenAt)!,
      lastEventAt: iso(r.lastEventAt),
      releaseYear: r.releaseYear,
      imageUrls: r.imageUrls ?? [],
      description: r.rawDescription,
      formFactor: r.formFactor,
      batteryTypes: r.batteryTypes ?? [],
      maxLumens: r.maxLumens,
      maxCandela: r.maxCandela,
      throwMeters: r.throwMeters,
      opticType: r.opticType,
      driverType: r.driverType,
      firmware: r.firmware,
      ipRating: r.ipRating,
      bodyMaterials: r.bodyMaterials ?? [],
      hasUsbC: r.hasUsbC,
      hasMagneticTail: r.hasMagneticTail,
      hasAuxLeds: r.hasAuxLeds,
      hasHighCriOption: r.hasHighCriOption,
      weightGrams: r.weightGrams,
      lengthMm: r.lengthMm,
      specSource: r.specSource,
      specNotes: r.specNotes,
      emitters: emitters
        .filter((e) => e.flashlightId === r.id)
        .sort((a, b) => (b.cri ?? 0) - (a.cri ?? 0) || (a.cctKelvin ?? 0) - (b.cctKelvin ?? 0))
        .map((e) => ({
          id: e.id,
          emitterModel: e.emitterModel,
          ledCount: e.ledCount,
          cctKelvin: e.cctKelvin,
          cri: e.cri,
          tintDuvNotes: e.tintDuvNotes,
        })),
      listings: ls,
      bestPrice,
      collectionStatus: collectionMap.get(r.id) ?? null,
      watched: watchSet.has(r.id),
      latestEvent: ev ? { type: ev.type, at: iso(ev.createdAt)!, oldPrice: ev.oldPrice, newPrice: ev.newPrice } : null,
    };
  });
}

export type CatalogResult = {
  items: LightDTO[];
  total: number;
  /** Fresh Drops had too few live events, so we're showing the newest catalog entries instead. */
  freshFallback: boolean;
};

export async function getCatalog(filters: Filters, view: ViewState, userId: string | null): Promise<CatalogResult> {
  const db = await getDb();
  const base = buildConditions(filters, { userId, excludeIgnored: view.mode === "fresh" });

  const run = async (conds: typeof base, sortMode: ViewState) => {
    const where = combine(conds);
    const [rows, [{ n }]] = await Promise.all([
      db
        .select()
        .from(s.flashlights)
        .where(where)
        .orderBy(...orderBy(sortMode.sort, sortMode.mode))
        .limit(view.limit),
      db.select({ n: count() }).from(s.flashlights).where(where),
    ]);
    return { rows, total: n };
  };

  if (view.mode === "fresh") {
    const fresh = await run([...base, freshCondition()], view);
    if (fresh.total >= 6) {
      return { items: await hydrateLights(fresh.rows, userId), total: fresh.total, freshFallback: false };
    }
    // Not enough live drops yet (e.g. first boot before any sync): show newest releases.
    const fallback = await run(base, { ...view, sort: view.sort === "newest" ? "year" : view.sort });
    const seen = new Set(fresh.rows.map((r) => r.id));
    const merged = [...fresh.rows, ...fallback.rows.filter((r) => !seen.has(r.id))].slice(0, view.limit);
    return { items: await hydrateLights(merged, userId), total: fallback.total, freshFallback: true };
  }

  const res = await run(base, view);
  return { items: await hydrateLights(res.rows, userId), total: res.total, freshFallback: false };
}

export async function getLightBySlug(slug: string, userId: string | null): Promise<LightDTO | null> {
  const db = await getDb();
  const rows = await db.select().from(s.flashlights).where(eq(s.flashlights.slug, slug)).limit(1);
  const [dto] = await hydrateLights(rows, userId);
  return dto ?? null;
}

export async function getLightsByIds(ids: string[], userId: string | null): Promise<LightDTO[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(s.flashlights).where(inArray(s.flashlights.id, ids));
  return hydrateLights(rows, userId);
}

export async function pickRandomGrail(filters: Filters, userId: string | null): Promise<LightDTO | null> {
  const db = await getDb();
  const conds = buildConditions(filters, { userId, excludeIgnored: true, excludeOwned: true });
  const rows = await db.select().from(s.flashlights).where(combine(conds)).orderBy(grailOrder()).limit(1);
  const [dto] = await hydrateLights(rows, userId);
  return dto ?? null;
}

export async function getBrandFacets(): Promise<BrandFacet[]> {
  const db = await getDb();
  const rows = await db
    .select({ brand: s.flashlights.brand, count: count() })
    .from(s.flashlights)
    .groupBy(s.flashlights.brand)
    .orderBy(desc(count()), s.flashlights.brand);
  return rows;
}

export async function getMentions(limit = 80, flashlightId?: string): Promise<MentionDTO[]> {
  const db = await getDb();
  const rows = await db
    .select({
      m: s.communityMentions,
      slug: s.flashlights.slug,
      brand: s.flashlights.brand,
      modelName: s.flashlights.modelName,
    })
    .from(s.communityMentions)
    .leftJoin(s.flashlights, eq(s.flashlights.id, s.communityMentions.matchedFlashlightId))
    .where(flashlightId ? eq(s.communityMentions.matchedFlashlightId, flashlightId) : undefined)
    .orderBy(desc(s.communityMentions.publishedAt))
    .limit(limit);
  return rows.map(({ m, slug, brand, modelName }) => ({
    id: m.id,
    title: m.sourceTitle,
    url: m.url,
    platform: m.platform,
    flair: m.flair,
    author: m.author,
    excerpt: m.excerpt,
    publishedAt: iso(m.publishedAt)!,
    light: slug && brand && modelName ? { slug, brand, modelName } : null,
  }));
}

export async function getRadarSourceState() {
  const db = await getDb();
  return db
    .select({ id: s.sources.id, name: s.sources.name, lastPolledAt: s.sources.lastPolledAt, status: s.sources.status, errorLog: s.sources.errorLog })
    .from(s.sources)
    .where(eq(s.sources.adapterType, "reddit_rss"));
}

// ---------------------------------------------------------------------------
// Alerts hub
// ---------------------------------------------------------------------------

export async function getAlertRules(userId: string): Promise<AlertRuleDTO[]> {
  const db = await getDb();
  const rules = await db
    .select({
      r: s.alertRules,
      matchCount: sql<number>`(SELECT count(*)::int FROM ${s.alertMatches} m WHERE m.rule_id = "alert_rules"."id")`,
    })
    .from(s.alertRules)
    .where(eq(s.alertRules.userId, userId))
    .orderBy(desc(s.alertRules.createdAt));
  return rules.map(({ r, matchCount }) => ({
    id: r.id,
    name: r.name,
    filters: r.filterCriteriaJson,
    chips: r.watchFlashlightId ? ["This light only"] : describeFilterChips(parseFilters(r.filterCriteriaJson)),
    triggerEvents: r.triggerEvents,
    channels: r.channels,
    isActive: r.isActive,
    watchFlashlightId: r.watchFlashlightId,
    lastTriggeredAt: iso(r.lastTriggeredAt),
    createdAt: iso(r.createdAt)!,
    matchCount: Number(matchCount),
  }));
}

export async function getMatchHistory(userId: string, limit = 50): Promise<MatchHistoryDTO[]> {
  const db = await getDb();
  const rows = await db
    .select({
      m: s.alertMatches,
      ruleName: s.alertRules.name,
      slug: s.flashlights.slug,
      brand: s.flashlights.brand,
      modelName: s.flashlights.modelName,
    })
    .from(s.alertMatches)
    .innerJoin(s.alertRules, eq(s.alertRules.id, s.alertMatches.ruleId))
    .innerJoin(s.flashlights, eq(s.flashlights.id, s.alertMatches.flashlightId))
    .where(eq(s.alertMatches.userId, userId))
    .orderBy(desc(s.alertMatches.createdAt))
    .limit(limit);
  return rows.map(({ m, ruleName, slug, brand, modelName }) => ({
    id: m.id,
    ruleName,
    eventType: m.eventType,
    createdAt: iso(m.createdAt)!,
    light: { slug, brand, modelName },
    deliveries: m.deliveryResults ?? [],
    digestPending: m.digestPending && !m.digestSentAt,
  }));
}

export async function getNotificationSettings(userId: string): Promise<NotificationSettingsDTO> {
  const db = await getDb();
  const [row] = await db.select().from(s.notificationSettings).where(eq(s.notificationSettings.userId, userId)).limit(1);
  const [{ n }] = await db.select({ n: count() }).from(s.pushSubscriptions).where(eq(s.pushSubscriptions.userId, userId));
  return {
    ntfyTopicUrl: row?.ntfyTopicUrl ?? null,
    discordWebhookUrl: row?.discordWebhookUrl ?? null,
    emailAddress: row?.emailAddress ?? null,
    digestSchedule: row?.digestSchedule ?? "daily",
    pushSubscriptionCount: n,
    vapidConfigured: !!(process.env.LUMENPULSE_VAPID_PUBLIC_KEY && process.env.LUMENPULSE_VAPID_PRIVATE_KEY),
    resendConfigured: !!process.env.RESEND_API_KEY,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getSourcesWithStats() {
  const db = await getDb();
  const rows = await db
    .select({
      src: s.sources,
      listingCount: sql<number>`(SELECT count(*)::int FROM ${s.vendorListings} vl WHERE vl.source_id = "sources"."id")`,
      verifiedCount: sql<number>`(SELECT count(*)::int FROM ${s.vendorListings} vl WHERE vl.source_id = "sources"."id" AND vl.last_checked_at IS NOT NULL)`,
      mentionCount: sql<number>`CASE
        WHEN "sources"."base_url" ILIKE '%reddit.com%' THEN (SELECT count(*)::int FROM ${s.communityMentions} cm WHERE cm.platform = 'reddit_r_flashlight')
        WHEN "sources"."base_url" ILIKE '%budgetlightforum%' THEN (SELECT count(*)::int FROM ${s.communityMentions} cm WHERE cm.platform = 'blf')
        ELSE 0 END`,
    })
    .from(s.sources)
    .orderBy(s.sources.adapterType, s.sources.name);
  return rows.map(({ src, listingCount, verifiedCount, mentionCount }) => ({
    ...src,
    lastPolledAt: iso(src.lastPolledAt),
    createdAt: iso(src.createdAt)!,
    listingCount: Number(listingCount),
    verifiedCount: Number(verifiedCount),
    mentionCount: Number(mentionCount),
  }));
}

export async function getRecentEvents(limit = 25) {
  const db = await getDb();
  const rows = await db
    .select({
      e: s.productEvents,
      slug: s.flashlights.slug,
      brand: s.flashlights.brand,
      modelName: s.flashlights.modelName,
      sourceName: s.sources.name,
    })
    .from(s.productEvents)
    .innerJoin(s.flashlights, eq(s.flashlights.id, s.productEvents.flashlightId))
    .leftJoin(s.sources, eq(s.sources.id, s.productEvents.sourceId))
    .orderBy(desc(s.productEvents.createdAt))
    .limit(limit);
  return rows.map(({ e, slug, brand, modelName, sourceName }) => ({
    id: e.id,
    type: e.type,
    createdAt: iso(e.createdAt)!,
    oldPrice: e.oldPrice,
    newPrice: e.newPrice,
    slug,
    brand,
    modelName,
    sourceName,
  }));
}

export async function getAdminLightIndex() {
  const db = await getDb();
  return db
    .select({ id: s.flashlights.id, slug: s.flashlights.slug, brand: s.flashlights.brand, modelName: s.flashlights.modelName, specSource: s.flashlights.specSource })
    .from(s.flashlights)
    .orderBy(s.flashlights.brand, s.flashlights.modelName);
}

export async function getCatalogStats() {
  const db = await getDb();
  const [[lights], [verified], [events]] = await Promise.all([
    db.select({ n: count() }).from(s.flashlights),
    db.select({ n: count() }).from(s.vendorListings).where(isNotNull(s.vendorListings.lastCheckedAt)),
    db.select({ n: count() }).from(s.productEvents),
  ]);
  return { lights: lights.n, verifiedListings: verified.n, events: events.n };
}
