import type { Category, Difficulty, Instrument } from "../../lib/constants";

export interface ScrapedSheetCandidate {
  title: string;
  artistOrCorps: string;
  instrument: Instrument;
  category?: Category;
  difficulty?: Difficulty;
  pageCount?: number;
  sourceUrl: string;
  pdfUrl: string;
  previewImageUrl?: string | null;
}

export interface ScraperContext {
  /** Millisecond timestamp at which the adapter should stop starting new network requests (Vercel 60s safety). */
  deadlineMs: number;
  /** Set of pdfUrls already stored for this source, so adapters can prioritize unseen sheets first. */
  existingPdfUrls: Set<string>;
}

export interface ScraperAdapter {
  id: string;
  name: string;
  baseUrl: string;
  instrument: Instrument;
  defaultCategory: Category;
  description: string;
  scrape(ctx: ScraperContext): Promise<{
    candidates: ScrapedSheetCandidate[];
    scannedPages: number;
    note?: string;
  }>;
}
