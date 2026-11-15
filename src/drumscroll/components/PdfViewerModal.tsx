"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  Download,
  ExternalLink,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type Difficulty,
  resolveDriveEmbedUrl,
  type TranscriptionItem,
} from "../lib/constants";
import { buildPdfProxyUrl, loadPdfJs } from "../lib/pdf-preview";
import { DifficultyBadge } from "./DifficultyBadge";

interface PdfViewerModalProps {
  item: TranscriptionItem | null;
  onClose: () => void;
  onToggleBookmark: (item: TranscriptionItem) => void;
  onOverrideDifficulty: (item: TranscriptionItem, next: Difficulty) => void;
  onPageCountResolved?: (id: number, pageCount: number, firstPageWebp?: string) => void;
}

export function PdfViewerModal(props: PdfViewerModalProps) {
  if (!props.item) return null;
  return <PdfViewerDialog key={props.item.id} {...props} item={props.item} />;
}

function PdfViewerDialog({
  item,
  onClose,
  onToggleBookmark,
  onOverrideDifficulty,
  onPageCountResolved,
}: Omit<PdfViewerModalProps, "item"> & { item: TranscriptionItem }) {
  const isSeedPlaceholder = item.pdfUrl.includes("#seed-");
  const driveEmbedUrl = resolveDriveEmbedUrl(item.pdfUrl);
  const shouldRenderCanvasPages = !isSeedPlaceholder && !driveEmbedUrl;

  const [renderedPages, setRenderedPages] = useState<string[]>([]);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(shouldRenderCanvasPages);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!shouldRenderCanvasPages) return;

    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({
          url: buildPdfProxyUrl(item.pdfUrl),
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/",
          cMapPacked: true,
        });
        const pdfDoc = await task.promise;
        try {
          const numPages: number = pdfDoc.numPages || 1;
          const pagesOut: string[] = [];

          for (let p = 1; p <= Math.min(numPages, 25); p++) {
            if (cancelled) break;
            const page = await pdfDoc.getPage(p);
            const baseVp = page.getViewport({ scale: 1 });
            const scale = Math.min(Math.max(1300 / Math.max(baseVp.width, 1), 1.25), 2.5);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) continue;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            page.cleanup();

            let dataUrl = canvas.toDataURL("image/webp", 0.86);
            if (!dataUrl.startsWith("data:image/webp")) {
              dataUrl = canvas.toDataURL("image/jpeg", 0.88);
            }
            pagesOut.push(dataUrl);
            if (!cancelled) {
              setRenderedPages([...pagesOut]);
            }
          }

          if (!cancelled && pagesOut.length > 0) {
            onPageCountResolved?.(item.id, numPages, pagesOut[0]);
          }
        } finally {
          await pdfDoc.destroy();
        }
      } catch (err) {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : "Could not render PDF inline.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldRenderCanvasPages, item.id, item.pdfUrl, onPageCountResolved]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md"
    >
      {/* Top Reader Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              {item.instrument} · {item.category}
            </span>
            <h2 className="truncate text-sm sm:text-base font-bold text-zinc-100">
              {item.title}
            </h2>
          </div>
          <p className="truncate text-xs text-zinc-400">{item.artistOrCorps}</p>
        </div>

        <div className="flex items-center gap-2">
          {!driveEmbedUrl && (
            <div className="hidden sm:inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.max(60, z - 20))}
                aria-label="Zoom out"
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-11 text-center font-mono text-[11px] text-zinc-300">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.min(180, z + 20))}
                aria-label="Zoom in"
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <DifficultyBadge
            difficulty={item.difficulty}
            overridden={item.difficultyOverridden}
            onSelectDifficulty={(next) => onOverrideDifficulty(item, next)}
            size="md"
          />

          <button
            type="button"
            onClick={() => onToggleBookmark(item)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
              item.bookmarked
                ? "border-rose-500/50 bg-rose-500 text-white"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${item.bookmarked ? "fill-current" : ""}`} />
            <span className="hidden md:inline">{item.bookmarked ? "Saved" : "Save"}</span>
          </button>

          {!isSeedPlaceholder && (
            <a
              href={item.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          )}

          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Source</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Sheet Music Stand */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-6"
      >
        {driveEmbedUrl ? (
          <div className="mx-auto h-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <iframe
              src={driveEmbedUrl}
              title={item.title}
              className="h-full w-full min-h-[78dvh]"
              allow="autoplay"
            />
          </div>
        ) : isSeedPlaceholder && item.previewImageUrl ? (
          <div
            style={{ maxWidth: `${Math.round(8.2 * zoomPercent)}px` }}
            className="mx-auto space-y-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewImageUrl}
              alt={item.title}
              className="w-full rounded-xl bg-white shadow-2xl"
            />
            <p className="text-center text-xs text-zinc-400">
              Starter catalog sheet preview · Open{" "}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 underline hover:text-amber-300"
              >
                {item.sourceSite}
              </a>{" "}
              or run the live scraper in Sources for full multi-page PDFs.
            </p>
          </div>
        ) : (
          <div
            style={{ maxWidth: `${Math.round(8.5 * zoomPercent)}px` }}
            className="mx-auto space-y-5"
          >
            {renderedPages.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${item.title} — Page ${i + 1}`}
                  className="w-full rounded-xl bg-white shadow-2xl"
                />
                <span className="absolute right-3 top-3 rounded-full bg-zinc-950/75 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-200">
                  Page {i + 1}
                </span>
              </div>
            ))}

            {loadingPdf && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 py-20 text-zinc-300">
                <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
                <p className="mt-3 text-sm font-medium">
                  Rendering high-DPI sheet music pages…
                </p>
              </div>
            )}

            {!loadingPdf && pdfError && renderedPages.length === 0 && (
              <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
                <p className="text-sm font-medium text-zinc-200">{pdfError}</p>
                <a
                  href={item.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Original PDF Directly</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
