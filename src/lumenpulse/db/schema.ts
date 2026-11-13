import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ADAPTER_TYPES,
  ALERT_CHANNELS,
  BATTERY_TYPES,
  BODY_MATERIALS,
  COLLECTION_STATUSES,
  COMMUNITY_PLATFORMS,
  DIGEST_SCHEDULES,
  DRIVER_TYPES,
  FIRMWARES,
  FORM_FACTORS,
  IP_RATINGS,
  OPTIC_TYPES,
  RELEASE_STATUSES,
  SOURCE_STATUSES,
  TRIGGER_EVENTS,
} from "../lib/constants"; // relative on purpose: drizzle-kit doesn't resolve tsconfig path aliases

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const adapterTypeEnum = pgEnum("adapter_type", ADAPTER_TYPES);
export const sourceStatusEnum = pgEnum("source_status", SOURCE_STATUSES);
export const releaseStatusEnum = pgEnum("release_status", RELEASE_STATUSES);
export const formFactorEnum = pgEnum("form_factor", FORM_FACTORS);
export const batteryTypeEnum = pgEnum("battery_type", BATTERY_TYPES);
export const opticTypeEnum = pgEnum("optic_type", OPTIC_TYPES);
export const driverTypeEnum = pgEnum("driver_type", DRIVER_TYPES);
export const firmwareEnum = pgEnum("firmware", FIRMWARES);
export const ipRatingEnum = pgEnum("ip_rating", IP_RATINGS);
export const bodyMaterialEnum = pgEnum("body_material", BODY_MATERIALS);
export const collectionStatusEnum = pgEnum("collection_status", COLLECTION_STATUSES);
export const triggerEventEnum = pgEnum("trigger_event", TRIGGER_EVENTS);
export const alertChannelEnum = pgEnum("alert_channel", ALERT_CHANNELS);
export const digestScheduleEnum = pgEnum("digest_schedule", DIGEST_SCHEDULES);
export const communityPlatformEnum = pgEnum("community_platform", COMMUNITY_PLATFORMS);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export type PricePoint = { t: string; p: number | null; s: boolean };
export type RunStats = {
  fetched: number;
  candidates: number;
  skippedAccessories: number;
  newLights: number;
  newListings: number;
  updatedListings: number;
  events: number;
  llmExtractions: number;
  durationMs: number;
  bootstrap: boolean;
};
export type DeliveryResult = { channel: string; ok: boolean; detail: string };

// ---------------------------------------------------------------------------
// Users (anonymous device identity, cookie `lp_uid`)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Ingestion sources
// ---------------------------------------------------------------------------

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    adapterType: adapterTypeEnum("adapter_type").notNull(),
    pollIntervalMins: integer("poll_interval_mins").notNull().default(60),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    status: sourceStatusEnum("status").notNull().default("active"),
    errorLog: text("error_log"),
    lastRunStats: jsonb("last_run_stats").$type<RunStats>(),
    createdAt: createdAt(),
  },
  (t) => [index("sources_adapter_idx").on(t.adapterType)],
);

/**
 * URLs the sitemap adapter has already inspected (product or not), so each run
 * only fetches pages it has never seen.
 */
export const crawlSeenUrls = pgTable(
  "crawl_seen_urls",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    isProduct: boolean("is_product").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.url] })],
);

// ---------------------------------------------------------------------------
// Flashlights
// ---------------------------------------------------------------------------

