import { and, asc, eq, isNotNull, like, not, sql } from "drizzle-orm";
import { getDb, type Database } from "@lp/db";
import * as s from "@lp/db/schema";
import type { PricePoint, RunStats, Source, VendorListing } from "@lp/db/schema";
import type { TriggerEvent } from "../constants";
import { slugify } from "../specs";
import { RedditRssAdapter } from "./adapters/reddit";
import { ShopifyAdapter } from "./adapters/shopify";
import { SitemapAdapter } from "./adapters/sitemap";
import { brandFromTitle, classifyProduct, deriveModelName, matchLight, normalizeBrand, type LightRef } from "./classify";
import { extractSpecs } from "./extract";
import { HttpError, jitter } from "./http";
import type { RawProduct } from "./types";

const LLM_BUDGET = () => Number(process.env.LUMENPULSE_LLM_MAX_EXTRACTIONS_PER_RUN ?? 20);
const SITEMAP_MAX_NEW = () => Number(process.env.LUMENPULSE_SITEMAP_MAX_PAGES_PER_RUN ?? 15);
const SITEMAP_RECHECK = () => Number(process.env.LUMENPULSE_SITEMAP_RECHECK_PER_RUN ?? 6);
const PRICE_DROP_THRESHOLD = 0.9; // ≥10% drop
const HISTORY_CAP = 90;

export type SyncOutcome = {
  sourceId: string;
  name: string;
  ok: boolean;
  skipped?: string;
  stats?: RunStats;
  error?: string;
};

const emptyStats = (bootstrap: boolean): RunStats => ({
  fetched: 0,
  candidates: 0,
  skippedAccessories: 0,
  newLights: 0,
  newListings: 0,
  updatedListings: 0,
  events: 0,
  llmExtractions: 0,
  durationMs: 0,
  bootstrap,
});

