"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@lp/db";
import * as s from "@lp/db/schema";
import { assertAdmin } from "@lp/lib/admin-auth";
import { sendDueDigests, type DigestRunResult } from "@lp/lib/alerts/digest";
import { processPendingEvents, type MatchSummary } from "@lp/lib/alerts/matcher";
import {
  ADAPTER_TYPES,
  BATTERY_TYPES,
  BODY_MATERIALS,
  DRIVER_TYPES,
  FIRMWARES,
  FORM_FACTORS,
  IP_RATINGS,
  OPTIC_TYPES,
  RELEASE_STATUSES,
  SOURCE_STATUSES,
} from "@lp/lib/constants";
import { runCommunityIngestion, runStoreIngestion, type IngestionReport } from "@lp/lib/ingestion/run";
import { getLightBySlug } from "@lp/lib/queries";
import { slugify, throwFromCandela } from "@lp/lib/specs";
import type { LightDTO } from "@lp/lib/types";

export async function runSourceNow(sourceId: string): Promise<IngestionReport> {
  await assertAdmin();
  const db = await getDb();
  const [src] = await db.select().from(s.sources).where(eq(s.sources.id, z.string().min(1).parse(sourceId))).limit(1);
  if (!src) throw new Error("Unknown source");
  const report =
    src.adapterType === "reddit_rss"
      ? await runCommunityIngestion({ sourceId, force: true })
      : await runStoreIngestion({ sourceId, force: true });
  refresh();
  return report;
}

export async function runDueNow(kind: "store" | "community"): Promise<IngestionReport> {
  await assertAdmin();
  const report = kind === "store" ? await runStoreIngestion({ maxSources: 4 }) : await runCommunityIngestion({});
  refresh();
  return report;
}

export async function runDigestsNow(): Promise<{ alerts: MatchSummary; digests: DigestRunResult[] }> {
  await assertAdmin();
  const alerts = await processPendingEvents();
  const digests = await sendDueDigests({ force: true });
  return { alerts, digests };
}

const SourcePatch = z.object({
  status: z.enum(SOURCE_STATUSES).optional(),
  pollIntervalMins: z.number().int().min(5).max(10080).optional(),
});

export async function updateSource(id: string, patch: z.input<typeof SourcePatch>) {
  await assertAdmin();
  const data = SourcePatch.parse(patch);
  const db = await getDb();
  await db
    .update(s.sources)
    .set({ ...data, ...(data.status === "active" ? { errorLog: null } : {}) })
    .where(eq(s.sources.id, id));
  refresh();
}

const NewSource = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z.string().trim().url(),
  adapterType: z.enum(ADAPTER_TYPES),
  pollIntervalMins: z.number().int().min(5).max(10080),
});

export async function addSource(input: z.input<typeof NewSource>): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const parsed = NewSource.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid source" };
  const db = await getDb();
  const id = slugify(parsed.data.name) || `source-${Date.now()}`;
  const inserted = await db
    .insert(s.sources)
    .values({ id, ...parsed.data, baseUrl: parsed.data.baseUrl.replace(/\/+$/, "") })
    .onConflictDoNothing()
    .returning({ id: s.sources.id });
  if (!inserted.length) return { ok: false, error: `A source with id "${id}" already exists` };
  refresh();
  return { ok: true };
}

export async function deleteSource(id: string) {
  await assertAdmin();
  const db = await getDb();
  await db.delete(s.sources).where(eq(s.sources.id, id));
  refresh();
}

// ---------------------------------------------------------------------------
// Manual flashlight override
// ---------------------------------------------------------------------------

const optInt = z.number().int().nonnegative().nullable();
const EmitterInput = z.object({
  emitterModel: z.string().trim().min(1).max(80),
  ledCount: z.number().int().min(1).max(64),
  cctKelvin: z.number().int().min(1500).max(10000).nullable(),
  cri: z.number().int().min(50).max(100).nullable(),
  tintDuvNotes: z.string().trim().max(200).nullable(),
});

