import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  type Category,
  type Difficulty,
  type Instrument,
  isCategory,
  isDifficulty,
  isInstrument,
  resolveDriveThumbnailUrl,
  type ScraperSourceInfo,
  type TranscriptionFacets,
  type TranscriptionItem,
  type TranscriptionsResponse,
} from "../lib/constants";
import { getDb } from "./db";
import { drumscrollSources, drumscrollTranscriptions, type SourceRow, type TranscriptionRow } from "./schema";
import { estimateDifficulty, inferCategory, inferInstrument } from "./tagger";

export interface TranscriptionFilterParams {
  q?: string;
  instrument?: string;
  category?: string;
  difficulty?: string;
  bookmarked?: boolean;
  sourceSite?: string;
  limit?: number;
  offset?: number;
  sort?: "newest" | "title";
}

export function serializeTranscription(row: TranscriptionRow): TranscriptionItem {
  return {
    id: row.id,
    title: row.title,
    artistOrCorps: row.artistOrCorps,
    instrument: row.instrument,
    category: row.category,
    difficulty: row.difficulty,
    difficultyOverridden: row.difficultyOverridden,
    pageCount: row.pageCount,
    sourceUrl: row.sourceUrl,
    pdfUrl: row.pdfUrl,
    previewImageUrl: row.previewImageUrl ?? resolveDriveThumbnailUrl(row.pdfUrl),
    bookmarked: row.bookmarked,
    sourceSite: row.sourceSite,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export function serializeSource(row: SourceRow): ScraperSourceInfo {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    instrument: row.instrument,
    defaultCategory: row.defaultCategory,
    description: row.description,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    lastStatus: row.lastStatus,
    itemCount: row.itemCount,
    lastError: row.lastError ?? null,
  };
}

function buildWhereConditions(params: TranscriptionFilterParams): SQL[] {
  const conditions: SQL[] = [];

  const q = params.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const searchCond = or(
      ilike(drumscrollTranscriptions.title, pattern),
      ilike(drumscrollTranscriptions.artistOrCorps, pattern),
    );
    if (searchCond) conditions.push(searchCond);
  }

  if (params.instrument && isInstrument(params.instrument)) {
    conditions.push(eq(drumscrollTranscriptions.instrument, params.instrument));
  }

  if (params.category && isCategory(params.category)) {
    conditions.push(eq(drumscrollTranscriptions.category, params.category));
  }

  if (params.difficulty && isDifficulty(params.difficulty)) {
    conditions.push(eq(drumscrollTranscriptions.difficulty, params.difficulty));
  }

  if (params.bookmarked === true) {
    conditions.push(eq(drumscrollTranscriptions.bookmarked, true));
  }

  if (params.sourceSite?.trim()) {
    conditions.push(eq(drumscrollTranscriptions.sourceSite, params.sourceSite.trim()));
  }

  return conditions;
}

async function computeFacets(q?: string): Promise<TranscriptionFacets> {
  const db = await getDb();
  const baseConds: SQL[] = [];
  const trimmedQ = q?.trim();
  if (trimmedQ) {
    const pattern = `%${trimmedQ}%`;
    const c = or(
      ilike(drumscrollTranscriptions.title, pattern),
      ilike(drumscrollTranscriptions.artistOrCorps, pattern),
    );
    if (c) baseConds.push(c);
  }
  const whereClause = baseConds.length > 0 ? and(...baseConds) : undefined;

  const rows = await db
    .select({
      instrument: drumscrollTranscriptions.instrument,
      category: drumscrollTranscriptions.category,
      difficulty: drumscrollTranscriptions.difficulty,
      bookmarked: drumscrollTranscriptions.bookmarked,
      cnt: count(),
    })
    .from(drumscrollTranscriptions)
    .where(whereClause)
    .groupBy(
      drumscrollTranscriptions.instrument,
      drumscrollTranscriptions.category,
      drumscrollTranscriptions.difficulty,
      drumscrollTranscriptions.bookmarked,
    );

  const instruments: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const difficulties: Record<string, number> = {};
  let bookmarkedCount = 0;
  let totalAll = 0;

  for (const r of rows) {
    const n = Number(r.cnt);
    totalAll += n;
    instruments[r.instrument] = (instruments[r.instrument] ?? 0) + n;
    categories[r.category] = (categories[r.category] ?? 0) + n;
    difficulties[r.difficulty] = (difficulties[r.difficulty] ?? 0) + n;
    if (r.bookmarked) bookmarkedCount += n;
  }

  return {
    instruments,
    categories,
    difficulties,
    bookmarked: bookmarkedCount,
    totalAll,
  };
}