function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return `${x.host.replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/**
 * A source is due once its poll interval has passed. A store that is still
 * working through a sitemap backlog is due again 5 minutes after its last chunk,
 * so a backfill runs one chunk per cron call instead of one per poll interval.
 * A store in error falls back to its normal interval.
 */
export const sourceIsDue = sql`(
  ${s.sources.lastPolledAt} IS NULL
  OR ${s.sources.lastPolledAt} <= now() - make_interval(mins => ${s.sources.pollIntervalMins})
  OR (${s.sources.status} = 'active'
      AND COALESCE((${s.sources.lastRunStats} ->> 'backlog')::int, 0) > 0
      AND ${s.sources.lastPolledAt} <= now() - interval '5 minutes')
)`;

/**
 * Atomically claim a source for this run by bumping last_polled_at, but only if
 * it is due (or forced). Overlapping cron invocations therefore never process
 * the same source twice → cron endpoints are idempotent.
 */
async function claimSource(db: Database, id: string, force: boolean): Promise<Source | null> {
  const rows = await db
    .update(s.sources)
    .set({ lastPolledAt: new Date() })
    .where(and(eq(s.sources.id, id), force ? undefined : and(sourceIsDue, not(eq(s.sources.status, "paused")))))
    .returning();
  return rows[0] ?? null;
}

/** Milliseconds left before `deadline` (a Date.now() timestamp); Infinity when there is none. */
const timeLeft = (deadline?: number) => (deadline === undefined ? Infinity : deadline - Date.now());
/** An LLM call is only started with this much budget left, and is cut off before the deadline. */
const LLM_MIN_LEFT_MS = 12_000;

/**
 * `deadline` bounds the slow parts (sitemap page fetches, LLM calls). Product
 * writes are never cut short: a half-processed product list could lose items
 * or replay a store's backfill as new-release alerts.
 */
export async function syncSource(sourceId: string, opts: { force?: boolean; deadline?: number } = {}): Promise<SyncOutcome> {
  const db = await getDb();
  const [current] = await db.select().from(s.sources).where(eq(s.sources.id, sourceId)).limit(1);
  if (!current) return { sourceId, name: sourceId, ok: false, error: "Unknown source" };

  const src = await claimSource(db, sourceId, !!opts.force);
  if (!src) return { sourceId, name: current.name, ok: true, skipped: current.status === "paused" ? "paused" : "not due yet" };

  const started = Date.now();
  // Backfill (no alerts) on the first sync, and for every chunk of a sitemap backlog,
  // including the last one: those pages are old catalog, not new releases.
  const stats = emptyStats(current.lastRunStats === null || (current.lastRunStats.backlog ?? 0) > 0);
  try {
    if (src.adapterType === "shopify_json") {
      const products = await new ShopifyAdapter(src).fetchProducts();
      stats.fetched = products.length;
      await processProducts(db, src, products, stats, opts.deadline);
    } else if (src.adapterType === "sitemap_xml") {
      await runSitemap(db, src, stats, opts.deadline);
    } else {
      await runCommunity(db, src, stats);
    }
    stats.durationMs = Date.now() - started;
    await db.update(s.sources).set({ status: "active", errorLog: null, lastRunStats: stats }).where(eq(s.sources.id, src.id));
    return { sourceId, name: src.name, ok: true, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.durationMs = Date.now() - started;
    await db
      .update(s.sources)
      .set({ status: "error", errorLog: `[${new Date().toISOString()}] ${message}`.slice(0, 2000) })
      .where(eq(s.sources.id, src.id));
    return { sourceId, name: src.name, ok: false, error: message, stats };
  }
}

// ---------------------------------------------------------------------------
// Store products → listings / lights / events
// ---------------------------------------------------------------------------

/**
 * A product listed by an earlier crawl that the classifier now rejects (its rules got stricter):
 * drop the listing. Drop the light too when the crawler created it and nothing else refers to it,
 * so seed and hand-entered lights, and anything someone owns, wants or watches, always stay.
 */
async function dropRejectedListing(db: Database, listing: VendorListing) {
  await db.delete(s.vendorListings).where(eq(s.vendorListings.id, listing.id));
  const id = listing.flashlightId;
  const [light] = await db.select({ specSource: s.flashlights.specSource }).from(s.flashlights).where(eq(s.flashlights.id, id)).limit(1);
  if (!light || (light.specSource !== "regex" && light.specSource !== "llm")) return;
  const refs = await Promise.all([
    db.select({ id: s.vendorListings.id }).from(s.vendorListings).where(eq(s.vendorListings.flashlightId, id)).limit(1),
    db.select({ id: s.userCollections.flashlightId }).from(s.userCollections).where(eq(s.userCollections.flashlightId, id)).limit(1),
    db.select({ id: s.alertRules.id }).from(s.alertRules).where(eq(s.alertRules.watchFlashlightId, id)).limit(1),
  ]);
  if (refs.every((r) => r.length === 0)) await db.delete(s.flashlights).where(eq(s.flashlights.id, id));
}

async function loadLightRefs(db: Database): Promise<LightRef[]> {
  return db.select({ id: s.flashlights.id, brand: s.flashlights.brand, modelName: s.flashlights.modelName }).from(s.flashlights);
}

async function uniqueSlug(db: Database, base: string): Promise<string> {
  const root = base || "flashlight";
  const rows = await db.select({ slug: s.flashlights.slug }).from(s.flashlights).where(like(s.flashlights.slug, `${root}%`));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

async function emitEvent(
  db: Database,
  e: { flashlightId: string; listingId: string | null; sourceId: string; type: TriggerEvent; oldPrice?: number | null; newPrice?: number | null },
) {
  await db.insert(s.productEvents).values({
    flashlightId: e.flashlightId,
    listingId: e.listingId,
    sourceId: e.sourceId,
    type: e.type,
    oldPrice: e.oldPrice ?? null,
    newPrice: e.newPrice ?? null,
  });
}

function nextHistory(prev: PricePoint[], p: RawProduct, now: Date): PricePoint[] {
  const last = prev.at(-1);
  if (last && last.p === p.priceUsd && last.s === p.inStock) return prev;
  return [...prev, { t: now.toISOString(), p: p.priceUsd, s: p.inStock }].slice(-HISTORY_CAP);
}

export async function processProducts(db: Database, src: Source, products: RawProduct[], stats: RunStats, deadline?: number) {
  const lights = await loadLightRefs(db);
  const existing = await db.select().from(s.vendorListings).where(eq(s.vendorListings.sourceId, src.id));
  const byExternal = new Map(existing.map((l) => [l.externalProductId, l]));
  const byUrl = new Map(existing.map((l) => [normUrl(l.productUrl), l]));
  const storeBrand = normalizeBrand(src.name, src.name);
  let llmBudget = LLM_BUDGET();

  for (const p of products) {
    const cls = classifyProduct(p);
    if (!cls.keep) {
      stats.skippedAccessories++;
      const listed = byExternal.get(p.externalId) ?? byUrl.get(normUrl(p.url));
      if (listed && !listed.externalProductId.startsWith("seed:")) {
        await dropRejectedListing(db, listed);
        stats.removedListings = (stats.removedListings ?? 0) + 1;
      }
      continue;
    }
    stats.candidates++;
    const now = new Date();

    // 1) Known listing → diff stock/price.
    const known = byExternal.get(p.externalId) ?? byUrl.get(normUrl(p.url));
    if (known && !known.externalProductId.startsWith("seed:")) {
      await updateListing(db, src, known, p, now, stats);
      continue;
    }

    // 2) Known light (or a seed placeholder listing) → attach a verified listing.
    const brand = brandFromTitle(p.title) ?? normalizeBrand(p.vendor, storeBrand);
    const seedListing = known?.externalProductId.startsWith("seed:") ? known : undefined;
    const match = seedListing ? lights.find((l) => l.id === seedListing.flashlightId) ?? null : matchLight(p.title, lights, brand);
    if (match) {
      await attachListing(db, src, match.id, p, now, seedListing ?? existing.find((l) => l.flashlightId === match.id && l.externalProductId.startsWith("seed:")));
      stats.newListings++;
      continue;
    }

    // 3) Brand-new product → spec extraction (LLM if available and time allows, regex fallback).
    const left = timeLeft(deadline);
    const ext = await extractSpecs(
      {
        brand,
        title: p.title,
        productType: p.productType,
        tags: p.tags,
        variantTitles: p.variants.map((v) => v.title).filter((t) => t && t !== "Default Title"),
        descriptionText: p.descriptionText,
      },
      { allowLlm: llmBudget > 0 && left > LLM_MIN_LEFT_MS, timeoutMs: Math.min(30_000, left - 5_000) },
    );
    if (ext.method === "llm") {
      llmBudget--;
      stats.llmExtractions++;
    }
    const spec = ext.specs;
    const looksLikeLight = spec.isFlashlight && (spec.maxLumens !== null || spec.batteryTypes.length > 0 || spec.emitters.length > 0);
    if (!looksLikeLight) {
      stats.skippedAccessories++;
      continue;
    }

    const finalBrand = normalizeBrand(spec.brand, brand);
    const modelName = spec.modelName?.trim() || deriveModelName(p.title, finalBrand);
    // The extracted model may now match a known light that the raw title didn't.
    const late = matchLight(`${finalBrand} ${modelName}`, lights, finalBrand);
    if (late) {
      await attachListing(db, src, late.id, p, now);
      stats.newListings++;
      continue;
    }

    const status = stats.bootstrap ? "active" : p.preOrder ? "pre_order" : "new_release";
    const slug = await uniqueSlug(db, slugify(`${finalBrand} ${modelName}`));
    const [light] = await db
      .insert(s.flashlights)
      .values({
        slug,
        brand: finalBrand,
        modelName,
        releaseStatus: status,
        firstSeenAt: now,
        lastEventAt: stats.bootstrap ? null : now,
        releaseYear: spec.releaseYear ?? (p.publishedAt && !stats.bootstrap ? new Date(p.publishedAt).getFullYear() : null),
        imageUrls: p.images,
        rawDescription: p.descriptionText.slice(0, 4000) || null,
        formFactor: spec.formFactor,
        batteryTypes: spec.batteryTypes,
        maxLumens: spec.maxLumens,
        maxCandela: spec.maxCandela,
        throwMeters: spec.throwMeters,
        opticType: spec.opticType,
        driverType: spec.driverType,
        firmware: spec.firmware,
        ipRating: spec.ipRating,
        bodyMaterials: spec.bodyMaterials,
        hasUsbC: spec.hasUsbC,
        hasMagneticTail: spec.hasMagneticTail,
        hasAuxLeds: spec.hasAuxLeds,
        hasHighCriOption: spec.hasHighCriOption,
        weightGrams: spec.weightGrams,
        lengthMm: spec.lengthMm,
        specSource: ext.method,
        specNotes: ext.error ? `Auto-extracted with the regex parser (LLM error: ${ext.error.slice(0, 160)}).` : ext.method === "regex" ? "Auto-extracted from the store listing by the regex parser; review in /admin." : "Auto-extracted from the store listing by the LLM.",
      })
      .returning({ id: s.flashlights.id });

    if (spec.emitters.length) {
      await db.insert(s.flashlightEmitters).values(
        spec.emitters.map((e) => ({
          flashlightId: light.id,
          emitterModel: e.emitterModel,
          ledCount: e.ledCount ?? 1,
          cctKelvin: e.cctKelvin,
          cri: e.cri,
          tintDuvNotes: e.tintDuvNotes,
        })),
      );
    }
    const listingId = await attachListing(db, src, light.id, p, now);
    lights.push({ id: light.id, brand: finalBrand, modelName });
    stats.newLights++;
    stats.newListings++;
    if (!stats.bootstrap) {
      await emitEvent(db, { flashlightId: light.id, listingId, sourceId: src.id, type: "new_release", newPrice: p.priceUsd });
      stats.events++;
    }
  }
}

async function attachListing(db: Database, src: Source, flashlightId: string, p: RawProduct, now: Date, adopt?: VendorListing): Promise<string> {
  const values = {
    flashlightId,
    sourceId: src.id,
    externalProductId: p.externalId,
    productUrl: p.url,
    title: p.title,
    priceUsd: p.priceUsd,
    inStock: p.inStock,
    lastCheckedAt: now,
    priceHistoryJson: [{ t: now.toISOString(), p: p.priceUsd, s: p.inStock }],
  };
  if (adopt) {
    await db.update(s.vendorListings).set(values).where(eq(s.vendorListings.id, adopt.id));
    return adopt.id;
  }
  const [row] = await db
    .insert(s.vendorListings)
    .values(values)
    .onConflictDoUpdate({
      target: [s.vendorListings.sourceId, s.vendorListings.externalProductId],
      set: { priceUsd: values.priceUsd, inStock: values.inStock, lastCheckedAt: now, title: values.title, productUrl: values.productUrl },
    })
    .returning({ id: s.vendorListings.id });
  // A verified listing makes any unverified seed placeholder for this light redundant.
  await db
    .delete(s.vendorListings)
    .where(and(eq(s.vendorListings.flashlightId, flashlightId), eq(s.vendorListings.sourceId, src.id), like(s.vendorListings.externalProductId, "seed:%")));
  return row.id;
}

async function updateListing(db: Database, src: Source, l: VendorListing, p: RawProduct, now: Date, stats: RunStats) {
  const verifiedBefore = !!l.lastCheckedAt;
  const events: { type: TriggerEvent; oldPrice?: number | null; newPrice?: number | null }[] = [];

  if (verifiedBefore && !l.inStock && p.inStock) events.push({ type: "restock", newPrice: p.priceUsd });
  if (verifiedBefore && l.priceUsd && p.priceUsd && p.inStock && p.priceUsd <= l.priceUsd * PRICE_DROP_THRESHOLD) {
    events.push({ type: "price_drop", oldPrice: l.priceUsd, newPrice: p.priceUsd });
  }

  await db
    .update(s.vendorListings)
    .set({
      priceUsd: p.priceUsd,
      inStock: p.inStock,
      title: p.title,
      productUrl: p.url,
      lastCheckedAt: now,
      priceHistoryJson: nextHistory(l.priceHistoryJson ?? [], p, now),
    })
    .where(eq(s.vendorListings.id, l.id));
  stats.updatedListings++;

  const [light] = await db.select({ status: s.flashlights.releaseStatus }).from(s.flashlights).where(eq(s.flashlights.id, l.flashlightId)).limit(1);
  if (!light) return;

  // Pre-order that is now actually shipping counts as availability ("restock").
  if (light.status === "pre_order" && !p.preOrder && p.inStock && !events.some((e) => e.type === "restock")) {
    events.push({ type: "restock", newPrice: p.priceUsd });
  }
  if (!events.length) return;

  for (const e of events) {
    await emitEvent(db, { flashlightId: l.flashlightId, listingId: l.id, sourceId: src.id, ...e });
    stats.events++;
  }
  const restocked = events.some((e) => e.type === "restock");
  await db
    .update(s.flashlights)
    .set({
      lastEventAt: now,
      ...(restocked ? { releaseStatus: light.status === "pre_order" || light.status === "new_release" ? "new_release" : "restock" } : {}),
    })
    .where(eq(s.flashlights.id, l.flashlightId));
}

// ---------------------------------------------------------------------------
// Sitemap sources
// ---------------------------------------------------------------------------

async function runSitemap(db: Database, src: Source, stats: RunStats, deadline?: number) {
  const adapter = new SitemapAdapter(src);
  const entries = await adapter.collectUrls();
  stats.fetched = entries.length;

  const seenRows = await db.select({ url: s.crawlSeenUrls.url }).from(s.crawlSeenUrls).where(eq(s.crawlSeenUrls.sourceId, src.id));
  const seen = new Set(seenRows.map((r) => r.url));
  const verified = await db
    .select()
    .from(s.vendorListings)
    .where(and(eq(s.vendorListings.sourceId, src.id), not(like(s.vendorListings.externalProductId, "seed:%"))));
  const verifiedUrls = new Set(verified.map((l) => l.productUrl));

  const unseen = entries.filter((e) => !seen.has(e.loc) && !verifiedUrls.has(e.loc));
  const fresh = unseen.slice(0, SITEMAP_MAX_NEW());
  // Still working through the initial backlog → treat discoveries as catalog backfill, not "new releases".
  if (unseen.length > fresh.length) stats.bootstrap = true;

  const recheck = await db
    .select()
    .from(s.vendorListings)
    .where(and(eq(s.vendorListings.sourceId, src.id), isNotNull(s.vendorListings.lastCheckedAt)))
    .orderBy(asc(s.vendorListings.lastCheckedAt))
    .limit(SITEMAP_RECHECK());

  const products: RawProduct[] = [];
  let pageErrors = 0;
  let newlySeen = 0;
  const markSeen = async (url: string, isProduct: boolean) => {
    await db
      .insert(s.crawlSeenUrls)
      .values({ sourceId: src.id, url, isProduct })
      .onConflictDoUpdate({ target: [s.crawlSeenUrls.sourceId, s.crawlSeenUrls.url], set: { isProduct, checkedAt: new Date() } });
    newlySeen++;
  };
  const targets = [...fresh.map((e) => ({ url: e.loc, isNew: true })), ...recheck.map((l) => ({ url: l.productUrl, isNew: false }))];
  for (const [i, t] of targets.entries()) {
    // Out of time: unfetched new URLs stay unseen, so the next chunk fetches them.
    if (timeLeft(deadline) < 5_000) break;
    if (i > 0) await jitter(700, 1100);
    try {
      const p = await adapter.fetchPage(t.url, Math.min(20_000, timeLeft(deadline) - 2_000));
      if (t.isNew) await markSeen(t.url, !!p);
      if (p) products.push(p);
    } catch (err) {
      // A page that is gone will never load; count it as seen so the backlog can finish.
      // Other errors (timeouts, 5xx) leave it unseen for a later retry.
      if (t.isNew && err instanceof HttpError && (err.status === 404 || err.status === 410)) await markSeen(t.url, false);
      pageErrors++;
      if (pageErrors >= 5) throw new Error(`Aborting after ${pageErrors} page errors (last: ${t.url})`);
    }
  }
  // Pages still to fetch. A chunk that made no progress drops the store back to its
  // normal interval, so a few permanently failing URLs can't keep it on the fast schedule.
  stats.backlog = newlySeen > 0 ? unseen.length - newlySeen : 0;
  await processProducts(db, src, products, stats, deadline);
}

// ---------------------------------------------------------------------------
// Community sources
// ---------------------------------------------------------------------------

async function runCommunity(db: Database, src: Source, stats: RunStats) {
  const adapter = new RedditRssAdapter(src);
  const mentions = await adapter.fetchMentions();
  stats.fetched = mentions.length;
  const lights = await loadLightRefs(db);
  for (const m of mentions) {
    const match = matchLight(m.title, lights);
    const rows = await db
      .insert(s.communityMentions)
      .values({
        sourceTitle: m.title,
        url: m.url,
        platform: m.platform,
        flair: m.flair,
        author: m.author,
        excerpt: m.excerpt,
        matchedFlashlightId: match?.id ?? null,
        publishedAt: m.publishedAt,
      })
      .onConflictDoUpdate({
        target: s.communityMentions.url,
        set: {
          flair: sql`COALESCE(${s.communityMentions.flair}, excluded.flair)`,
          matchedFlashlightId: sql`COALESCE(${s.communityMentions.matchedFlashlightId}, excluded.matched_flashlight_id)`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (rows[0]?.inserted) stats.candidates++;
  }
}

/** New releases/restocks fade back to "Available" after 30 quiet days. */
export async function decayStatuses() {
  const db = await getDb();
  await db
    .update(s.flashlights)
    .set({ releaseStatus: "active" })
    .where(
      and(
        sql`${s.flashlights.releaseStatus} IN ('new_release', 'restock')`,
        sql`COALESCE(${s.flashlights.lastEventAt}, ${s.flashlights.firstSeenAt}) < now() - interval '30 days'`,
      ),
    );
}
