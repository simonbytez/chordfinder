export const INSTRUMENTS = ["Snare", "Drumset"] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const CATEGORIES = ["DCI", "WGI", "Jazz", "Rock/Funk", "Rudimental"] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "World Class/Pro"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type BrowseMode = "gallery" | "reels";

export interface TranscriptionItem {
  id: number;
  title: string;
  artistOrCorps: string;
  instrument: Instrument;
  category: Category;
  difficulty: Difficulty;
  difficultyOverridden: boolean;
  pageCount: number;
  sourceUrl: string;
  pdfUrl: string;
  previewImageUrl: string | null;
  bookmarked: boolean;
  sourceSite: string;
  createdAt: string;
}

export interface TranscriptionFacets {
  instruments: Record<string, number>;
  categories: Record<string, number>;
  difficulties: Record<string, number>;
  bookmarked: number;
  totalAll: number;
}

export interface TranscriptionsResponse {
  items: TranscriptionItem[];
  total: number;
  limit: number;
  offset: number;
  facets: TranscriptionFacets;
}

export interface ScraperSourceInfo {
  id: string;
  name: string;
  baseUrl: string;
  instrument: Instrument;
  defaultCategory: Category;
  description: string;
  lastRunAt: string | null;
  lastStatus: string;
  itemCount: number;
  lastError: string | null;
}

export function isInstrument(value: unknown): value is Instrument {
  return typeof value === "string" && (INSTRUMENTS as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * Extracts a Google Drive file ID from common share/view/download URLs:
 *  - https://drive.google.com/file/d/{ID}/view
 *  - https://drive.google.com/open?id={ID}
 *  - https://drive.google.com/uc?id={ID}&export=download
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const pathMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch) return pathMatch[1];
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("drive.google.com") || parsed.hostname.includes("docs.google.com")) {
      const id = parsed.searchParams.get("id");
      if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id;
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

/**
 * Returns a high-DPI first-page image preview URL when a sheet is hosted on Google Drive.
 */
export function resolveDriveThumbnailUrl(pdfUrl: string): string | null {
  const fileId = extractGoogleDriveFileId(pdfUrl);
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
}

/**
 * Returns an embeddable viewer URL for Google Drive PDFs, or null for direct PDFs.
 */
export function resolveDriveEmbedUrl(pdfUrl: string): string | null {
  const fileId = extractGoogleDriveFileId(pdfUrl);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
