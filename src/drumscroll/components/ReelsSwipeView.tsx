"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  Maximize2,
  RotateCcw,
  SearchX,
} from "lucide-react";
import {
  DIFFICULTIES,
  type Difficulty,
  type TranscriptionItem,
} from "../lib/constants";
import { DIFFICULTY_SHORT_LABELS, DIFFICULTY_STYLES } from "./DifficultyBadge";
import { SheetThumbnail } from "./SheetThumbnail";

interface ReelsSwipeViewProps {
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

export function ReelsSwipeView({
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
}: ReelsSwipeViewProps) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openDifficultyForId, setOpenDifficultyForId] = useState<number | null>(null);
  const currentIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  // Track which slide is snapped in viewport via IntersectionObserver
  useEffect(() => {
    const container = feedRef.current;
    if (!container || items.length === 0) return;

    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-reel-index]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.reelIndex ?? 0);
            if (Number.isFinite(idx)) {
              setActiveIndex(idx);
            }
          }
        }
      },
      {
        root: container,
        threshold: [0.55, 0.75],
      },
    );

    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  // Prefetch next page when within 4 reels of the end
  useEffect(() => {
    if (!loading && !loadingMore && items.length < total && currentIndex >= items.length - 4) {
      onLoadMore();
    }
  }, [currentIndex, items.length, total, loading, loadingMore, onLoadMore]);

  const scrollToIndex = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(nextIdx, items.length - 1));
      const container = feedRef.current;
      if (!container) return;
      const targetEl = container.querySelector<HTMLElement>(`[data-reel-index="${clamped}"]`);
      targetEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [items.length],
  );

  // Keyboard navigation: Up/Down arrows or j/k
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, scrollToIndex]);

  if (loading && items.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-6.25rem)] items-center justify-center bg-zinc-950">
        <div className="h-[82%] aspect-[8.5/11] rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-6.25rem)] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
          <SearchX className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-100">No sheets in Reels feed</h2>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
          Adjust your filters above or scrape new snare &amp; drumset transcriptions.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
          <button
            type="button"
            onClick={onOpenScraper}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
          >
            <Database className="h-3.5 w-3.5" />
            <span>Scrape Sources</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-6.25rem)] w-full bg-zinc-950 overflow-hidden">
      {/* Vertical Snap Scroll Container */}
      <div
        ref={feedRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {items.map((item, idx) => {
          const isNearActive = Math.abs(idx - currentIndex) <= 2;
          const diffPickerOpen = openDifficultyForId === item.id;

          return (
            <div
              key={item.id}
              data-reel-index={idx}
              className="relative h-full w-full snap-start snap-always flex items-center justify-center px-2 sm:px-6 py-3"
            >
              {/* Centered Reel Stage */}
              <div className="relative flex h-full w-full max-w-4xl items-center justify-center gap-3 sm:gap-5">
                {/* Crisp Full-Height Sheet Music Frame */}
                <div
                  onClick={() => onOpenSheet(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenSheet(item);
                    }
                  }}
                  className="relative h-full max-h-[86dvh] aspect-[8.5/11] max-w-[calc(100vw-4.75rem)] sm:max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-[#fcfbf7] shadow-2xl cursor-pointer group"
                >
                  <SheetThumbnail
                    item={item}
                    eager={isNearActive}
                    className="h-full w-full"
                    imgClassName="object-contain object-center"
                    onPreviewCached={onPreviewCached}
                  />

                  {/* Bottom gradient overlay for legibility of title/corps metadata */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zinc-950/95 via-zinc-950/65 to-transparent" />

                  {/* Top-left counter & page pill */}
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur-md">
                      {idx + 1} / {total}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur-md">
                      <FileText className="h-3 w-3 text-amber-400" />
                      {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
                    </span>
                  </div>

                  {/* Bottom Metadata Overlay (TikTok/Reels caption area) */}
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-left">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-zinc-950">
                        {item.instrument}
                      </span>
                      <span className="rounded-full border border-zinc-700 bg-zinc-900/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                        {item.category}
                      </span>
                      <span className="rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                        {item.sourceSite}
                      </span>
                    </div>

                    <h2 className="line-clamp-2 text-base sm:text-xl font-bold text-white drop-shadow-xs">
                      {item.title}
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm font-medium text-zinc-300">
                      {item.artistOrCorps}
                    </p>
                  </div>
                </div>

                {/* Right-Hand Floating Action Rail */}
                <div className="flex flex-col items-center gap-3 self-end sm:self-center pb-4 sm:pb-0 z-20">
                  {/* Bookmark Action */}
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(item)}
                    className="group flex flex-col items-center gap-1 cursor-pointer"
                    title={item.bookmarked ? "Remove from Saved" : "Save transcription"}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all shadow-lg ${
                        item.bookmarked
                          ? "border-rose-400/60 bg-rose-500 text-white scale-105"
                          : "border-zinc-800 bg-zinc-900/90 text-zinc-200 group-hover:border-zinc-700 group-hover:bg-zinc-800"
                      }`}
                    >
                      <Bookmark className={`h-5 w-5 ${item.bookmarked ? "fill-current" : ""}`} />
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {item.bookmarked ? "Saved" : "Save"}
                    </span>
                  </button>

                  {/* 1-Click Difficulty Override Action */}
                  <div className="relative flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDifficultyForId(diffPickerOpen ? null : item.id)
                      }
                      title="1-click difficulty override"
                      className={`flex h-11 px-2.5 min-w-11 items-center justify-center rounded-2xl border text-[11px] font-semibold transition-all shadow-lg cursor-pointer ${DIFFICULTY_STYLES[item.difficulty]}`}
                    >
                      {DIFFICULTY_SHORT_LABELS[item.difficulty]}
                    </button>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {item.difficultyOverridden ? "Manual" : "Level"}
                    </span>

                    {diffPickerOpen && (
                      <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 z-40 w-44 rounded-xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Override Difficulty
                        </div>
                        {DIFFICULTIES.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => {
                              setOpenDifficultyForId(null);
                              onOverrideDifficulty(item, lvl);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                              lvl === item.difficulty
                                ? "bg-amber-500/20 text-amber-300 font-semibold"
                                : "text-zinc-200 hover:bg-zinc-800"
                            }`}
                          >
                            <span>{lvl}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Full Multi-Page Reader Modal Action */}
                  <button
                    type="button"
                    onClick={() => onOpenSheet(item)}
                    className="group flex flex-col items-center gap-1 cursor-pointer"
                    title="Open full multi-page sheet reader"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/90 text-amber-400 group-hover:border-amber-500/50 group-hover:bg-zinc-800 transition-all shadow-lg">
                      <Maximize2 className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      Read PDF
                    </span>
                  </button>

                  {/* External Source Link */}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1"
                    title="Open original source site"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/90 text-zinc-300 group-hover:border-zinc-700 group-hover:bg-zinc-800 transition-all shadow-lg">
                      <ExternalLink className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      Source
                    </span>
                  </a>

                  {/* Desktop Prev / Next Step Buttons */}
                  <div className="hidden sm:flex flex-col items-center gap-1.5 pt-2 border-t border-zinc-800/80">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => scrollToIndex(idx - 1)}
                      aria-label="Previous sheet"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 cursor-pointer disabled:cursor-default"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx >= items.length - 1}
                      onClick={() => scrollToIndex(idx + 1)}
                      aria-label="Next sheet"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 cursor-pointer disabled:cursor-default"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
