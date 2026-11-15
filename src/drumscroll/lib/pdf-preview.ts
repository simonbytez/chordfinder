"use client";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | null = null;

/**
 * Dynamically loads pdf.js 4.x from CDN in the browser (using a Blob module worker
 * to avoid cross-origin Worker restrictions, matching src/tutor/lib/extract.js).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadPdfJs can only run in the browser."));
  }
  if (!pdfjsPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loader: Promise<any> = (new Function("u", "return import(u)")(PDFJS_CDN) as Promise<any>).then(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lib: any) => {
        const bootUrl = URL.createObjectURL(
          new Blob([`import ${JSON.stringify(PDFJS_WORKER_CDN)};`], { type: "text/javascript" }),
        );
        lib.GlobalWorkerOptions.workerPort = new Worker(bootUrl, { type: "module" });
        return lib;
      },
    );
    loader.catch(() => {
      pdfjsPromise = null;
    });
    pdfjsPromise = loader;
  }
  return pdfjsPromise;
}

export function buildPdfProxyUrl(pdfUrl: string): string {
  return `/api/drumscroll/pdf?url=${encodeURIComponent(pdfUrl)}`;
}

export interface RenderedFirstPage {
  webpDataUrl: string;
  pageCount: number;
}

const memoryPreviewCache = new Map<string, Promise<RenderedFirstPage>>();

// Limit concurrent PDF downloads/rasterizations to keep scrolling 60fps
const MAX_CONCURRENT_RENDERS = 3;
let activeRenders = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRenders++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRenders = Math.max(0, activeRenders - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/**
 * Fetches an external PDF via our Edge-cached proxy and rasterizes Page 1 into
 * a crisp high-DPI .webp data URL + exact page count.
 */
export function renderPdfFirstPageToWebp(
  pdfUrl: string,
  targetWidth = 850,
): Promise<RenderedFirstPage> {
  const cached = memoryPreviewCache.get(pdfUrl);
  if (cached) return cached;

  const job = (async (): Promise<RenderedFirstPage> => {
    await acquireSlot();
    try {
      const pdfjs = await loadPdfJs();
      const proxiedUrl = buildPdfProxyUrl(pdfUrl);
      const loadingTask = pdfjs.getDocument({
        url: proxiedUrl,
        cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/",
        cMapPacked: true,
      });

      const pdfDoc = await loadingTask.promise;
      try {
        const pageCount: number = pdfDoc.numPages || 1;
        const page = await pdfDoc.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(Math.max(targetWidth / Math.max(baseViewport.width, 1), 1), 2.5);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas 2D context unavailable.");

        // Paint crisp white paper backing for transparent-background notation PDFs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        let webpDataUrl = canvas.toDataURL("image/webp", 0.82);
        // Fallback for browsers that return image/png when webp encoding isn't supported
        if (!webpDataUrl.startsWith("data:image/webp")) {
          webpDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }

        return { webpDataUrl, pageCount };
      } finally {
        await pdfDoc.destroy();
      }
    } finally {
      releaseSlot();
    }
  })();

  job.catch(() => {
    memoryPreviewCache.delete(pdfUrl);
  });

  memoryPreviewCache.set(pdfUrl, job);
  return job;
}
