import { BRAND_ALIASES } from "../constants";
import { compact } from "../specs";
import type { RawProduct } from "./types";

// ---------------------------------------------------------------------------
// Accessory filter: runs before any LLM call so we never pay to parse a holster.
// ---------------------------------------------------------------------------

const ALWAYS_SKIP =
  /\b(gift ?cards?|e-?gift|shipping protection|route protection|package protection|insurance|warranty extension|donation|sticker|patch|deposit|custom order fee|tips?|(mod )?services?|repairs?|closeout)\b/i;

const ACCESSORY_WORDS =
  /\b(batter(y|ies)|cells?|chargers?|charging cable|cables?|holsters?|pouch(es)?|sheaths?|diffusers?|filters?|lanyards?|clips?|tail ?caps?|o-?rings?|mounts?|adapters?|extension tubes?|tubes?|spare parts?|replacement|switch boots?|bezels?|lens(es)?|cases?|straps?|head ?bands?|keyrings?|drivers?( boards?)?|mcpcb|reflectors?|optics?|springs?|emitters?|leds? only|magnets?|rings?|gaskets?|tritium|glow (tubes?|rings?)|panels?|swag)\b/i;

/**
 * Parts and accessories that settle it even when the title also says "flashlight" ("LED Flashlight
 * Holster", "Pocket Clip for 18650 Flashlights") and even when the store files everything under a
 * flashlight product type, as JLHawaii808 does. Checked on the title minus its "with …" clause, so
 * "Flashlight with Battery Sapphire Lens Bundle" is still a light.
 */
const PART_WORDS =
  /\b(replacement|removal tools?|3d[- ]printed|holsters?|pocket clips?|lanyards?|extension (tubes?|kits?)|short tubes?|tail ?caps?|bezels?|mcpcbs?|(bare|raw|smd) (leds?|emitters?)|led emitters?|emitters? only|led drivers?|driver boards?|(re-?)?flashing kits?|programmers?|spacers?|washers?|gaskets?|buttons?|glow rings?|diffus(ers?|ing)|filters?|optics?|reflectors?|head ?bands?|head ?straps?|crystal lens(es)?|crystal len|glass lens(es)?|lens(es)? only|pills?|parts)\b/i;

/** "with battery", "w/ holster", "+ diffuser": the rest of the title after these names extras, not the product. */
const WITH_CLAUSE = /\s(with|w\/|incl(uding|udes)?)\s.*$/i;
/** "without battery", "no charger", "w/o holster" describe the light alone. */
const WITHOUT_PHRASES = /\b(without|w\/o|no)\s+(an?\s+)?(batter(y|ies)|chargers?|cells?|holsters?|cases?)\b/gi;

/** A title (or variant title) is a part or accessory by itself, whatever the store calls it. */
function isPart(title: string): boolean {
  if (/\bbundle\b/i.test(title)) return false;
  return PART_WORDS.test(title.replace(WITHOUT_PHRASES, " ").replace(WITH_CLAUSE, ""));
}

/**
 * Shopify stores often sell add-ons as variants of the light ("Green Filter" for $4.90 on a $189
 * Acebeam W20), so price and stock come from the variants that are the light itself.
 */
export function isAddonVariant(variantTitle: string): boolean {
  const t = variantTitle.replace(WITHOUT_PHRASES, " ").replace(BUNDLE_PHRASES, " ");
  return isPart(variantTitle) || (ACCESSORY_WORDS.test(t) && !LIGHT_WORDS.test(t));
}

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
  if (isPart(title)) return { keep: false, reason: "part or accessory" };

  const type = p.productType ?? "";
  if (type && LIGHT_TYPES.test(type) && !ACCESSORY_TYPES.test(type)) return { keep: true };
  if (type && ACCESSORY_TYPES.test(type) && !LIGHT_TYPES.test(type)) return { keep: false, reason: `type: ${type}` };

  const tags = p.tags.join(" ");
  const titleSansBundle = title.replace(BUNDLE_PHRASES, " ").replace(WITH_CLAUSE, "");
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

/** Title words, compacted: "Emisar D4 V2, 18650" → ["emisar", "d4", "v2", "18650"]. "+" stays ("S2+" → "s2plus"). */
function wordsOf(s: string): string[] {
  return s.split(/[^\p{L}\p{N}+]+/u).map(compact).filter(Boolean);
}

/** True when consecutive whole words of the title spell the model ("D4 V2" and "D4V2" both spell "d4v2"). */
function spellsModel(words: string[], cm: string): boolean {
  for (let i = 0; i < words.length; i++) {
    let acc = "";
    for (let j = i; j < words.length && acc.length < cm.length; j++) {
      acc += words[j];
      if (acc === cm) return true;
    }
  }
  return false;
}

const GENERIC_WORD = /^(mini|micro|nano|pro|max|plus|lite|ultra|series|edition|version|v\d+|mk\s?\w+|gen\s?\d+|i{1,3}|iv)$/i;

/** Brands and filler words are generic; so are bare numbers ("18650", "1000lm"), but not model numbers ("3X21D", "H300/H300R"). */
function isGenericToken(t: string): boolean {
  if (BRAND_KEYS.has(compact(t)) || GENERIC_WORD.test(t)) return true;
  return /\d/.test(t) ? /^\d[\d,.]*\s*(lm|lumens?|mah|k|cd|kcd|w|v|m|mm|g)?$/i.test(t) : STOP_TOKEN.test(t);
}

const BRAND_KEYS = new Set([...KNOWN_BRANDS.map(compact), ...Object.keys(BRAND_ALIASES).map(compact)]);

/** "EDC", "Tactical", "Noctigon" and the like name a whole range, not one light, so they never match on their own. */
function isGenericModel(modelName: string): boolean {
  const toks = modelName.split(/\s+/).filter(Boolean);
  return !toks.length || toks.every(isGenericToken);
}

/**
 * Match a title against known lights: same brand (when given) and the model name spelled by whole
 * words of the title, so "TAC" doesn't match "Tactical" and "X20" doesn't match "RX 2.0".
 * Longest model wins, so "TS10 V2" beats "TS10".
 */
export function matchLight(title: string, lights: LightRef[], brand?: string | null): LightRef | null {
  const words = wordsOf(title);
  const ct = words.join("");
  const cb = brand ? compact(brand) : null;
  let best: LightRef | null = null;
  let bestLen = 0;
  for (const l of lights) {
    const cm = compact(l.modelName);
    // Whole-word matching makes two-character model numbers ("K1", "T2") safe to match.
    if (cm.length < (/\d/.test(cm) ? 2 : 3) || cm.length <= bestLen || isGenericModel(l.modelName)) continue;
    const brandOk = cb ? compact(l.brand) === cb : ct.includes(compact(l.brand)) || cm.length >= 5;
    if (!brandOk || !spellsModel(words, cm)) continue;
    best = l;
    bestLen = cm.length;
  }
  return best;
}
