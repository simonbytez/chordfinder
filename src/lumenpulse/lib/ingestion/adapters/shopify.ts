import type { Source } from "@lp/db/schema";
import { stripHtml } from "../html";
import { HttpError, jitter, politeFetch } from "../http";
import type { RawProduct } from "../types";

type ShopifyVariant = {
  id: number;
  title: string;
  price: string | number | null;
  available?: boolean;
  compare_at_price?: string | number | null;
};

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[] | string;
  published_at: string | null;
  variants: ShopifyVariant[];
  images: { src: string }[];
};

const MAX_PAGES = Number(process.env.LUMENPULSE_SHOPIFY_MAX_PAGES ?? 4);

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Shopify storefront adapter: GET {base}/products.json?limit=250&page=N.
 * The endpoint returns newest-published first, so a small page cap still sees
 * every new release. Pages are fetched sequentially with jittered pauses.
 */
export class ShopifyAdapter {
  constructor(private source: Source) {}

  async fetchProducts(): Promise<RawProduct[]> {
    const base = this.source.baseUrl.replace(/\/+$/, "");
    const out: RawProduct[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${base}/products.json?limit=250&page=${page}`;
      const res = await politeFetch(url, { accept: "application/json" });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        await res.body?.cancel();
        throw new HttpError(res.status, url, `${url} did not return JSON; this store is probably not a public Shopify storefront. Switch the source to sitemap_xml.`);
      }
      const data = (await res.json()) as { products?: ShopifyProduct[] };
      const list = data.products ?? [];
      for (const p of list) out.push(this.toRaw(p, base));
      if (list.length < 250) break;
      await jitter(1200, 1800);
    }
    return out;
  }

  private toRaw(p: ShopifyProduct, base: string): RawProduct {
    const variants = (p.variants ?? []).map((v) => ({
      id: String(v.id),
      title: v.title ?? "",
      price: toNum(v.price),
      available: v.available !== false,
      compareAtPrice: toNum(v.compare_at_price),
    }));
    const available = variants.filter((v) => v.available && v.price !== null);
    const priced = variants.filter((v) => v.price !== null);
    const pool = available.length ? available : priced;
    const priceUsd = pool.length ? Math.min(...pool.map((v) => v.price!)) : null;
    const tags = Array.isArray(p.tags)
      ? p.tags
      : String(p.tags ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
    const preOrder = /\bpre[- ]?order\b/i.test(`${p.title} ${tags.join(" ")}`);
    return {
      externalId: String(p.id),
      url: `${base}/products/${p.handle}`,
      title: p.title.trim(),
      vendor: p.vendor,
      productType: p.product_type || null,
      tags,
      descriptionText: stripHtml(p.body_html, 6000),
      images: (p.images ?? []).map((i) => i.src).slice(0, 6),
      variants,
      priceUsd,
      inStock: available.length > 0,
      preOrder,
      publishedAt: p.published_at,
    };
  }
}
