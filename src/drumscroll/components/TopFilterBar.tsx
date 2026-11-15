"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Bookmark,
  Database,
  Drum,
  GalleryVerticalEnd,
  LayoutGrid,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  type BrowseMode,
  CATEGORIES,
  type Category,
  DIFFICULTIES,
  type Difficulty,
  INSTRUMENTS,
  type Instrument,
  type TranscriptionFacets,
} from "../lib/constants";

export interface TopFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  instrument: Instrument | "All";
  onInstrumentChange: (inst: Instrument | "All") => void;
  category: Category | "All";
  onCategoryChange: (cat: Category | "All") => void;
  difficulty: Difficulty | "All";
  onDifficultyChange: (diff: Difficulty | "All") => void;
  bookmarkedOnly: boolean;
  onBookmarkedOnlyChange: (saved: boolean) => void;
  viewMode: BrowseMode;
  onViewModeChange: (mode: BrowseMode) => void;
  facets: TranscriptionFacets;
  totalMatching: number;
  onResetFilters: () => void;
  onOpenScraper: () => void;
}

export function TopFilterBar({
  searchQuery,
  onSearchChange,
  instrument,
  onInstrumentChange,
  category,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  bookmarkedOnly,
  onBookmarkedOnlyChange,
  viewMode,
  onViewModeChange,
  facets,
  totalMatching,
  onResetFilters,
  onOpenScraper,
}: TopFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    instrument !== "All" ||
    category !== "All" ||
    difficulty !== "All" ||
    bookmarkedOnly;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        {/* Top Row: Brand, Live Search, Scraper Button, View Switcher */}
        <div className="flex h-14 items-center gap-2.5 sm:gap-4">
          {/* Brand + Boomcat back link */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              title="Back to Boomcat"
              className="hidden sm:inline-flex items-center rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
            >
              boomcat /
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-zinc-950 shadow-sm">
                <Drum className="h-4 w-4 stroke-[2.4]" />
              </div>
              <div className="leading-tight">
                <span className="font-bold tracking-tight text-zinc-100 text-sm sm:text-base">
                  DrumScroll
                </span>
                <span className="hidden lg:inline-block ml-2 rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                  {totalMatching} {totalMatching === 1 ? "sheet" : "sheets"}
                </span>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xl mx-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search title, corps, or drummer (e.g. Blue Devils, Tony Williams)…"
              className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-9 pr-14 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                /
              </kbd>
            )}
          </div>

          {/* Right Controls: Sources Drawer + Gallery/Reels Segmented Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenScraper}
              title="Manage & scrape sheet music sources"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 sm:px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <Database className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Sources</span>
            </button>

            <div
              role="group"
              aria-label="Browse layout mode"
              className="inline-flex h-9 items-center rounded-xl border border-zinc-800 bg-zinc-900 p-0.5"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("gallery")}
                aria-pressed={viewMode === "gallery"}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "gallery"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("reels")}
                aria-pressed={viewMode === "reels"}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "reels"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <GalleryVerticalEnd className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reels</span>
              </button>
            </div>
          </div>
        </div>

        {/* Second Row: Unified Filter Bar (Instrument, Category, Difficulty, Saved Only) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-t border-zinc-900/90 text-xs">
          {/* Instrument Segmented Pills */}
          <div className="flex items-center gap-1 shrink-0 rounded-lg bg-zinc-900/80 p-0.5 border border-zinc-800/80">
            {(["All", ...INSTRUMENTS] as const).map((inst) => {
              const active = instrument === inst;
              const cnt =
                inst === "All" ? facets.totalAll : (facets.instruments[inst] ?? 0);
              return (
                <button
                  key={inst}
                  type="button"
                  onClick={() => onInstrumentChange(inst)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-zinc-800 text-white shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>{inst}</span>
                  <span className="text-[10px] text-zinc-500">{cnt}</span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 shrink-0">
            {(["All", ...CATEGORIES] as const).map((cat) => {
              const active = category === cat;
              const cnt = cat === "All" ? null : (facets.categories[cat] ?? 0);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                    active
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <span>{cat === "All" ? "All Styles" : cat}</span>
                  {cnt !== null && (
                    <span className="text-[10px] opacity-65">{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-[1px] bg-zinc-800 shrink-0" />

          {/* Difficulty Select Dropdown */}
          <div className="shrink-0">
            <select
              aria-label="Filter by difficulty"
              value={difficulty}
              onChange={(e) =>
                onDifficultyChange(e.target.value as Difficulty | "All")
              }
              className={`h-7 rounded-full border px-3 text-xs font-medium focus:outline-none cursor-pointer transition-colors ${
                difficulty !== "All"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <option value="All" className="bg-zinc-900 text-zinc-200">
                Difficulty: All
              </option>
              {DIFFICULTIES.map((diff) => (
                <option key={diff} value={diff} className="bg-zinc-900 text-zinc-200">
                  {diff} ({facets.difficulties[diff] ?? 0})
                </option>
              ))}
            </select>
          </div>

          {/* Saved / Bookmarked Only Toggle */}
          <button
            type="button"
            onClick={() => onBookmarkedOnlyChange(!bookmarkedOnly)}
            aria-pressed={bookmarkedOnly}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors cursor-pointer ${
              bookmarkedOnly
                ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${bookmarkedOnly ? "fill-rose-400 text-rose-400" : ""}`}
            />
            <span>Saved</span>
            <span className="text-[10px] opacity-75">{facets.bookmarked}</span>
          </button>

          {/* Reset Active Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
