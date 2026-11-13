import { BRAND_ALIASES } from "../constants";
import { compact } from "../specs";
import type { RawProduct } from "./types";

// ---------------------------------------------------------------------------
// Accessory filter: runs before any LLM call so we never pay to parse a holster.
// ---------------------------------------------------------------------------

const ALWAYS_SKIP = /\b(gift ?cards?|e-?gift|shipping protection|route protection|package protection|insurance|warranty extension|donation|sticker|patch|deposit|custom order fee|tips?)\b/i;

const ACCESSORY_WORDS =
  /\b(batter(y|ies)|cells?|chargers?|charging cable|cables?|holsters?|pouch(es)?|sheaths?|diffusers?|filters?|lanyards?|clips?|tail ?caps?|o-?rings?|mounts?|adapters?|extension tubes?|tubes?|spare parts?|replacement|switch boots?|bezels?|lens(es)?|cases?|straps?|head ?bands?|keyrings?|drivers? (board)?|mcpcb|reflectors?|optics?|springs?|emitters?|leds? only|magnets?|rings?|gaskets?|tritium|glow (tubes?|rings?)|swag)\b/i;

const LIGHT_WORDS = /\b(flashlights?|torch(es)?|head ?lamps?|lanterns?|searchlights?|spotlights?|penlights?|thrower|edc light|keychain light|lights?)\b/i;

/** "...with 18650 battery", "w/ charger", "+ battery" describe a bundle, not an accessory. */
const BUNDLE_PHRASES = /\b(with|w\/|incl(uding|uded|udes)?|plus|\+)\s*(an?\s+|the\s+|2\s*x?\s*|\d{5}\s*)?(batter(y|ies)|chargers?|holsters?|cells?|diffusers?|lanyards?|cases?)\b/gi;

const ACCESSORY_TYPES = /\b(accessor(y|ies)|batter(y|ies)|chargers?|holsters?|parts?|gift|merch|apparel|knives?|tools?)\b/i;
const LIGHT_TYPES = /\b(flashlights?|torch|headlamps?|lanterns?|lights?|edc)\b/i;

/** Bare cells: "Sanyo NCR18650GA", "21700 5000mAh flat top", "Molicel P45B". */
const CELL_TITLE = /\b(ncr|inr|imr|icr|nca)\s?\d{5}\w*|\b\d{3,5}\s*mah\b|\b(flat|button)[- ]top\b|\bmolicel\b|\bsamsung\s+\d{2}[a-z]\b|\b(protected|unprotected)\s+(\d{5}\s+)?(cell|battery)\b/i;
const LUMEN_IN_TITLE = /\b\d[\d,.]*\s*(lm|lumens?)\b/i;

export function classifyProduct(p: RawProduct): { keep: boolean; reason?: string } {
  const title = p.title;
  if (ALWAYS_SKIP.test(title)) return { keep: false, reason: "non-product" };
  if (p.priceUsd !== null && p.priceUsd < 3) return { keep: false, reason: "price < $3" };
  if (CELL_TITLE.test(title) && !LUMEN_IN_TITLE.test(title)) return { keep: false, reason: "battery cell" };

  const type = p.productType ?? "";
  if (type && LIGHT_TYPES.test(type) && !ACCESSORY_TYPES.test(type)) return { keep: true };
  if (type && ACCESSORY_TYPES.test(type) && !LIGHT_TYPES.test(type)) return { keep: false, reason: `type: ${type}` };

  const tags = p.tags.join(" ");
  const titleSansBundle = title.replace(BUNDLE_PHRASES, " ");
  const accessoryHit = ACCESSORY_WORDS.test(titleSansBundle);
  const lightHit = LIGHT_WORDS.test(titleSansBundle);
  if (accessoryHit && !lightHit) return { keep: false, reason: "accessory keywords" };
  if (!lightHit && /\baccessor(y|ies)\b/i.test(tags) && !/\bflashlights?\b/i.test(tags)) return { keep: false, reason: "accessory tag" };
  return { keep: true };
}

// ---------------------------------------------------------------------------
// Brand + model normalization and matching
// ---------------------------------------------------------------------------

const KNOWN_BRANDS = [
  "Emisar", "Noctigon", "Wurkkos", "Sofirn", "Acebeam", "FireflyLite", "Olight", "Zebralight", "Convoy", "Malkoff",
  "Lumintop", "Skilhunt", "Fenix", "Armytek", "Nitecore", "Weltool", "ReyLight", "Haikelite", "Mateminco", "Thrunite",
  "Klarus", "Imalent", "Nightwatch", "Astrolux", "Jetbeam", "Manker", "Rovyvon", "Wuben", "Nextorch", "Streamlight",
  "Surefire", "Modlite", "Cloud Defensive", "Vastlite", "Loop Gear", "Folomov", "Eagtac", "Prometheus", "Speras",
  "Lupine", "Mecarmy", "Maratac", "Mankerlight", "Trustfire", "Nitefighter",
];

