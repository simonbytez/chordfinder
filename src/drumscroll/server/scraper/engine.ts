import { count, eq } from "drizzle-orm";
import type { ScraperSourceInfo } from "../../lib/constants";
import { getDb } from "../db";
import { serializeSource, upsertTranscription } from "../queries";
import { drumscrollSources, drumscrollTranscriptions } from "../schema";
import { getScraperAdapter } from "./adapters";

export interface ScraperRunResult {
  ok: boolean;
  source: ScraperSourceInfo;
  added: number;
  updated: number;
  scanned: number;
  message: string;
}

/**
 * Executes a registered site scraper adapter within a Vercel-safe 44s time budget,
 * auto-tags difficulty/category, deduplicates on pdf_url, and updates source telemetry.
 */
export async function runScraperAdapter(
  adapterId: string,
  budgetMs = 44_000,
): Promise<ScraperRunResult> {
  const adapter = getScraperAdapter(adapterId);
  if (!adapter) {
    throw Object.assign(new Error(`Unknown scraper adapter: "${adapterId}".`), { status: 404 });
  }

  const db = await getDb();

  // Ensure source metadata row exists and mark running
  await db
    .insert(drumscrollSources)
    .values({
      id: adapter.id,
      name: adapter.name,
      baseUrl: adapter.baseUrl,
      instrument: adapter.instrument,
      defaultCategory: adapter.defaultCategory,
      description: adapter.description,
      lastStatus: "running",
    })
    .onConflictDoUpdate({
      target: drumscrollSources.id,
      set: { lastStatus: "running", lastError: null },
    });

  const existingRows = await db
    .select({ pdfUrl: drumscrollTranscriptions.pdfUrl })
    .from(drumscrollTranscriptions)
    .where(eq(drumscrollTranscriptions.sourceSite, adapter.id));

  const existingPdfUrls = new Set(existingRows.map((r) => r.pdfUrl));
  const deadlineMs = Date.now() + budgetMs;

  try {
    const { candidates, scannedPages, note } = await adapter.scrape({
      deadlineMs,
      existingPdfUrls,
    });

    let added = 0;
    let updated = 0;

    for (const candidate of candidates) {
      if (!candidate.pdfUrl || !candidate.title) continue;
      const res = await upsertTranscription({
        title: candidate.title,
        artistOrCorps: candidate.artistOrCorps,
        instrument: candidate.instrument,
        category: candidate.category,
        difficulty: candidate.difficulty,
        pageCount: candidate.pageCount,
        sourceUrl: candidate.sourceUrl,
        pdfUrl: candidate.pdfUrl,
        previewImageUrl: candidate.previewImageUrl,
        sourceSite: adapter.id,
      });
      if (res.created) added++;
      else updated++;
    }

    const [{ totalForSite }] = await db
      .select({ totalForSite: count() })
      .from(drumscrollTranscriptions)
      .where(eq(drumscrollTranscriptions.sourceSite, adapter.id));

    const [updatedSourceRow] = await db
      .update(drumscrollSources)
      .set({
        lastRunAt: new Date(),
        lastStatus: "ok",
        itemCount: Number(totalForSite),
        lastError: null,
      })
      .where(eq(drumscrollSources.id, adapter.id))
      .returning();

    return {
      ok: true,
      source: serializeSource(updatedSourceRow),
      added,
      updated,
      scanned: scannedPages,
      message: note ?? `Added ${added} new transcriptions (${updated} existing updated).`,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Scraper run failed.";
    const [{ totalForSite }] = await db
      .select({ totalForSite: count() })
      .from(drumscrollTranscriptions)
      .where(eq(drumscrollTranscriptions.sourceSite, adapter.id));

    const [failedSourceRow] = await db
      .update(drumscrollSources)
      .set({
        lastRunAt: new Date(),
        lastStatus: "error",
        itemCount: Number(totalForSite),
        lastError: errorMessage,
      })
      .where(eq(drumscrollSources.id, adapter.id))
      .returning();

    return {
      ok: false,
      source: serializeSource(failedSourceRow),
      added: 0,
      updated: 0,
      scanned: 0,
      message: errorMessage,
    };
  }
}
