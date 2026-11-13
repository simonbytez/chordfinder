/** Minimal, dependency-free HTML helpers for product pages and feed content. */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  deg: "°",
  times: "×",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  trade: "™",
  reg: "®",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string | null | undefined, maxLen = 8000): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|table|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

export function metaContent(html: string, key: string): string | null {
  const esc = key.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${esc}["']`, "i");
  const m = html.match(re1) ?? html.match(re2);
  return m ? decodeEntities(m[1]).trim() : null;
}

export function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
}

type JsonLdProduct = {
  name?: string;
  description?: string;
  image?: unknown;
  brand?: unknown;
  offers?: unknown;
};

/** Find the first schema.org Product in any JSON-LD block (handles @graph and arrays). */
export function jsonLdProduct(html: string): JsonLdProduct | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      const obj = node as Record<string, unknown>;
      const type = obj["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product")) || type === "ProductGroup";
      if (isProduct) return obj as JsonLdProduct;
      if (obj["@graph"]) stack.push(obj["@graph"]);
    }
  }
  return null;
}

export function asImageList(image: unknown): string[] {
  if (!image) return [];
  if (typeof image === "string") return [image];
  if (Array.isArray(image)) return image.flatMap(asImageList);
  if (typeof image === "object" && image && "url" in image) return asImageList((image as { url: unknown }).url);
  return [];
}

export function brandName(brand: unknown): string | null {
  if (!brand) return null;
  if (typeof brand === "string") return brand;
  if (typeof brand === "object" && brand && "name" in brand && typeof (brand as { name: unknown }).name === "string")
    return (brand as { name: string }).name;
  return null;
}

/** Normalize JSON-LD offers → lowest price + availability. */
export function offerSummary(offers: unknown): { price: number | null; availability: string | null } {
  const list: Record<string, unknown>[] = [];
  const walk = (o: unknown) => {
    if (!o) return;
    if (Array.isArray(o)) o.forEach(walk);
    else if (typeof o === "object") {
      const obj = o as Record<string, unknown>;
      list.push(obj);
      if (obj.offers) walk(obj.offers);
    }
  };
  walk(offers);
  let price: number | null = null;
  let availability: string | null = null;
  for (const o of list) {
    const p = Number(o.price ?? o.lowPrice);
    if (Number.isFinite(p) && p > 0 && (price === null || p < price)) price = p;
    if (typeof o.availability === "string") {
      const a = o.availability.split("/").pop() ?? null;
      if (!availability || a === "InStock") availability = a;
    }
  }
  return { price, availability };
}

export function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
