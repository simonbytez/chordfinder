import { XMLParser } from "fast-xml-parser";
import type { Source } from "@lp/db/schema";
import type { CommunityPlatform } from "../../constants";
import { stripHtml } from "../html";
import { HttpError, jitter, politeFetch } from "../http";
import type { RawMention } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
});

const RELEASE_KEYWORDS =
  /\b(new release|newly released|just released|released|announc\w*|launch\w*|pre-?orders?|now available|available now|restock\w*|back in stock|coming soon|sneak peek|teaser|first look|NLD|new light day|PSA|new model)\b/i;

type AtomEntry = {
  title?: unknown;
  link?: { "@_href"?: string } | { "@_href"?: string }[];
  updated?: string;
  published?: string;
  author?: { name?: string };
  content?: unknown;
  category?: { "@_term"?: string; "@_label"?: string } | { "@_term"?: string; "@_label"?: string }[];
};
type RssItem = {
  title?: unknown;
  link?: string;
  pubDate?: string;
  creator?: string;
  description?: unknown;
  category?: unknown;
};

const text = (v: unknown): string =>
  typeof v === "string" ? v : v && typeof v === "object" && "#text" in v ? String((v as { "#text": unknown })["#text"]) : "";

function asArray<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

export function deriveFlair(title: string): string | null {
  if (/\bPSA\b/.test(title)) return "PSA";
  if (/\bpre-?orders?\b/i.test(title)) return "Pre-order";
  if (/\b(restock\w*|back in stock)\b/i.test(title)) return "Restock";
  if (/\b(NLD|new light day)\b/i.test(title)) return "NLD";
  if (RELEASE_KEYWORDS.test(title)) return "Release buzz";
  return null;
}

/**
 * Community buzz adapter. For a subreddit base URL it reads two feeds:
 *  - flair search (flair_name:"New Release") → every post carries that flair
 *  - /new.rss → kept only when the title matches release/PSA keywords
 * Any other base URL is treated as a generic RSS/Atom feed (e.g. BLF latest.rss).
 */
export class RedditRssAdapter {
  constructor(private source: Source) {}

  get platform(): CommunityPlatform {
    return /budgetlightforum\.com/i.test(this.source.baseUrl) ? "blf" : "reddit_r_flashlight";
  }

  async fetchMentions(): Promise<RawMention[]> {
    const base = this.source.baseUrl.replace(/\/+$/, "");
    const isSubreddit = /reddit\.com\/r\/[^/]+$/i.test(base);
    const feeds: { url: string; flair: string | null }[] = isSubreddit
      ? [
          { url: `${base}/new.rss?limit=100`, flair: null },
          { url: `${base}/search.rss?q=${encodeURIComponent('flair_name:"New Release"')}&restrict_sr=1&sort=new&limit=50`, flair: "New Release" },
        ]
      : [{ url: base, flair: null }];

    const out = new Map<string, RawMention>();
    const errors: string[] = [];
    for (const [i, feed] of feeds.entries()) {
      if (i > 0) await jitter(1500, 1500);
      try {
        const res = await politeFetch(feed.url, { accept: "application/atom+xml,application/rss+xml,application/xml;q=0.9" });
        const xml = await res.text();
        for (const m of this.parse(xml, feed.flair)) if (!out.has(m.url)) out.set(m.url, m);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        // Rate limited: stop here instead of hitting the next feed.
        if (err instanceof HttpError && err.status === 429) break;
      }
    }
    // One blocked feed (Reddit sometimes refuses search.rss) shouldn't sink the run.
    if (out.size === 0 && errors.length) throw new Error(errors.join(" | "));
    return [...out.values()];
  }

  private parse(xml: string, forcedFlair: string | null): RawMention[] {
    const doc = parser.parse(xml) as { feed?: { entry?: AtomEntry | AtomEntry[] }; rss?: { channel?: { item?: RssItem | RssItem[] } } };
    const results: RawMention[] = [];

    for (const e of asArray(doc.feed?.entry)) {
      const title = stripHtml(text(e.title), 300);
      const link = asArray(e.link).find((l) => l["@_href"])?.["@_href"];
      if (!title || !link) continue;
      const flair = forcedFlair ?? deriveFlair(title);
      if (!flair) continue;
      const excerpt = stripHtml(text(e.content), 600)
        .replace(/submitted by\s+\/u\/\S+[\s\S]*$/i, "")
        .replace(/\[link\]|\[comments\]/g, "")
        .trim()
        .slice(0, 280);
      results.push({
        title,
        url: link,
        platform: this.platform,
        flair,
        author: e.author?.name?.replace(/^\/u\//, "u/") ?? null,
        excerpt: excerpt || null,
        publishedAt: new Date(e.published ?? e.updated ?? Date.now()),
      });
    }

    for (const it of asArray(doc.rss?.channel?.item)) {
      const title = stripHtml(text(it.title), 300);
      const link = typeof it.link === "string" ? it.link.trim() : "";
      if (!title || !link) continue;
      const categories = asArray(it.category as unknown).map(text).join(" ");
      const categoryFlair = /new|release|announce|product/i.test(categories) ? categories.split(/\s{2,}|,/)[0].trim() : null;
      const flair = forcedFlair ?? (RELEASE_KEYWORDS.test(title) ? deriveFlair(title) : categoryFlair);
      if (!flair) continue;
      results.push({
        title,
        url: link,
        platform: this.platform,
        flair,
        author: it.creator ?? null,
        excerpt: stripHtml(text(it.description), 400).slice(0, 280) || null,
        publishedAt: new Date(it.pubDate ?? Date.now()),
      });
    }
    return results;
  }
}
