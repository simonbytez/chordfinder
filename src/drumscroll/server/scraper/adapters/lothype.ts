import { inferCategory } from "../../tagger";
import { cleanText, decodeHtmlEntities, politeFetchText } from "../robots";
import type { ScrapedSheetCandidate, ScraperAdapter, ScraperContext } from "../types";

const LOTHYPE_SNARE_URL = "https://lothype.com/snare-drum-transcriptions/";
const MAX_ITEMS_PER_RUN = 120;

function normalizeSheetTitle(rawLabel: string, corpsName: string): string {
  let title = rawLabel.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (corpsName && corpsName !== "Unknown") {
    const escapedCorps = corpsName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Strip trailing or leading corps name when duplicated in the anchor text (e.g. "2009 Segment Academy")
    title = title.replace(new RegExp(`\\s*[-–—]?\\s*${escapedCorps}$`, "i"), "").trim();
  }
  return title || rawLabel.trim();
}

export const lothypeAdapter: ScraperAdapter = {
  id: "lothype",
  name: "LotHype",
  baseUrl: "https://lothype.com",
  instrument: "Snare",
  defaultCategory: "DCI",
  description: "Free DCI & WGI snare drum warmups, exercises, and show transcriptions.",

  async scrape(ctx: ScraperContext) {
    const html = await politeFetchText(LOTHYPE_SNARE_URL);
    const byCorps = new Map<string, ScrapedSheetCandidate[]>();

    // LotHype groups snare sheets into <div class="su-spoiler"> blocks per corps/ensemble
    const spoilerRegex =
      /<div[^>]*class=["'][^"']*su-spoiler-title[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*su-spoiler-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

    let match: RegExpExecArray | null;
    while ((match = spoilerRegex.exec(html)) !== null) {
      const corpsName = cleanText(match[1]) || "Marching Percussion";
      const contentHtml = match[2];

      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(contentHtml)) !== null) {
        const rawHref = decodeHtmlEntities(linkMatch[1]).trim();
        if (!/\.pdf(?:$|\?)/i.test(rawHref) && !rawHref.includes("drive.google.com")) {
          continue;
        }

        let pdfUrl: string;
        try {
          pdfUrl = new URL(rawHref, LOTHYPE_SNARE_URL).toString();
        } catch {
          continue;
        }

        const rawLabel = cleanText(linkMatch[2]);
        if (!rawLabel) continue;

        const title = normalizeSheetTitle(rawLabel, corpsName);
        const category = inferCategory(`${title} ${corpsName}`, "Snare", "DCI");

        const list = byCorps.get(corpsName) ?? [];
        list.push({
          title,
          artistOrCorps: corpsName,
          instrument: "Snare",
          category,
          sourceUrl: LOTHYPE_SNARE_URL,
          pdfUrl,
        });
        byCorps.set(corpsName, list);
      }
    }

    // Round-robin across corps, prioritizing unseen PDFs so a single run covers diverse World/Open/WGI lines
    const unseenBuckets: ScrapedSheetCandidate[][] = [];
    const seenBuckets: ScrapedSheetCandidate[][] = [];
    for (const items of byCorps.values()) {
      const unseen = items.filter((c) => !ctx.existingPdfUrls.has(c.pdfUrl));
      const seen = items.filter((c) => ctx.existingPdfUrls.has(c.pdfUrl));
      if (unseen.length > 0) unseenBuckets.push(unseen);
      if (seen.length > 0) seenBuckets.push(seen);
    }

    const selected: ScrapedSheetCandidate[] = [];
    const takeRoundRobin = (buckets: ScrapedSheetCandidate[][]) => {
      let idx = 0;
      let addedInPass = true;
      while (selected.length < MAX_ITEMS_PER_RUN && addedInPass) {
        addedInPass = false;
        for (const bucket of buckets) {
          if (idx < bucket.length && selected.length < MAX_ITEMS_PER_RUN) {
            selected.push(bucket[idx]);
            addedInPass = true;
          }
        }
        idx++;
      }
    };

    takeRoundRobin(unseenBuckets);
    if (selected.length === 0) {
      takeRoundRobin(seenBuckets);
    }

    const totalAvailable = [...byCorps.values()].reduce((acc, arr) => acc + arr.length, 0);
    return {
      candidates: selected,
      scannedPages: 1,
      note: `Found ${totalAvailable} snare PDFs across ${byCorps.size} ensembles on LotHype (processed batch of ${selected.length}).`,
    };
  },
};
