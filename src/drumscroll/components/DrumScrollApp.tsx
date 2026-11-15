"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cachePreviewThumbnailApi,
  fetchTranscriptions,
  overrideDifficultyApi,
  toggleBookmarkApi,
} from "../lib/api";
import {
  type BrowseMode,
  type Category,
  type Difficulty,
  type Instrument,
  type TranscriptionFacets,
  type TranscriptionItem,
  type TranscriptionsResponse,
} from "../lib/constants";
import { GalleryGridView } from "./GalleryGridView";
import { PdfViewerModal } from "./PdfViewerModal";
import { ReelsSwipeView } from "./ReelsSwipeView";
import { ScraperDrawer } from "./ScraperDrawer";
import { TopFilterBar } from "./TopFilterBar";

const PAGE_SIZE = 40;

const EMPTY_FACETS: TranscriptionFacets = {
  instruments: {},
  categories: {},
  difficulties: {},
  bookmarked: 0,
  totalAll: 0,
};

export interface DrumScrollAppProps {
  initialData: TranscriptionsResponse;
  initialViewMode?: BrowseMode;
}

export function DrumScrollApp({
  initialData,
  initialViewMode = "gallery",
}: DrumScrollAppProps) {
  const [viewMode, setViewMode] = useState<BrowseMode>(initialViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [instrument, setInstrument] = useState<Instrument | "All">("All");
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [items, setItems] = useState<TranscriptionItem[]>(initialData.items);
  const [total, setTotal] = useState<number>(initialData.total);
  const [facets, setFacets] = useState<TranscriptionFacets>(initialData.facets ?? EMPTY_FACETS);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeSheet, setActiveSheet] = useState<TranscriptionItem | null>(null);
  const [scraperOpen, setScraperOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const isFirstMount = useRef(true);

  // Debounce live text search (220ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Refetch from offset=0 when unified filters, debounced search, or scraper refresh change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchTranscriptions({
      q: debouncedQuery,
      instrument,
      category,
      difficulty,
      bookmarked: bookmarkedOnly,
      limit: PAGE_SIZE,
      offset: 0,
      signal: controller.signal,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setFacets(res.facets);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("[drumscroll] filter fetch failed:", err);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, instrument, category, difficulty, bookmarkedOnly, refreshTick]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || items.length >= total) return;
    setLoadingMore(true);

    fetchTranscriptions({
      q: debouncedQuery,
      instrument,
      category,
      difficulty,
      bookmarked: bookmarkedOnly,
      limit: PAGE_SIZE,
      offset: items.length,
    })
      .then((res) => {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const nextItem of res.items) {
            if (!seen.has(nextItem.id)) merged.push(nextItem);
          }
          return merged;
        });
        setTotal(res.total);
        setFacets(res.facets);
      })
      .catch((err) => {
        console.error("[drumscroll] load more failed:", err);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [
    loading,
    loadingMore,
    items.length,
    total,
    debouncedQuery,
    instrument,
    category,
    difficulty,
    bookmarkedOnly,
  ]);

  const handleToggleBookmark = useCallback(
    async (target: TranscriptionItem) => {
      const nextSaved = !target.bookmarked;

      setItems((prev) => {
        if (bookmarkedOnly && !nextSaved) {
          return prev.filter((it) => it.id !== target.id);
        }
        return prev.map((it) => (it.id === target.id ? { ...it, bookmarked: nextSaved } : it));
      });
      setActiveSheet((curr) =>
        curr && curr.id === target.id ? { ...curr, bookmarked: nextSaved } : curr,
      );
      if (bookmarkedOnly && !nextSaved) {
        setTotal((t) => Math.max(0, t - 1));
      }
      setFacets((prev) => ({
        ...prev,
        bookmarked: Math.max(0, prev.bookmarked + (nextSaved ? 1 : -1)),
      }));

      try {
        await toggleBookmarkApi(target.id, nextSaved);
      } catch (err) {
        console.error("[drumscroll] bookmark update failed:", err);
      }
    },
    [bookmarkedOnly],
  );

  const handleOverrideDifficulty = useCallback(
    async (target: TranscriptionItem, nextDifficulty: Difficulty) => {
      const oldDifficulty = target.difficulty;
      if (oldDifficulty === nextDifficulty) return;

      setItems((prev) =>
        prev.map((it) =>
          it.id === target.id
            ? { ...it, difficulty: nextDifficulty, difficultyOverridden: true }
            : it,
        ),
      );
      setActiveSheet((curr) =>
        curr && curr.id === target.id
          ? { ...curr, difficulty: nextDifficulty, difficultyOverridden: true }
          : curr,
      );
      setFacets((prev) => ({
        ...prev,
        difficulties: {
          ...prev.difficulties,
          [oldDifficulty]: Math.max(0, (prev.difficulties[oldDifficulty] ?? 1) - 1),
          [nextDifficulty]: (prev.difficulties[nextDifficulty] ?? 0) + 1,
        },
      }));

      try {
        await overrideDifficultyApi(target.id, nextDifficulty);
      } catch (err) {
        console.error("[drumscroll] difficulty override failed:", err);
      }
    },
    [],
  );

  const handlePreviewCached = useCallback(
    (id: number, previewImageUrl: string, pageCount: number) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, previewImageUrl, pageCount } : it,
        ),
      );
      setActiveSheet((curr) =>
        curr && curr.id === id ? { ...curr, previewImageUrl, pageCount } : curr,
      );
    },
    [],
  );

  const handleModalPageCountResolved = useCallback(
    (id: number, pageCount: number, firstPageWebp?: string) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                pageCount,
                previewImageUrl: it.previewImageUrl ?? firstPageWebp ?? null,
              }
            : it,
        ),
      );
      if (firstPageWebp) {
        cachePreviewThumbnailApi(id, firstPageWebp, pageCount).catch(() => {});
      }
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setInstrument("All");
    setCategory("All");
    setDifficulty("All");
    setBookmarkedOnly(false);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <TopFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        instrument={instrument}
        onInstrumentChange={setInstrument}
        category={category}
        onCategoryChange={setCategory}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        bookmarkedOnly={bookmarkedOnly}
        onBookmarkedOnlyChange={setBookmarkedOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        facets={facets}
        totalMatching={total}
        onResetFilters={handleResetFilters}
        onOpenScraper={() => setScraperOpen(true)}
      />

      <main className="flex-1">
        {viewMode === "gallery" ? (
          <GalleryGridView
            items={items}
            total={total}
            loading={loading}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            onToggleBookmark={handleToggleBookmark}
            onOverrideDifficulty={handleOverrideDifficulty}
            onOpenSheet={setActiveSheet}
            onPreviewCached={handlePreviewCached}
            onResetFilters={handleResetFilters}
            onOpenScraper={() => setScraperOpen(true)}
          />
        ) : (
          <ReelsSwipeView
            items={items}
            total={total}
            loading={loading}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            onToggleBookmark={handleToggleBookmark}
            onOverrideDifficulty={handleOverrideDifficulty}
            onOpenSheet={setActiveSheet}
            onPreviewCached={handlePreviewCached}
            onResetFilters={handleResetFilters}
            onOpenScraper={() => setScraperOpen(true)}
          />
        )}
      </main>

      <PdfViewerModal
        item={activeSheet}
        onClose={() => setActiveSheet(null)}
        onToggleBookmark={handleToggleBookmark}
        onOverrideDifficulty={handleOverrideDifficulty}
        onPageCountResolved={handleModalPageCountResolved}
      />

      <ScraperDrawer
        open={scraperOpen}
        onClose={() => setScraperOpen(false)}
        onCatalogUpdated={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}