export async function listTranscriptions(params: TranscriptionFilterParams): Promise<TranscriptionsResponse> {
  const db = await getDb();
  const limit = Math.min(Math.max(Number(params.limit) || 40, 1), 100);
  const offset = Math.max(Number(params.offset) || 0, 0);

  const conditions = buildWhereConditions(params);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    params.sort === "title"
      ? [asc(drumscrollTranscriptions.title), desc(drumscrollTranscriptions.id)]
      : [desc(drumscrollTranscriptions.createdAt), desc(drumscrollTranscriptions.id)];

  const [rows, [{ total }], facets] = await Promise.all([
    db
      .select()
      .from(drumscrollTranscriptions)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(drumscrollTranscriptions).where(whereClause),
    computeFacets(params.q),
  ]);

  return {
    items: rows.map(serializeTranscription),
    total: Number(total),
    limit,
    offset,
    facets,
  };
}

export async function getTranscriptionById(id: number): Promise<TranscriptionItem | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(drumscrollTranscriptions)
    .where(eq(drumscrollTranscriptions.id, id))
    .limit(1);
  return row ? serializeTranscription(row) : null;
}

export interface PatchTranscriptionInput {
  bookmarked?: boolean;
  difficulty?: Difficulty;
  resetDifficultyOverride?: boolean;
  previewImageUrl?: string | null;
  pageCount?: number;
  title?: string;
  artistOrCorps?: string;
  instrument?: Instrument;
  category?: Category;
}

export async function patchTranscription(
  id: number,
  input: PatchTranscriptionInput,
): Promise<TranscriptionItem | null> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(drumscrollTranscriptions)
    .where(eq(drumscrollTranscriptions.id, id))
    .limit(1);

  if (!existing) return null;

  const updates: Partial<typeof drumscrollTranscriptions.$inferInsert> = {};

  if (typeof input.bookmarked === "boolean") {
    updates.bookmarked = input.bookmarked;
  }

  if (typeof input.title === "string" && input.title.trim()) {
    updates.title = input.title.trim().slice(0, 300);
  }

  if (typeof input.artistOrCorps === "string" && input.artistOrCorps.trim()) {
    updates.artistOrCorps = input.artistOrCorps.trim().slice(0, 200);
  }

  if (input.instrument && isInstrument(input.instrument)) {
    updates.instrument = input.instrument;
  }

  if (input.category && isCategory(input.category)) {
    updates.category = input.category;
  }

  if (typeof input.pageCount === "number" && Number.isFinite(input.pageCount) && input.pageCount >= 1) {
    updates.pageCount = Math.min(Math.round(input.pageCount), 500);
  }

  if (input.previewImageUrl !== undefined) {
    if (input.previewImageUrl === null) {
      updates.previewImageUrl = null;
    } else if (typeof input.previewImageUrl === "string" && input.previewImageUrl.length <= 1_500_000) {
      updates.previewImageUrl = input.previewImageUrl;
    }
  }

  if (input.resetDifficultyOverride) {
    updates.difficulty = estimateDifficulty({
      title: updates.title ?? existing.title,
      artistOrCorps: updates.artistOrCorps ?? existing.artistOrCorps,
      instrument: updates.instrument ?? existing.instrument,
      category: updates.category ?? existing.category,
      pageCount: updates.pageCount ?? existing.pageCount,
    });
    updates.difficultyOverridden = false;
  } else if (input.difficulty && isDifficulty(input.difficulty)) {
    updates.difficulty = input.difficulty;
    updates.difficultyOverridden = true;
  }

  if (Object.keys(updates).length === 0) {
    return serializeTranscription(existing);
  }

  const [updated] = await db
    .update(drumscrollTranscriptions)
    .set(updates)
    .where(eq(drumscrollTranscriptions.id, id))
    .returning();

  return updated ? serializeTranscription(updated) : null;
}

