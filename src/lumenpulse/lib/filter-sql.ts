import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { flashlightEmitters, flashlights, userCollections, vendorListings } from "@lp/db/schema";
import { EMITTER_FAMILIES, MAINSTREAM_BRANDS, REGULATED_DRIVERS, type Mode, type Sort } from "./constants";
import type { Filters } from "./filters";

/**
 * Fully qualified outer-row id for correlated subqueries. Drizzle renders bare
 * `"id"` in SELECT/ORDER BY lists of single-table queries, which Postgres would
 * resolve to the subquery's own `id` column.
 */
const FL_ID = sql.raw(`"flashlights"."id"`);

/** `ARRAY['a','b']::enum_type[]`: values are pre-validated against the enum by the filter parser. */
function enumArray(values: readonly string[], pgType: string): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::${sql.raw(pgType)}[]`;
}

export type ConditionOpts = {
  userId?: string | null;
  /** Hide lights the user marked "ignored" (feeds + random grail). */
  excludeIgnored?: boolean;
  /** Also hide owned (random grail). */
  excludeOwned?: boolean;
};

/**
 * Compile filter state into SQL predicates over `flashlights`. Shared by the
 * catalog, RSS feeds, random grail and the alert matcher, so "what matches a
 * rule" is always exactly "what the catalog shows for that URL".
 */
export function buildConditions(f: Filters, opts: ConditionOpts = {}): SQL[] {
  const c: SQL[] = [];
  const fl = flashlights;

  if (f.watchId) c.push(eq(fl.id, f.watchId));

  if (f.q) {
    for (const term of f.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      c.push(sql`(
        ${fl.brand} ILIKE ${like} OR ${fl.modelName} ILIKE ${like} OR ${fl.slug} ILIKE ${like}
        OR EXISTS (SELECT 1 FROM ${flashlightEmitters} e WHERE e.flashlight_id = ${FL_ID} AND e.emitter_model ILIKE ${like})
      )`);
    }
  }

  if (opts.userId && (f.hideOwned || opts.excludeOwned || opts.excludeIgnored)) {
    const statuses: string[] = [];
    if (f.hideOwned || opts.excludeOwned) statuses.push("owned");
    if (opts.excludeIgnored) statuses.push("ignored");
    c.push(sql`NOT EXISTS (
      SELECT 1 FROM ${userCollections} uc
      WHERE uc.flashlight_id = ${FL_ID} AND uc.user_id = ${opts.userId}
        AND uc.status = ANY(${enumArray(statuses, "collection_status")})
    )`);
  }

  if (f.brands.length) {
    c.push(
      sql`lower(${fl.brand}) IN (${sql.join(
        f.brands.map((b) => sql`${b.toLowerCase()}`),
        sql`, `,
      )})`,
    );
  }
  if (f.formFactors.length) c.push(inArray(fl.formFactor, f.formFactors));
  if (f.batteries.length) c.push(sql`${fl.batteryTypes} && ${enumArray(f.batteries, "battery_type")}`);
  if (f.materials.length) c.push(sql`${fl.bodyMaterials} && ${enumArray(f.materials, "body_material")}`);
  if (f.firmware.length) c.push(inArray(fl.firmware, f.firmware));
  if (f.statuses.length) c.push(inArray(fl.releaseStatus, f.statuses));
  if (f.regulated) c.push(inArray(fl.driverType, REGULATED_DRIVERS));
  if (f.usbc) c.push(eq(fl.hasUsbC, true));
  if (f.magnetic) c.push(eq(fl.hasMagneticTail, true));
  if (f.aux) c.push(eq(fl.hasAuxLeds, true));
  if (f.lumensMin !== undefined) c.push(gte(fl.maxLumens, f.lumensMin));
  if (f.lumensMax !== undefined) c.push(lte(fl.maxLumens, f.lumensMax));
  if (f.throwMin) {
    c.push(sql`COALESCE(${fl.throwMeters}, ROUND(2 * SQRT(${fl.maxCandela}::float8))) >= ${f.throwMin}`);
  }

  // Emitter predicates combine inside ONE exists so "519A + 90 CRI + 4000–5000K"
  // must be satisfied by the same emitter variant.
  const em: SQL[] = [];
  if (f.emitterFamilies.length) {
    const patterns = f.emitterFamilies.flatMap((k) => EMITTER_FAMILIES.find((x) => x.key === k)?.patterns ?? []);
    if (patterns.length)
      em.push(
        sql`(${sql.join(
          patterns.map((p) => sql`e.emitter_model ILIKE ${p}`),
          sql` OR `,
        )})`,
      );
  }
  if (f.cctMin !== undefined) em.push(sql`e.cct_kelvin >= ${f.cctMin}`);
  if (f.cctMax !== undefined) em.push(sql`e.cct_kelvin <= ${f.cctMax}`);
  if (f.highCri && !em.length) {
    // High CRI alone: any 90+ emitter, or the maker flags a high-CRI option.
    c.push(sql`(${fl.hasHighCriOption} OR EXISTS (SELECT 1 FROM ${flashlightEmitters} e WHERE e.flashlight_id = ${FL_ID} AND e.cri >= 90))`);
  } else {
    if (f.highCri) em.push(sql`e.cri >= 90`);
    if (em.length) {
      c.push(sql`EXISTS (SELECT 1 FROM ${flashlightEmitters} e WHERE e.flashlight_id = ${FL_ID} AND ${sql.join(em, sql` AND `)})`);
    }
  }

  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    const p: SQL[] = [sql`vl.price_usd IS NOT NULL`];
    if (f.priceMin !== undefined) p.push(sql`vl.price_usd >= ${f.priceMin}`);
    if (f.priceMax !== undefined) p.push(sql`vl.price_usd <= ${f.priceMax}`);
    c.push(sql`EXISTS (SELECT 1 FROM ${vendorListings} vl WHERE vl.flashlight_id = ${FL_ID} AND ${sql.join(p, sql` AND `)})`);
  }

  return c;
}

/** Fresh Drops: anything with a recent ingestion event or an attention-worthy status. */
export function freshCondition(): SQL {
  return sql`(
    ${flashlights.releaseStatus} IN ('new_release', 'pre_order', 'restock')
    OR ${flashlights.lastEventAt} > now() - interval '45 days'
  )`;
}

export function minPriceExpr(): SQL<number | null> {
  return sql<number | null>`(SELECT MIN(vl.price_usd) FROM ${vendorListings} vl WHERE vl.flashlight_id = ${FL_ID})`;
}

export function orderBy(sort: Sort, mode: Mode): SQL[] {
  const fl = flashlights;
  const activity = sql`COALESCE(${fl.lastEventAt}, ${fl.firstSeenAt})`;
  switch (sort) {
    case "name":
      return [sql`lower(${fl.brand}) ASC`, sql`lower(${fl.modelName}) ASC`];
    case "lumens":
      return [sql`${fl.maxLumens} DESC NULLS LAST`, sql`lower(${fl.brand}) ASC`];
    case "throw":
      return [sql`COALESCE(${fl.throwMeters}, ROUND(2 * SQRT(${fl.maxCandela}::float8))) DESC NULLS LAST`];
    case "price_asc":
      return [sql`${minPriceExpr()} ASC NULLS LAST`];
    case "price_desc":
      return [sql`${minPriceExpr()} DESC NULLS LAST`];
    case "year":
      return [sql`${fl.releaseYear} DESC NULLS LAST`, sql`lower(${fl.brand}) ASC`];
    case "newest":
    default:
      return mode === "fresh"
        ? [sql`${activity} DESC`, sql`${fl.releaseYear} DESC NULLS LAST`]
        : [sql`${activity} DESC`, sql`${fl.releaseYear} DESC NULLS LAST`, sql`lower(${fl.brand}) ASC`];
  }
}

/** Random Grail weighting: down-weight mainstream brands, up-weight discontinued classics. */
export function grailOrder(): SQL {
  return sql`random()
    * CASE WHEN lower(${flashlights.brand}) IN (${sql.join(
      MAINSTREAM_BRANDS.map((b) => sql`${b}`),
      sql`, `,
    )}) THEN 0.35 ELSE 1 END
    * CASE WHEN ${flashlights.releaseStatus} = 'discontinued' THEN 1.3 ELSE 1 END DESC`;
}

export function combine(conds: SQL[]): SQL | undefined {
  return conds.length ? and(...conds) : undefined;
}
