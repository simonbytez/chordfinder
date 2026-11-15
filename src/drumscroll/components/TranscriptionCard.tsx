"use client";

import { Bookmark, ExternalLink, Eye, FileText } from "lucide-react";
import type { Difficulty, TranscriptionItem } from "../lib/constants";
import { DifficultyBadge } from "./DifficultyBadge";
import { SheetThumbnail } from "./SheetThumbnail";

interface TranscriptionCardProps {
  item: TranscriptionItem;
  onToggleBookmark: (item: TranscriptionItem) => void;
  onOverrideDifficulty: (item: TranscriptionItem, next: Difficulty) => void;
  onOpenSheet: (item: TranscriptionItem) => void;
  onPreviewCached: (id: number, previewImageUrl: string, pageCount: number) => void;
}

export function TranscriptionCard({
  item,
  onToggleBookmark,
  onOverrideDifficulty,
  onOpenSheet,
  onPreviewCached,
}: TranscriptionCardProps) {
  return (
    <article className="group flex flex-col rounded-2xl border border-zinc-800/85 bg-zinc-900/75 shadow-sm hover:border-zinc-700 hover:bg-zinc-900 transition-all">
      {/* 8.5 x 11 Sheet Music Preview Area */}
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
        className="relative aspect-[8.5/11] w-full overflow-hidden rounded-t-2xl cursor-pointer"
      >
        <SheetThumbnail
          item={item}
          className="h-full w-full"
          imgClassName="object-cover object-top group-hover:scale-[1.02]"
          onPreviewCached={onPreviewCached}
        />

        {/* Subtle gradient vignette on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Top-left Instrument · Category pill */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-zinc-950/80 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-200 backdrop-blur-md shadow-sm">
          <span>{item.instrument}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-amber-300">{item.category}</span>
        </div>

        {/* Top-right Bookmark button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(item);
          }}
          aria-label={item.bookmarked ? "Remove bookmark" : "Bookmark transcription"}
          title={item.bookmarked ? "Saved" : "Save sheet"}
          className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md shadow-sm transition-all cursor-pointer ${
            item.bookmarked
              ? "bg-rose-500 text-white"
              : "bg-zinc-950/75 text-zinc-200 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          <Bookmark className={`h-4 w-4 ${item.bookmarked ? "fill-current" : ""}`} />
        </button>

        {/* Bottom-left Page count badge */}
        <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-200 backdrop-blur-md">
          <FileText className="h-3 w-3 text-zinc-400" />
          <span>
            {item.pageCount} {item.pageCount === 1 ? "p" : "pp"}
          </span>
        </div>

        {/* Bottom-right Quick Actions on Hover */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 shadow">
            <Eye className="h-3 w-3" />
            <span>View</span>
          </span>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Visit original source page"
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-950/85 text-zinc-200 hover:bg-zinc-900 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Card Metadata & 1-Click Difficulty Override Footer */}
      <div className="flex flex-1 flex-col justify-between gap-2.5 p-3">
        <div>
          <h3
            onClick={() => onOpenSheet(item)}
            className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {item.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
            {item.artistOrCorps}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/70">
          <span className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {item.sourceSite}
          </span>
          <DifficultyBadge
            difficulty={item.difficulty}
            overridden={item.difficultyOverridden}
            onSelectDifficulty={(next) => onOverrideDifficulty(item, next)}
          />
        </div>
      </div>
    </article>
  );
}
