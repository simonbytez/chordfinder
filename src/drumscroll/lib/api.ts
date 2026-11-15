import type {
  Category,
  Difficulty,
  Instrument,
  ScraperSourceInfo,
  TranscriptionItem,
  TranscriptionsResponse,
} from "./constants";

export interface FetchTranscriptionsParams {
  q?: string;
  instrument?: Instrument | "All";
  category?: Category | "All";
  difficulty?: Difficulty | "All";
  bookmarked?: boolean;
  limit?: number;
  offset?: number;
  sort?: "newest" | "title";
  signal?: AbortSignal;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchTranscriptions(
  params: FetchTranscriptionsParams = {},
): Promise<TranscriptionsResponse> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.instrument && params.instrument !== "All") sp.set("instrument", params.instrument);
  if (params.category && params.category !== "All") sp.set("category", params.category);
  if (params.difficulty && params.difficulty !== "All") sp.set("difficulty", params.difficulty);
  if (params.bookmarked) sp.set("bookmarked", "1");
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  if (params.sort) sp.set("sort", params.sort);

  const qs = sp.toString();
  return requestJson<TranscriptionsResponse>(`/api/drumscroll/transcriptions${qs ? `?${qs}` : ""}`, {
    signal: params.signal,
  });
}

export async function toggleBookmarkApi(
  id: number,
  bookmarked: boolean,
): Promise<{ item: TranscriptionItem }> {
  return requestJson<{ item: TranscriptionItem }>(`/api/drumscroll/transcriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ bookmarked }),
  });
}

export async function overrideDifficultyApi(
  id: number,
  difficulty: Difficulty,
): Promise<{ item: TranscriptionItem }> {
  return requestJson<{ item: TranscriptionItem }>(`/api/drumscroll/transcriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ difficulty }),
  });
}

export async function cachePreviewThumbnailApi(
  id: number,
  previewImageUrl: string,
  pageCount?: number,
): Promise<{ item: TranscriptionItem }> {
  return requestJson<{ item: TranscriptionItem }>(`/api/drumscroll/transcriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ previewImageUrl, ...(pageCount ? { pageCount } : {}) }),
  });
}

export async function fetchScraperSources(): Promise<{ sources: ScraperSourceInfo[] }> {
  return requestJson<{ sources: ScraperSourceInfo[] }>("/api/drumscroll/scrapers");
}

export async function triggerScraperRun(adapterId: string): Promise<{
  ok: boolean;
  source?: ScraperSourceInfo;
  added: number;
  updated: number;
  scanned: number;
  message?: string;
}> {
  const res = await fetch(`/api/drumscroll/scrapers/${encodeURIComponent(adapterId)}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.source) {
    throw new Error(data.error || data.message || `Scraper failed (${res.status})`);
  }
  return data;
}

export async function createManualTranscriptionApi(payload: {
  title: string;
  artistOrCorps?: string;
  instrument: Instrument;
  category: Category;
  difficulty?: Difficulty;
  pdfUrl: string;
  sourceUrl?: string;
}): Promise<{ item: TranscriptionItem; created: boolean }> {
  return requestJson<{ item: TranscriptionItem; created: boolean }>("/api/drumscroll/transcriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