const LightInput = z.object({
  id: z.string().uuid().nullable(),
  brand: z.string().trim().min(1).max(60),
  modelName: z.string().trim().min(1).max(80),
  releaseStatus: z.enum(RELEASE_STATUSES),
  releaseYear: z.number().int().min(1990).max(2100).nullable(),
  formFactor: z.enum(FORM_FACTORS).nullable(),
  batteryTypes: z.array(z.enum(BATTERY_TYPES)),
  maxLumens: optInt,
  maxCandela: optInt,
  throwMeters: optInt,
  opticType: z.enum(OPTIC_TYPES).nullable(),
  driverType: z.enum(DRIVER_TYPES),
  firmware: z.enum(FIRMWARES).nullable(),
  ipRating: z.enum(IP_RATINGS).nullable(),
  bodyMaterials: z.array(z.enum(BODY_MATERIALS)),
  hasUsbC: z.boolean(),
  hasMagneticTail: z.boolean(),
  hasAuxLeds: z.boolean(),
  hasHighCriOption: z.boolean(),
  weightGrams: optInt,
  lengthMm: z.number().nonnegative().nullable(),
  imageUrls: z.array(z.string().url()).max(8),
  description: z.string().max(4000).nullable(),
  specNotes: z.string().max(1000).nullable(),
  emitters: z.array(EmitterInput).max(12),
});

export type LightInputType = z.input<typeof LightInput>;

export async function upsertFlashlight(input: LightInputType): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await assertAdmin();
  const parsed = LightInput.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i ? `${i.path.join(".")}: ${i.message}` : "Invalid input" };
  }
  const d = parsed.data;
  const db = await getDb();
  const values = {
    brand: d.brand,
    modelName: d.modelName,
    releaseStatus: d.releaseStatus,
    releaseYear: d.releaseYear,
    formFactor: d.formFactor,
    batteryTypes: d.batteryTypes,
    maxLumens: d.maxLumens,
    maxCandela: d.maxCandela,
    throwMeters: d.throwMeters ?? throwFromCandela(d.maxCandela),
    opticType: d.opticType,
    driverType: d.driverType,
    firmware: d.firmware,
    ipRating: d.ipRating,
    bodyMaterials: d.bodyMaterials,
    hasUsbC: d.hasUsbC,
    hasMagneticTail: d.hasMagneticTail,
    hasAuxLeds: d.hasAuxLeds,
    hasHighCriOption: d.hasHighCriOption || d.emitters.some((e) => (e.cri ?? 0) >= 90),
    weightGrams: d.weightGrams,
    lengthMm: d.lengthMm,
    imageUrls: d.imageUrls,
    rawDescription: d.description,
    specNotes: d.specNotes,
    specSource: "manual",
  };

  try {
    const slug = await db.transaction(async (tx) => {
      let id = d.id;
      let slug: string;
      if (id) {
        const [row] = await tx.update(s.flashlights).set(values).where(eq(s.flashlights.id, id)).returning({ slug: s.flashlights.slug });
        if (!row) throw new Error("Flashlight not found");
        slug = row.slug;
        await tx.delete(s.flashlightEmitters).where(eq(s.flashlightEmitters.flashlightId, id));
      } else {
        slug = slugify(`${d.brand} ${d.modelName}`);
        const [row] = await tx.insert(s.flashlights).values({ ...values, slug }).returning({ id: s.flashlights.id });
        id = row.id;
      }
      if (d.emitters.length) {
        await tx.insert(s.flashlightEmitters).values(d.emitters.map((e) => ({ ...e, flashlightId: id! })));
      }
      return slug;
    });
    refresh();
    return { ok: true, slug };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /unique/i.test(msg) ? "A light with that brand + model already exists" : msg };
  }
}

export async function deleteFlashlight(id: string) {
  await assertAdmin();
  const db = await getDb();
  await db.delete(s.flashlights).where(eq(s.flashlights.id, z.string().uuid().parse(id)));
  refresh();
}

export async function loadFlashlightForEdit(slug: string): Promise<LightDTO | null> {
  await assertAdmin();
  return getLightBySlug(slug, null);
}
