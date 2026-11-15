import { extractGoogleDriveFileId, resolveDriveThumbnailUrl } from "../../../lib/constants";
import { inferCategory } from "../../tagger";
import { cleanText, decodeHtmlEntities, politeFetchText } from "../robots";
import type { ScrapedSheetCandidate, ScraperAdapter } from "../types";

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        url?: string;
        permalink?: string;
        selftext?: string;
        link_flair_text?: string;
      };
    }>;
  };
}

const NON_SNARE_RE = /\b(?:quads?|tenors?|bass(?:es)?|marimba|vibes|vibraphone|xylophone|cymbals?|flubs?)\b/i;

function parseRedditPostTitle(raw: string): { title: string; artistOrCorps: string } {
  const cleaned = raw.replace(/\[(?:snare|transcribed|request|full\s+battery)\]/gi, "").trim();
  // Common r/DrumlineSheets format: "2023 Blue Devils - The Cut-Outs Opener (Snare)" or "Blue Devils 2023 Opener"
  const dashSplit = cleaned.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    const left = dashSplit[0].replace(/^\d{4}\s+/, "").trim();
    const yearPrefix = dashSplit[0].match(/^(\d{4})\b/)?.[1];
    const right = dashSplit.slice(1).join(" – ").replace(/\s*\(snare\)\s*$/i, "").trim();
    if (left && right) {
      return {
        artistOrCorps: left,
        title: yearPrefix ? `${yearPrefix} ${right}` : right,
      };
    }
  }
  return {
    title: cleaned,
    artistOrCorps: "r/DrumlineSheets",
  };
}

export const drumlineSheetsAdapter: ScraperAdapter = {
  id: "drumlinesheets",
  name: "r/DrumlineSheets",
  baseUrl: "https://www.reddit.com/r/DrumlineSheets",
  instrument: "Snare",
  defaultCategory: "DCI",
  description: "Community-curated DCI, WGI, and rudimental marching snare transcriptions.",

  async scrape() {
    const feedUrl = "https://www.reddit.com/r/DrumlineSheets/new.json?limit=50";
    const raw = await politeFetchText(feedUrl, { accept: "application/json" });
    const parsed = JSON.parse(raw) as RedditListing;
    const children = parsed.data?.children ?? [];

    const candidates: ScrapedSheetCandidate[] = [];
    for (const child of children) {
      const post = child.data;
      if (!post?.title) continue;

      const fullText = `${post.title} ${post.link_flair_text ?? ""}`;
      if (NON_SNARE_RE.test(fullText) && !/\bsnare\b/i.test(fullText)) {
        continue;
      }

      const candidateUrls = [post.url ?? ""];
      if (post.selftext) {
        for (const m of post.selftext.matchAll(/https?:\/\/[^\s)"'<>]+/gi)) {
          candidateUrls.push(decodeHtmlEntities(m[0]));
        }
      }

      const sheetUrl = candidateUrls.find(
        (u) => /\.pdf(?:$|\?)/i.test(u) || extractGoogleDriveFileId(u) !== null,
      );
      if (!sheetUrl) continue;

      const rawTitle = cleanText(post.title);
      const { title, artistOrCorps } = parseRedditPostTitle(rawTitle);
      const category = inferCategory(`${title} ${artistOrCorps}`, "Snare", "DCI");
      const sourceUrl = post.permalink
        ? `https://www.reddit.com${post.permalink}`
        : "https://www.reddit.com/r/DrumlineSheets/";

      candidates.push({
        title,
        artistOrCorps,
        instrument: "Snare",
        category,
        sourceUrl,
        pdfUrl: sheetUrl,
        previewImageUrl: resolveDriveThumbnailUrl(sheetUrl),
      });
    }

    return {
      candidates,
      scannedPages: 1,
      note: `Scanned ${children.length} recent posts from r/DrumlineSheets and matched ${candidates.length} snare sheets.`,
    };
  },
};
