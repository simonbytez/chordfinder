import { inferCategory } from "../../tagger";
import { cleanText, decodeHtmlEntities, politeDelay, politeFetchText } from "../robots";
import type { ScrapedSheetCandidate, ScraperAdapter, ScraperContext } from "../types";

interface WpPost {
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
}

const EXERCISE_PREFIX_RE =
  /^(?:snare|bass|rhythmic|drum|linear|coordination|groove|hi-hat|paradiddle|triplet|polyrhythm|odd\s+time|rudiment|warm|stick)/i;

function splitArtistAndTitle(rawTitle: string): { title: string; artistOrCorps: string } {
  const cleaned = rawTitle
    .replace(/\s*\((?:free\s+)?(?:drum\s+)?(?:pdf|sheet\s+music|transcription[^)]*)\)\s*/gi, "")
    .replace(/\s*[-–—]\s*drum\s+transcription\s*$/i, "")
    .trim();

  const dashParts = cleaned.split(/\s+[–—-]\s+/);
  if (dashParts.length >= 2) {
    const left = dashParts[0].trim();
    const right = dashParts.slice(1).join(" – ").trim();
    if (left && right && !EXERCISE_PREFIX_RE.test(left) && left.length <= 48) {
      return {
        artistOrCorps: left,
        title: right,
      };
    }
  }

  return {
    title: cleaned || rawTitle,
    artistOrCorps: "Francis' Drumming Blog",
  };
}

export const francisAdapter: ScraperAdapter = {
  id: "francis",
  name: "Francis' Drumming Blog",
  baseUrl: "https://francisdrummingblog.com",
  instrument: "Drumset",
  defaultCategory: "Rock/Funk",
  description: "Free funk, rock, fusion, and jazz drumset grooves & full chart PDFs.",

  async scrape(ctx: ScraperContext) {
    const candidates: ScrapedSheetCandidate[] = [];
    const seenPdfs = new Set<string>();
    let scannedPages = 0;
    const maxPages = 4;

    for (let page = 1; page <= maxPages; page++) {
      if (Date.now() > ctx.deadlineMs) break;
      if (page > 1) await politeDelay(1200, 700);

      const apiUrl = `https://francisdrummingblog.com/wp-json/wp/v2/posts?per_page=25&page=${page}&_fields=link,title,content`;
      let posts: WpPost[];
      try {
        const raw = await politeFetchText(apiUrl, { accept: "application/json" });
        posts = JSON.parse(raw) as WpPost[];
      } catch {
        break;
      }

      if (!Array.isArray(posts) || posts.length === 0) break;
      scannedPages++;

      for (const post of posts) {
        const postTitle = cleanText(post.title?.rendered ?? "");
        const contentHtml = post.content?.rendered ?? "";
        const sourceUrl = post.link || "https://francisdrummingblog.com";
        if (!postTitle || !contentHtml) continue;

        const pdfMatches = [
          ...contentHtml.matchAll(/href=["'](https?:\/\/[^"'\s<>]+\.pdf(?:\?[^"'\s<>]*)?)["']/gi),
        ].map((m) => decodeHtmlEntities(m[1]));

        const uniquePostPdfs = [...new Set(pdfMatches)];
        if (uniquePostPdfs.length === 0) continue;

        const { title, artistOrCorps } = splitArtistAndTitle(postTitle);

        for (let i = 0; i < uniquePostPdfs.length; i++) {
          const pdfUrl = uniquePostPdfs[i];
          if (seenPdfs.has(pdfUrl)) continue;
          seenPdfs.add(pdfUrl);

          const itemTitle =
            uniquePostPdfs.length === 1
              ? title
              : `${title} (${
                  decodeURIComponent(pdfUrl.split("/").pop()?.replace(/\.pdf.*$/i, "") ?? `Part ${i + 1}`).replace(
                    /[-_]+/g,
                    " ",
                  )
                })`;

          const category = inferCategory(`${itemTitle} ${artistOrCorps}`, "Drumset", "Rock/Funk");

          candidates.push({
            title: itemTitle,
            artistOrCorps,
            instrument: "Drumset",
            category,
            sourceUrl,
            pdfUrl,
            // Leave previewImageUrl unset so SheetThumbnail renders crisp Page 1 .webp from the PDF itself
            previewImageUrl: null,
          });
        }
      }
    }

    return {
      candidates,
      scannedPages,
      note: `Scanned ${scannedPages} post pages on Francis' Drumming Blog and extracted ${candidates.length} free PDF sheets.`,
    };
  },
};