export interface UpsertTranscriptionInput {
  title: string;
  artistOrCorps?: string;
  instrument?: Instrument;
  category?: Category;
  difficulty?: Difficulty;
  difficultyOverridden?: boolean;
  pageCount?: number;
  sourceUrl: string;
  pdfUrl: string;
  previewImageUrl?: string | null;
  sourceSite?: string;
}

/**
 * Inserts a new sheet music transcription or safely updates metadata on re-scrape
 * without clobbering user bookmarks, cached thumbnails, or manual difficulty overrides.
 */
export async function upsertTranscription(
  input: UpsertTranscriptionInput,
): Promise<{ item: TranscriptionItem; created: boolean }> {
  const db = await getDb();
  const title = input.title.trim().slice(0, 300);
  const artistOrCorps = (input.artistOrCorps?.trim() || "Unknown").slice(0, 200);
  const combinedText = `${title} ${artistOrCorps}`;
  const instrument = input.instrument ?? inferInstrument(combinedText, "Drumset");
  const category =
    input.category ?? inferCategory(combinedText, instrument, instrument === "Snare" ? "DCI" : "Rock/Funk");
  const pageCount = Math.max(1, Math.round(input.pageCount ?? 1));
  const autoDifficulty =
    input.difficulty ??
    estimateDifficulty({
      title,
      artistOrCorps,
      instrument,
      category,
      pageCount,
    });

  const previewImageUrl = input.previewImageUrl ?? resolveDriveThumbnailUrl(input.pdfUrl);

  const [existing] = await db
    .select({ id: drumscrollTranscriptions.id })
    .from(drumscrollTranscriptions)
    .where(eq(drumscrollTranscriptions.pdfUrl, input.pdfUrl))
    .limit(1);

  const [row] = await db
    .insert(drumscrollTranscriptions)
    .values({
      title,
      artistOrCorps,
      instrument,
      category,
      difficulty: autoDifficulty,
      difficultyOverridden: Boolean(input.difficultyOverridden),
      pageCount,
      sourceUrl: input.sourceUrl,
      pdfUrl: input.pdfUrl,
      previewImageUrl,
      bookmarked: false,
      sourceSite: input.sourceSite ?? "manual",
    })
    .onConflictDoUpdate({
      target: drumscrollTranscriptions.pdfUrl,
      set: {
        title,
        artistOrCorps,
        instrument,
        category,
        // Preserve manual difficulty overrides from the UI
        difficulty: sql`CASE WHEN ${drumscrollTranscriptions.difficultyOverridden} THEN ${drumscrollTranscriptions.difficulty} ELSE ${autoDifficulty} END`,
        // Preserve cached thumbnails if the incoming scrape has none
        previewImageUrl: sql`COALESCE(${drumscrollTranscriptions.previewImageUrl}, ${previewImageUrl})`,
      },
    })
    .returning();

  return {
    item: serializeTranscription(row),
    created: !existing,
  };
}

export async function listScraperSources(): Promise<ScraperSourceInfo[]> {
  const db = await getDb();
  const rows = await db.select().from(drumscrollSources).orderBy(asc(drumscrollSources.name));
  return rows.map(serializeSource);
}
