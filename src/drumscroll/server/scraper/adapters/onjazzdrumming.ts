import { cleanText, decodeHtmlEntities, politeDelay, politeFetchText } from "../robots";
import type { ScrapedSheetCandidate, ScraperAdapter, ScraperContext } from "../types";

const BASE = "https://www.onjazzdrumming.com/";
const INDEX_PAGES = [
  "https://www.onjazzdrumming.com/jazz-drumming-ideas-and-exercises.html",
  "https://www.onjazzdrumming.com/jazz-drumming-fundamentals.html",
  "https://www.onjazzdrumming.com/jazz-drumming-transcriptions.html",
];

function extractCanonicalPdfUrls(detailHtml: string, pageUrl: string): string[] {
  const results = new Set<string>();
  const hrefRegex = /href=["']([^"']+\.pdf[^"']*)["']/gi;
  let m: RegExpExecArray | null;

  while ((m = hrefRegex.exec(detailHtml)) !== null) {
    const rawHref = decodeHtmlEntities(m[1]).trim();
    if (!rawHref || rawHref.includes("gumroad.com")) continue;

    try {
      const resolved = new URL(rawHref, pageUrl);
      const fileParam = resolved.searchParams.get("file");
      if (fileParam && /\.pdf$/i.test(fileParam)) {
        const directUrl = new URL(fileParam.replace(/^\/+/, ""), BASE).toString();
        results.add(directUrl);
      } else if (/\.pdf$/i.test(resolved.pathname)) {
        results.add(resolved.toString());
      }
    } catch {
      // Ignore malformed href
    }
  }

  return [...results];
}

function parseJazzHeading(rawTitle: string): { title: string; artistOrCorps: string } {
  // Matches e.g. "Elvin Jones on Blues To Bechet" or "Philly Joe Jones - Two Bass Hit"
  const onMatch = rawTitle.match(/^([A-Z][A-Za-z.'\s-]{2,35}?)\s+on\s+(.+)$/);
  if (onMatch) {
    return {
      artistOrCorps: onMatch[1].trim(),
      title: onMatch[2].trim(),
    };
  }
  const dashParts = rawTitle.split(/\s+[–—-]\s+/);
  if (dashParts.length >= 2 && dashParts[0].length <= 36) {
    return {
      artistOrCorps: dashParts[0].trim(),
      title: dashParts.slice(1).join(" – ").trim(),
    };
  }
  return {
    title: rawTitle,
    artistOrCorps: "OnJazzDrumming",
  };
}

export const onJazzDrummingAdapter: ScraperAdapter = {
  id: "onjazzdrumming",
  name: "OnJazzDrumming",
  baseUrl: "https://www.onjazzdrumming.com",
  instrument: "Drumset",
  defaultCategory: "Jazz",
  description: "Free jazz drumset transcriptions, comping studies, and phrasing PDFs.",

  async scrape(ctx: ScraperContext) {
    const articleLinks = new Set<string>();
    let scannedPages = 0;

    for (let i = 0; i < INDEX_PAGES.length; i++) {
      if (Date.now() > ctx.deadlineMs) break;
      if (i > 0) await politeDelay(1000, 500);

      try {
        const html = await politeFetchText(INDEX_PAGES[i]);
        scannedPages++;
        const matches = html.matchAll(/href=["'](jazz-drumming\/[^"'#?]+\.html)["']/gi);
        for (const m of matches) {
          const fullUrl = new URL(decodeHtmlEntities(m[1]), BASE).toString();
          articleLinks.add(fullUrl);
        }
      } catch {
        // Continue to next index page
      }
    }

    const candidates: ScrapedSheetCandidate[] = [];
    const maxDetailPages = 14;
    let detailVisited = 0;

    for (const detailUrl of articleLinks) {
      if (detailVisited >= maxDetailPages || Date.now() > ctx.deadlineMs) break;
      await politeDelay(1100, 700);

      let detailHtml: string;
      try {
        detailHtml = await politeFetchText(detailUrl);
        detailVisited++;
        scannedPages++;
      } catch {
        continue;
      }

      const pdfUrls = extractCanonicalPdfUrls(detailHtml, detailUrl);
      if (pdfUrls.length === 0) continue;

      const h1Match =
        detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ??
        detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const rawHeading = cleanText(h1Match?.[1] ?? "").replace(/\s*[-|–]\s*onjazzdrumming.*$/i, "");
      if (!rawHeading) continue;

      const { title, artistOrCorps } = parseJazzHeading(rawHeading);

      for (const pdfUrl of pdfUrls) {
        candidates.push({
          title,
          artistOrCorps,
          instrument: "Drumset",
          category: "Jazz",
          sourceUrl: detailUrl,
          pdfUrl,
          previewImageUrl: null,
        });
      }
    }

    return {
      candidates,
      scannedPages,
      note: `Scanned ${scannedPages} pages on OnJazzDrumming and found ${candidates.length} free Jazz PDF sheets.`,
    };
  },
};
