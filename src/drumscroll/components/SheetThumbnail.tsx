"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cachePreviewThumbnailApi } from "../lib/api";
import type { TranscriptionItem } from "../lib/constants";
import { renderPdfFirstPageToWebp } from "../lib/pdf-preview";

interface SheetThumbnailProps {
  item: TranscriptionItem;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  onPreviewCached?: (id: number, previewImageUrl: string, pageCount: number) => void;
}

export function SheetThumbnail({
  item,
  className = "",
  imgClassName = "object-contain object-top",
  eager = false,
  onPreviewCached,
}: SheetThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderedForId, setRenderedForId] = useState<{ id: number; url: string } | null>(null);
  const [failedForId, setFailedForId] = useState<number | null>(null);
  const [nearViewport, setNearViewport] = useState<boolean>(eager);
  const [rendering, setRendering] = useState<boolean>(false);

  const failed = failedForId === item.id;
  const generatedUrl = renderedForId?.id === item.id ? renderedForId.url : null;
  const effectiveSrc = !failed ? (generatedUrl ?? item.previewImageUrl) : null;
  const canRenderPdf =
    !effectiveSrc &&
    !failed &&
    /^https?:\/\//i.test(item.pdfUrl) &&
    !item.pdfUrl.includes("#seed-");

  useEffect(() => {
    if (eager || effectiveSrc || nearViewport || !canRenderPdf) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "420px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, effectiveSrc, nearViewport, canRenderPdf]);

  useEffect(() => {
    if (!canRenderPdf || !(eager || nearViewport)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setRendering(true);
    }, 0);

    renderPdfFirstPageToWebp(item.pdfUrl)
      .then(({ webpDataUrl, pageCount }) => {
        if (cancelled) return;
        setRenderedForId({ id: item.id, url: webpDataUrl });
        setRendering(false);
        onPreviewCached?.(item.id, webpDataUrl, pageCount);
        cachePreviewThumbnailApi(item.id, webpDataUrl, pageCount).catch(() => {});
      })
      .catch(() => {
        if (cancelled) return;
        setRendering(false);
        setFailedForId(item.id);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canRenderPdf, eager, nearViewport, item.id, item.pdfUrl, onPreviewCached]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[#fcfbf7] select-none ${className}`}
    >
      {effectiveSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={effectiveSrc}
          alt={`${item.title} — ${item.artistOrCorps} sheet music preview`}
          loading={eager ? "eager" : "lazy"}
          onError={() => {
            setFailedForId(item.id);
          }}
          className={`h-full w-full transition-transform duration-300 ${imgClassName}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-between p-4 text-zinc-700">
          <div className="text-center pt-2">
            <p className="line-clamp-2 font-serif text-xs font-bold text-zinc-900">{item.title}</p>
            <p className="mt-0.5 line-clamp-1 font-serif text-[10px] italic text-zinc-500">
              {item.artistOrCorps}
            </p>
          </div>

          <div className="my-auto space-y-4 opacity-35 px-1">
            {[0, 1, 2, 3].map((staff) => (
              <div key={staff} className="space-y-[3px]">
                {[0, 1, 2, 3, 4].map((line) => (
                  <div key={line} className="h-[1px] w-full bg-zinc-700" />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 pb-1 text-[11px] font-medium text-zinc-500">
            {rendering ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                <span>Rendering Page 1…</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                <span>PDF Sheet</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
