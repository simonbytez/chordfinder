import { XMLParser } from "fast-xml-parser";
import type { Source } from "@lp/db/schema";
import { absoluteUrl, asImageList, brandName, jsonLdProduct, metaContent, offerSummary, stripHtml, titleTag } from "../html";
import { jitter, politeFetch } from "../http";
import type { RawProduct, SitemapEntry } from "../types";

const NON_PRODUCT_PATH =
  /\/(blogs?|news|articles?|posts?|pages?|policies|policy|contact(-us)?|contactus|about(-us)?|faq|support|warranty|cart|account|login|register|search|tags?|category|categories|collections?|brands?|compare|wishlist|checkout|privacy|terms|shipping|returns?|sitemap|feed|wp-content|wp-json|author|dealers?|distributors?|downloads?|manuals?|videos?|events?|careers?|filter)(\/|$|\?|\.)/i;
const CATEGORY_URL = /_c_\d+\.html$/i;
const FILE_URL = /\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|xml|txt)(\?|$)/i;
const PREFER_CHILD = /product|listing/i;
const SKIP_CHILD = /blog|article|post|categor|tag|page|image|author|collection|video|news|information|agentic/i;

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

function asArray<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

/**
 * Sitemap / HTML fallback adapter for non-Shopify stores.
 *  1. collectUrls(): walk sitemap.xml (and product-ish child sitemaps) → candidate product URLs
 *  2. the engine diffs them against crawl_seen_urls / vendor_listings
 *  3. fetchPage(): only for unseen (or stale) URLs → OpenGraph / JSON-LD product snapshot
 */
export class SitemapAdapter {
  constructor(private source: Source) {}

  private get origin(): string {
    return new URL(this.source.baseUrl).origin;
  }

  async collectUrls(): Promise<SitemapEntry[]> {
    const root = this.source.baseUrl.endsWith(".xml") ? this.source.baseUrl : `${this.origin}/sitemap.xml`;
    const entries: SitemapEntry[] = [];
    const visit = async (url: string, depth: number) => {
      const res = await politeFetch(url, { accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
      const xml = await res.text();
      const doc = parser.parse(xml) as {
        sitemapindex?: { sitemap?: { loc: string; lastmod?: string } | { loc: string; lastmod?: string }[] };
        urlset?: { url?: { loc: string; lastmod?: string } | { loc: string; lastmod?: string }[] };
      };
      if (doc.sitemapindex) {
        if (depth >= 2) return;
        const children = asArray(doc.sitemapindex.sitemap).map((s) => String(s.loc).trim());
        const preferred = children.filter((c) => PREFER_CHILD.test(c));
        const chosen = (preferred.length ? preferred : children.filter((c) => !SKIP_CHILD.test(c))).slice(0, 6);
        for (const child of chosen) {
          await jitter(400, 600);
          await visit(child, depth + 1);
        }
        return;
      }
      for (const u of asArray(doc.urlset?.url)) {
        const loc = String(u.loc ?? "").trim();
        if (loc) entries.push({ loc, lastmod: u.lastmod ? String(u.lastmod) : null });
      }
    };
    await visit(root, 0);

    const host = new URL(this.origin).host.replace(/^www\./, "");
    const seen = new Set<string>();
    return entries
      .filter((e) => {
        try {
          const u = new URL(e.loc);
          if (u.host.replace(/^www\./, "") !== host) return false;
          if (u.pathname === "/" || u.pathname === "") return false;
          if (NON_PRODUCT_PATH.test(u.pathname) || CATEGORY_URL.test(u.pathname) || FILE_URL.test(u.pathname)) return false;
          if (seen.has(e.loc)) return false;
          seen.add(e.loc);
          return true;
        } catch {
          return false;
        }
      })
      .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""));
  }

  /** Fetch one page; returns null when it isn't a product page. */
  async fetchPage(url: string, timeoutMs?: number): Promise<RawProduct | null> {
    const res = await politeFetch(url, { accept: "text/html,application/xhtml+xml", timeoutMs });
    const html = await res.text();
    const ld = jsonLdProduct(html);
    const ogType = metaContent(html, "og:type") ?? "";
    const metaPrice = metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount");
    const isProduct = !!ld || /product/i.test(ogType) || !!metaPrice;
    if (!isProduct) return null;

    const offer = offerSummary(ld?.offers);
    const price = offer.price ?? (metaPrice ? Number(metaPrice) || null : null);
    const metaAvail = metaContent(html, "product:availability") ?? metaContent(html, "og:availability");
    const availability = (offer.availability ?? metaAvail ?? "").toLowerCase();
    const bodyText = stripHtml(html, 12000);
    const preOrder = /preorder|pre-order/.test(availability) || /\bpre[- ]?order\b/i.test(bodyText.slice(0, 3000));
    const inStock = availability
      ? /instock|in stock|preorder|pre-order|limitedavailability|onlineonly/.test(availability)
      : !/\b(sold out|out of stock|currently unavailable)\b/i.test(bodyText.slice(0, 4000));

    const title = (ld?.name ?? metaContent(html, "og:title") ?? titleTag(html) ?? url).replace(/\s*[|–-]\s*[^|–-]+$/, "").trim();
    const description = [ld?.description, metaContent(html, "og:description"), metaContent(html, "description"), bodyText]
      .filter(Boolean)
      .join("\n")
      .slice(0, 6000);
    const images = [...asImageList(ld?.image), metaContent(html, "og:image")]
      .filter((x): x is string => !!x)
      .map((x) => absoluteUrl(x, url));

    return {
      externalId: url,
      url,
      title,
      vendor: brandName(ld?.brand) ?? metaContent(html, "og:site_name"),
      productType: null,
      tags: [],
      descriptionText: stripHtml(description, 6000),
      images: [...new Set(images)].slice(0, 6),
      variants: [],
      priceUsd: price,
      inStock,
      preOrder,
      publishedAt: null,
    };
  }
}
