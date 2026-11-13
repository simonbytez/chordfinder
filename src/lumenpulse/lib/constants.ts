/**
 * Shared enum vocabularies + display labels. Imported by the DB schema, the
 * filter parser, the LLM extraction schema and the UI, so every layer agrees on
 * the exact same value sets.
 */

export const ADAPTER_TYPES = ["shopify_json", "sitemap_xml", "reddit_rss"] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

export const SOURCE_STATUSES = ["active", "paused", "error"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const RELEASE_STATUSES = ["new_release", "active", "pre_order", "restock", "discontinued"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const FORM_FACTORS = [
  "edc",
  "thrower",
  "flooder",
  "headlamp_right_angle",
  "keychain",
  "lep",
  "flat_wedge",
  "lantern",
] as const;
export type FormFactor = (typeof FORM_FACTORS)[number];

export const BATTERY_TYPES = ["18650", "21700", "14500", "18350", "10440", "aa", "aaa", "cr123a", "built_in"] as const;
export type BatteryType = (typeof BATTERY_TYPES)[number];

export const OPTIC_TYPES = ["tir", "smooth_reflector", "op_reflector", "mule", "lep"] as const;
export type OpticType = (typeof OPTIC_TYPES)[number];

export const DRIVER_TYPES = ["buck", "boost", "buck_boost", "linear_fet", "unknown"] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];
export const REGULATED_DRIVERS: DriverType[] = ["buck", "boost", "buck_boost"];

export const FIRMWARES = ["anduril_2", "zebralight_ui", "proprietary_stepped", "ramping"] as const;
export type Firmware = (typeof FIRMWARES)[number];

export const IP_RATINGS = ["IPX4", "IPX7", "IPX8", "IP68"] as const;
export type IpRating = (typeof IP_RATINGS)[number];

export const BODY_MATERIALS = ["aluminum", "titanium", "copper", "brass", "mao"] as const;
export type BodyMaterial = (typeof BODY_MATERIALS)[number];

export const COLLECTION_STATUSES = ["owned", "wishlist", "ignored"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const TRIGGER_EVENTS = ["new_release", "restock", "price_drop"] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const ALERT_CHANNELS = ["web_push", "ntfy", "discord", "email_instant", "email_digest"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const DIGEST_SCHEDULES = ["daily", "weekly_friday"] as const;
export type DigestSchedule = (typeof DIGEST_SCHEDULES)[number];

export const COMMUNITY_PLATFORMS = ["reddit_r_flashlight", "blf"] as const;
export type CommunityPlatform = (typeof COMMUNITY_PLATFORMS)[number];

export const MODES = ["fresh", "vault", "radar"] as const;
export type Mode = (typeof MODES)[number];

export const SORTS = ["newest", "name", "lumens", "throw", "price_asc", "price_desc", "year"] as const;
export type Sort = (typeof SORTS)[number];

export const CCT_MIN = 2700;
export const CCT_MAX = 6500;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  new_release: "New Release",
  active: "Available",
  pre_order: "Pre-order",
  restock: "Restocked",
  discontinued: "Discontinued",
};

export const FORM_FACTOR_LABELS: Record<FormFactor, string> = {
  edc: "EDC",
  thrower: "Thrower",
  flooder: "Flooder",
  headlamp_right_angle: "Headlamp / Right-angle",
  keychain: "Keychain",
  lep: "LEP",
  flat_wedge: "Flat / Wedge",
  lantern: "Lantern",
};

export const BATTERY_LABELS: Record<BatteryType, string> = {
  "18650": "18650",
  "21700": "21700",
  "14500": "14500",
  "18350": "18350",
  "10440": "10440",
  aa: "AA",
  aaa: "AAA",
  cr123a: "CR123A",
  built_in: "Built-in",
};

export const OPTIC_LABELS: Record<OpticType, string> = {
  tir: "TIR optic",
  smooth_reflector: "Smooth reflector",
  op_reflector: "OP reflector",
  mule: "Mule (no optic)",
  lep: "LEP",
};

export const DRIVER_LABELS: Record<DriverType, string> = {
  buck: "Buck",
  boost: "Boost",
  buck_boost: "Buck-boost",
  linear_fet: "Linear / FET",
  unknown: "Unknown",
};

export const FIRMWARE_LABELS: Record<Firmware, string> = {
  anduril_2: "Anduril 2",
  zebralight_ui: "Zebralight UI",
  proprietary_stepped: "Stepped",
  ramping: "Ramping",
};

export const MATERIAL_LABELS: Record<BodyMaterial, string> = {
  aluminum: "Aluminum",
  titanium: "Titanium",
  copper: "Copper",
  brass: "Brass",
  mao: "MAO",
};

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  new_release: "New release",
  restock: "Restock",
  price_drop: "Price drop ≥10%",
};

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  web_push: "Web Push",
  ntfy: "ntfy.sh",
  discord: "Discord",
  email_instant: "Email (instant)",
  email_digest: "Email digest",
};