export const flashlights = pgTable(
  "flashlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    brand: text("brand").notNull(),
    modelName: text("model_name").notNull(),
    releaseStatus: releaseStatusEnum("release_status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    releaseYear: integer("release_year"),
    imageUrls: text("image_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rawDescription: text("raw_description"),

    formFactor: formFactorEnum("form_factor"),
    batteryTypes: batteryTypeEnum("battery_types")
      .array()
      .notNull()
      .default(sql`'{}'::battery_type[]`),
    maxLumens: integer("max_lumens"),
    maxCandela: integer("max_candela"),
    throwMeters: integer("throw_meters"),
    opticType: opticTypeEnum("optic_type"),
    driverType: driverTypeEnum("driver_type").notNull().default("unknown"),
    firmware: firmwareEnum("firmware"),
    ipRating: ipRatingEnum("ip_rating"),
    bodyMaterials: bodyMaterialEnum("body_materials")
      .array()
      .notNull()
      .default(sql`'{}'::body_material[]`),
    hasUsbC: boolean("has_usb_c").notNull().default(false),
    hasMagneticTail: boolean("has_magnetic_tail").notNull().default(false),
    hasAuxLeds: boolean("has_aux_leds").notNull().default(false),
    hasHighCriOption: boolean("has_high_cri_option").notNull().default(false),
    weightGrams: integer("weight_grams"),
    lengthMm: numeric("length_mm", { precision: 6, scale: 1, mode: "number" }),

    /** Where the spec sheet came from: seed | llm | regex | manual */
    specSource: text("spec_source").notNull().default("seed"),
    /** Free-text caveats, e.g. "Lumens are the maker's claim; reviewers measured ~1100 lm". */
    specNotes: text("spec_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("flashlights_slug_uq").on(t.slug),
    index("flashlights_brand_idx").on(t.brand),
    index("flashlights_status_idx").on(t.releaseStatus),
    index("flashlights_last_event_idx").on(t.lastEventAt),
    index("flashlights_first_seen_idx").on(t.firstSeenAt),
    index("flashlights_lumens_idx").on(t.maxLumens),
    index("flashlights_throw_idx").on(t.throwMeters),
    index("flashlights_battery_gin").using("gin", t.batteryTypes),
  ],
);

export const flashlightEmitters = pgTable(
  "flashlight_emitters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flashlightId: uuid("flashlight_id")
      .notNull()
      .references(() => flashlights.id, { onDelete: "cascade" }),
    emitterModel: text("emitter_model").notNull(),
    ledCount: integer("led_count").notNull().default(1),
    cctKelvin: integer("cct_kelvin"),
    cri: integer("cri"),
    tintDuvNotes: text("tint_duv_notes"),
  },
  (t) => [
    index("emitters_flashlight_idx").on(t.flashlightId),
    index("emitters_cct_idx").on(t.cctKelvin),
    index("emitters_cri_idx").on(t.cri),
  ],
);

// ---------------------------------------------------------------------------
// Vendor listings
// ---------------------------------------------------------------------------

export const vendorListings = pgTable(
  "vendor_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flashlightId: uuid("flashlight_id")
      .notNull()
      .references(() => flashlights.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalProductId: text("external_product_id").notNull(),
    productUrl: text("product_url").notNull(),
    title: text("title"),
    priceUsd: numeric("price_usd", { precision: 10, scale: 2, mode: "number" }),
    inStock: boolean("in_stock").notNull().default(false),
    /** null = never verified by a crawler (seed estimate / manual entry). */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    priceHistoryJson: jsonb("price_history_json")
      .$type<PricePoint[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("listings_source_external_uq").on(t.sourceId, t.externalProductId),
    index("listings_flashlight_idx").on(t.flashlightId),
    index("listings_url_idx").on(t.productUrl),
    index("listings_price_idx").on(t.priceUsd),
  ],
);

// ---------------------------------------------------------------------------
// Community radar
// ---------------------------------------------------------------------------

export const communityMentions = pgTable(
  "community_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceTitle: text("source_title").notNull(),
    url: text("url").notNull(),
    platform: communityPlatformEnum("platform").notNull(),
    flair: text("flair"),
    author: text("author"),
    excerpt: text("excerpt"),
    matchedFlashlightId: uuid("matched_flashlight_id").references(() => flashlights.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("mentions_url_uq").on(t.url),
    index("mentions_published_idx").on(t.publishedAt),
    index("mentions_flashlight_idx").on(t.matchedFlashlightId),
  ],
);

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export const userCollections = pgTable(
  "user_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    flashlightId: uuid("flashlight_id")
      .notNull()
      .references(() => flashlights.id, { onDelete: "cascade" }),
    status: collectionStatusEnum("status").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("collections_user_light_uq").on(t.userId, t.flashlightId),
    index("collections_user_status_idx").on(t.userId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Serialized catalog filter state (same shape as the URL query). */
    filterCriteriaJson: jsonb("filter_criteria_json").$type<Record<string, string>>().notNull(),
    triggerEvents: triggerEventEnum("trigger_events").array().notNull(),
    channels: alertChannelEnum("channels").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    /** Set for 1-click "Watch" rules that track a single light. */
    watchFlashlightId: uuid("watch_flashlight_id").references(() => flashlights.id, { onDelete: "cascade" }),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("rules_user_idx").on(t.userId),
    index("rules_active_idx").on(t.isActive),
    index("rules_watch_idx").on(t.watchFlashlightId),
  ],
);

export const notificationSettings = pgTable("notification_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  ntfyTopicUrl: text("ntfy_topic_url"),
  discordWebhookUrl: text("discord_webhook_url"),
  emailAddress: text("email_address"),
  digestSchedule: digestScheduleEnum("digest_schedule").notNull().default("daily"),
  lastDigestSentAt: timestamp("last_digest_sent_at", { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    failureCount: integer("failure_count").notNull().default(0),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_endpoint_uq").on(t.endpoint), index("push_user_idx").on(t.userId)],
);

/** Every state transition the ingestion engine detects. Drives Fresh Drops, RSS and alerts. */
export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flashlightId: uuid("flashlight_id")
      .notNull()
      .references(() => flashlights.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => vendorListings.id, { onDelete: "set null" }),
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
    type: triggerEventEnum("type").notNull(),
    oldPrice: numeric("old_price", { precision: 10, scale: 2, mode: "number" }),
    newPrice: numeric("new_price", { precision: 10, scale: 2, mode: "number" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_created_idx").on(t.createdAt),
    index("events_flashlight_idx").on(t.flashlightId),
    index("events_unprocessed_idx").on(t.processedAt),
  ],
);

/** Rule ↔ event matches (the "matched history"), with per-channel delivery results. */
export const alertMatches = pgTable(
  "alert_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => productEvents.id, { onDelete: "cascade" }),
    flashlightId: uuid("flashlight_id")
      .notNull()
      .references(() => flashlights.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: triggerEventEnum("event_type").notNull(),
    deliveryResults: jsonb("delivery_results").$type<DeliveryResult[]>().notNull().default(sql`'[]'::jsonb`),
    digestPending: boolean("digest_pending").notNull().default(false),
    digestSentAt: timestamp("digest_sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("matches_rule_event_uq").on(t.ruleId, t.eventId),
    index("matches_user_idx").on(t.userId, t.createdAt),
    index("matches_digest_idx").on(t.digestPending),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for db.query.* convenience)
// ---------------------------------------------------------------------------

export const flashlightRelations = relations(flashlights, ({ many }) => ({
  emitters: many(flashlightEmitters),
  listings: many(vendorListings),
}));

export const emitterRelations = relations(flashlightEmitters, ({ one }) => ({
  flashlight: one(flashlights, { fields: [flashlightEmitters.flashlightId], references: [flashlights.id] }),
}));

export const listingRelations = relations(vendorListings, ({ one }) => ({
  flashlight: one(flashlights, { fields: [vendorListings.flashlightId], references: [flashlights.id] }),
  source: one(sources, { fields: [vendorListings.sourceId], references: [sources.id] }),
}));

export type Source = typeof sources.$inferSelect;
export type Flashlight = typeof flashlights.$inferSelect;
export type NewFlashlight = typeof flashlights.$inferInsert;
export type FlashlightEmitter = typeof flashlightEmitters.$inferSelect;
export type VendorListing = typeof vendorListings.$inferSelect;
export type AlertRule = typeof alertRules.$inferSelect;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type ProductEvent = typeof productEvents.$inferSelect;
