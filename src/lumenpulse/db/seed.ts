import { count, sql } from "drizzle-orm";
import { throwFromCandela } from "../lib/specs";
import type { Database } from "./index";
import * as s from "./schema";
import { SEED_LIGHTS, SEED_SOURCES } from "./seed-data";

/**
 * Idempotent seeder. Sources are upserted every time (so new starter sources
 * appear after upgrades); lights are only inserted into an empty catalog unless
 * `reset` is passed. Guarded by an advisory lock so concurrent serverless cold
 * starts can't double-seed.
 */
export async function seedDatabase(db: Database, opts: { reset?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7212026)`);

    if (opts.reset) {
      log("Resetting catalog tables…");
      await tx.delete(s.alertMatches);
      await tx.delete(s.productEvents);
      await tx.delete(s.communityMentions);
      await tx.delete(s.vendorListings);
      await tx.delete(s.flashlightEmitters);
      await tx.delete(s.userCollections);
      await tx.delete(s.alertRules);
      await tx.delete(s.flashlights);
      await tx.delete(s.crawlSeenUrls);
      await tx.delete(s.sources);
    }

    for (const src of SEED_SOURCES) {
      await tx
        .insert(s.sources)
        .values({
          id: src.id,
          name: src.name,
          baseUrl: src.baseUrl,
          adapterType: src.adapterType,
          pollIntervalMins: src.pollIntervalMins,
          status: src.status,
          errorLog: src.errorLog ?? null,
        })
        .onConflictDoNothing();
    }

    const [{ n }] = await tx.select({ n: count() }).from(s.flashlights);
    if (n > 0) {
      log(`Catalog already has ${n} lights; skipping light seed.`);
      return;
    }

    for (const l of SEED_LIGHTS) {
      const [row] = await tx
        .insert(s.flashlights)
        .values({
          slug: l.slug,
          brand: l.brand,
          modelName: l.modelName,
          releaseStatus: l.releaseStatus,
          releaseYear: l.releaseYear,
          formFactor: l.formFactor,
          batteryTypes: l.batteryTypes,
          maxLumens: l.maxLumens,
          maxCandela: l.maxCandela,
          throwMeters: l.throwMeters ?? throwFromCandela(l.maxCandela),
          opticType: l.opticType,
          driverType: l.driverType,
          firmware: l.firmware,
          ipRating: l.ipRating,
          bodyMaterials: l.bodyMaterials,
          hasUsbC: l.hasUsbC,
          hasMagneticTail: l.hasMagneticTail,
          hasAuxLeds: l.hasAuxLeds,
          hasHighCriOption: l.hasHighCriOption,
          weightGrams: l.weightGrams,
          lengthMm: l.lengthMm,
          rawDescription: l.description,
          specNotes: l.specNotes ?? null,
          specSource: "seed",
        })
        .returning({ id: s.flashlights.id });

      if (l.emitters.length) {
        await tx.insert(s.flashlightEmitters).values(
          l.emitters.map((e) => ({
            flashlightId: row.id,
            emitterModel: e.emitterModel,
            ledCount: e.ledCount,
            cctKelvin: e.cctKelvin,
            cri: e.cri,
            tintDuvNotes: e.tintDuvNotes ?? null,
          })),
        );
      }

      await tx.insert(s.vendorListings).values({
        flashlightId: row.id,
        sourceId: l.listing.sourceId,
        externalProductId: `seed:${l.slug}`,
        productUrl: l.listing.url,
        title: `${l.brand} ${l.modelName}`,
        priceUsd: l.listing.priceUsd ?? null,
        inStock: false,
        lastCheckedAt: null,
        priceHistoryJson: [],
      });
    }
    log(`Seeded ${SEED_LIGHTS.length} flashlights and ${SEED_SOURCES.length} sources.`);
  });
}