export function normalizeBrand(raw: string | null | undefined, fallback: string): string {
  const cleaned = (raw ?? "")
    .replace(/\b(official|store|shop|flashlights?|light(s|ing)?|outdoor|inc|llc|co|ltd|corp|us|usa|eu|uk|global|international|direct)\b\.?/gi, " ")
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const key = cleaned.toLowerCase();
  if (!key) return fallback;
  if (BRAND_ALIASES[key]) return BRAND_ALIASES[key];
  const known = KNOWN_BRANDS.find((b) => b.toLowerCase() === key);
  if (known) return known;
  // Title-case shouty vendor names ("SOFIRN" → "Sofirn") but keep mixed-case brands.
  return cleaned === cleaned.toUpperCase() && cleaned.length > 3 ? cleaned[0] + cleaned.slice(1).toLowerCase() : cleaned;
}

/** If the title starts with a known brand, prefer it (multi-brand stores often set vendor = store name). */
export function brandFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) if (lower.startsWith(alias + " ")) return canonical;
  const hit = KNOWN_BRANDS.find((b) => lower.startsWith(b.toLowerCase() + " "));
  return hit ?? null;
}

const STOP_TOKEN =
  /^(\d[\d,.]*\s*(lm|lumens?|m|meters?|metres?|mah|k|cd|kcd|w|v|nm|g|mm)|\d{3,}|18650|21700|14500|18350|10440|16340|aaa?|cr123a?|(xhp|sst|sft|sbt|xp-?l|lh351|519a|219[bc]|e21a|ffl)\S*|nichia|cree|luminus|osram|samsung|lumens?|lm|flashlights?|torch(es)?|headlamps?|lanterns?|penlights?|rechargeable|edc|led|leds|usb|usb-c|type-c|with|w\/|for|tactical|powerful|super|bright|brightest|high|pocket|keychain|cri|compact|thrower|flood|floody|searchlight|light|lights|new|limited|edition|kit|set|bundle|by|and|magnetic|magnet|clip-on|clip|waterproof|zoomable|dual|triple|quad|uv|outdoor|camping|hiking|emergency|work|inspection|professional|3-in-1|2-in-1|black|grey|gray|metal|silver|gold|red|blue|green|od|olive|tan|desert|sand|orange|purple|pink|white|navy|camo|copper|brass|titanium|aluminum|aluminium|damascus|zirconium|stainless|bronze|small|large|\d+\s*[x×*]\S*|gt-?fc40|fc-?40|&|-|–|—|\||,|\/|:|\(|\)|\S*\/\S*)$/i;

/** "Wurkkos FC11C 1200lm USB-C Flashlight" → "FC11C"; "Emisar D4V2" → "D4V2". */
export function deriveModelName(title: string, brand: string): string {
  let t = title.replace(/\[[^\]]*\]|【[^】]*】/g, " ").replace(/\s+/g, " ").trim();
  const brandRe = new RegExp(`^(${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${Object.keys(BRAND_ALIASES).join("|")})\\b[\\s:-]*`, "i");
  t = t.replace(brandRe, "");
  t = t.split(/\s[-–—|]\s|,\s|\s\(/)[0];
  const out: string[] = [];
  const brandTok = brand.toLowerCase();
  for (const tok of t.split(/\s+/)) {
    const bare = tok.toLowerCase().replace(/['’]s$/, "");
    if (STOP_TOKEN.test(tok) || bare === brandTok) {
      if (out.length) break;
      continue;
    }
    out.push(tok.replace(/[,;:]+$/, ""));
    if (out.length >= 4) break;
  }
  return out.join(" ").trim() || t.split(/\s+/)[0] || title.slice(0, 40);
}

export type LightRef = { id: string; brand: string; modelName: string };

/**
 * Match a title against known lights: same brand (when given) and the compacted
 * model name appears in the compacted title. Longest model wins, so "TS10 V2"
 * beats "TS10".
 */
export function matchLight(title: string, lights: LightRef[], brand?: string | null): LightRef | null {
  const ct = compact(title);
  const cb = brand ? compact(brand) : null;
  let best: LightRef | null = null;
  let bestLen = 0;
  for (const l of lights) {
    const cm = compact(l.modelName);
    if (cm.length < 3) continue;
    const brandOk = cb ? compact(l.brand) === cb : ct.includes(compact(l.brand)) || cm.length >= 5;
    if (!brandOk) continue;
    const idx = ct.indexOf(cm);
    if (idx === -1) continue;
    // Avoid "ts10" matching inside "ts1000": the next char must not continue the model token.
    const next = ct[idx + cm.length];
    const prevChar = ct[idx - 1];
    if (next && /[0-9]/.test(cm.at(-1)!) && /[0-9]/.test(next)) continue;
    if (prevChar && /[0-9]/.test(cm[0]) && /[0-9]/.test(prevChar)) continue;
    if (cm.length > bestLen) {
      best = l;
      bestLen = cm.length;
    }
  }
  return best;
}