export const MODE_LABELS: Record<Mode, string> = {
  fresh: "Fresh Drops",
  vault: "Deep Vault",
  radar: "Community Radar",
};

export const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest activity",
  name: "Brand A–Z",
  lumens: "Most lumens",
  throw: "Farthest throw",
  price_asc: "Price: low → high",
  price_desc: "Price: high → low",
  year: "Release year",
};

/**
 * Emitter families for the sidebar filter. Each family matches emitter_model via
 * case-insensitive LIKE patterns.
 */
export const EMITTER_FAMILIES = [
  { key: "519a", label: "Nichia 519A", patterns: ["%519A%"] },
  { key: "219", label: "Nichia 219B/C", patterns: ["%219B%", "%219C%"] },
  { key: "719a", label: "Nichia 719A", patterns: ["%719A%"] },
  { key: "e21a", label: "Nichia E21A", patterns: ["%E21A%"] },
  { key: "b35", label: "Nichia B35AM/AR", patterns: ["%B35A%"] },
  { key: "144a", label: "Nichia 144A/AR", patterns: ["%144A%"] },
  { key: "sst20", label: "Luminus SST-20", patterns: ["%SST-20%", "%SST20%"] },
  { key: "sft40", label: "Luminus SFT-40 / SST-40", patterns: ["%SFT-40%", "%SFT40%", "%SST-40%", "%SST40%"] },
  { key: "sft25r", label: "Luminus SFT-25R", patterns: ["%SFT-25R%", "%SFT25R%"] },
  { key: "sbt90", label: "Luminus SBT90.2 / SFT-70", patterns: ["%SBT90%", "%SBT-90%", "%SFT-70%", "%SFT70%"] },
  { key: "xhp", label: "Cree XHP (35/50/70)", patterns: ["%XHP%"] },
  { key: "xpl", label: "Cree XP-L / XP-L HI", patterns: ["%XP-L%", "%XPL%"] },
  { key: "lh351d", label: "Samsung LH351D", patterns: ["%LH351D%"] },
  { key: "ffl", label: "FireflyLite FFL351A/707", patterns: ["%FFL%"] },
  { key: "ntg35", label: "NTG35", patterns: ["%NTG35%"] },
  { key: "osram", label: "Osram W1/W2/CULPM1", patterns: ["%OSRAM%", "%CULPM1%", "%CSLNM1%"] },
  { key: "lep", label: "LEP module", patterns: ["%LEP%"] },
] as const;
export type EmitterFamilyKey = (typeof EMITTER_FAMILIES)[number]["key"];

/**
 * Brands the "Random Grail" picker down-weights so it surfaces lesser-known
 * enthusiast lights instead of mass-market staples.
 */
export const MAINSTREAM_BRANDS = ["olight", "fenix", "nitecore", "streamlight", "surefire", "ledlenser", "coast", "acebeam"];

export const BRAND_ALIASES: Record<string, string> = {
  fireflies: "FireflyLite",
  fireflylite: "FireflyLite",
  "fireflies flashlights": "FireflyLite",
  "fireflies outdoor": "FireflyLite",
  "firefly lite": "FireflyLite",
  "sofirn light": "Sofirn",
  sofirnlight: "Sofirn",
  "wurkkos official": "Wurkkos",
  hank: "Emisar",
  hanklights: "Emisar",
  "intl-outdoor": "Emisar",
  eskte: "Skilhunt",
  "malkoff devices": "Malkoff",
  "zebralight inc": "Zebralight",
  "olight store": "Olight",
  "acebeam flashlight": "Acebeam",
  reylight: "ReyLight",
};
