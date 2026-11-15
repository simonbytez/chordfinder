"use client";

import { useEffect, useRef } from "react";
import { Database, Loader2, RotateCcw, SearchX } from "lucide-react";
import type { Difficulty, TranscriptionItem } from "../lib/constants";
import { TranscriptionCard } from "./TranscriptionCard";

interface GalleryGridViewProps {
  items: TranscriptionItem[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onToggleBookmark: (item: TranscriptionItem) => void;
  onOverrideDifficulty: (item: TranscriptionItem, next: Difficulty) => void;
  onOpenSheet: (item: TranscriptionItem) => void;
  onPreviewCached: (id: number, previewImageUrl: string, pageCount: number) => void;
  onResetFilters: () => void;
  onOpenScraper: () => void;
}

export function GalleryGridView({
  items,
  total,
  loading,
  loadingMore,
  onLoadMore,
  onToggleBookmark,
  onOverrideDifficulty,
  onOpenSheet,
  onPreviewCached,
  onResetFilters,
  onOpenScraper,
}: GalleryGridViewProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = items.length < total;

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "500px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  if (loading && items.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/50 animate-pulse"
            >
              <div className="aspect-[8.5/11] w-full rounded-t-2xl bg-zinc-800/70" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-4/5 rounded bg-zinc-800" />
                <div className="h-3 w-1/2 rounded bg-zinc-800/70" />
                <div className="pt-2 flex justify-between">
                  <div className="h-3 w-14 rounded bg-zinc-800/70" />
                  <div className="h-5 w-20 rounded-full bg-zinc-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
          <SearchX className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-100">No matching transcriptions</h2>
        <p className="mt-1.5 text-sm text-zinc-400">
          Try broadening your search or filters, or pull fresh sheets from a scraper source.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
          <button
            type="button"
            onClick={onOpenScraper}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer"
          >
            <Database className="h-3.5 w-3.5" />
            <span>Scrape Sources</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 sm:px-5 py-5 pb-16">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5">
        {items.map((item) => (
          <TranscriptionCard
            key={item.id}
            item={item}
            onToggleBookmark={onToggleBookmark}
            onOverrideDifficulty={onOverrideDifficulty}
            onOpenSheet={onOpenSheet}
            onPreviewCached={onPreviewCached}
          />
        ))}
      </div>

      {/* Infinite Scroll Sentinel / Load More */}
      <div ref={sentinelRef} className="mt-10 flex flex-col items-center justify-center">
        {loadingMore && (
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            <span>Loading more sheets…</span>
          </div>
        )}
        {!loadingMore && hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Load More ({items.length} of {total})
          </button>
        )}
      </div>
    </div>
  );
}
